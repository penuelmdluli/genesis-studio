import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { submitKlingMotion, getKlingMotionStatus, getKlingMotionResult } from "@/lib/providers/fal-kling-i2v";
import { persistExternalVideo, getSignedDownloadUrl } from "@/lib/storage";
import { postVideoToFacebookPage } from "@/lib/social/facebook";
import { runQualityCheck } from "@/lib/mbs/quality-check";
import { scheduleJob } from "@/lib/mbs/scheduler";
import { recordSpend } from "@/lib/spend-tracker";
import { sendSlackAlert } from "@/lib/alerts";
import { envString } from "@/lib/env";

export const maxDuration = 60;

/**
 * Cron: Process MBS automation queue.
 * Runs every 1 minute. Handles three stages:
 * 1. Submit pending jobs to FAL Kling
 * 2. Poll submitted jobs for completion
 * 3. Post completed jobs to Facebook
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== envString("CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const results = { submitted: 0, completed: 0, posted: 0, errors: 0 };

  try {
    // ── STAGE 0: Convert approved candidates → pending jobs ──
    // Only candidates with verified source_creator_id can become jobs
    const { data: approvedCandidates } = await supabase
      .from("mbs_candidates")
      .select("*")
      .eq("status", "approved")
      .not("reference_video_r2_url", "is", null)
      .not("source_creator_id", "is", null)
      .order("overall_score", { ascending: false })
      .limit(3);

    for (const candidate of approvedCandidates ?? []) {
      try {
        // Look up creator separately
        const { data: creator } = await supabase
          .from("mbs_source_creators")
          .select("handle, verified")
          .eq("id", candidate.source_creator_id)
          .single();

        if (!creator?.verified || !creator?.handle) {
          await supabase.from("mbs_candidates").update({
            status: "rejected",
            rejected_reason: "no_verified_source",
          }).eq("id", candidate.id);
          continue;
        }

        // Look up character
        let character: { id: string; name: string; description: string; portrait_url: string } | null = null;
        if (candidate.suggested_character_id) {
          const { data: charData } = await supabase
            .from("mbs_characters")
            .select("id, name, description, portrait_url")
            .eq("id", candidate.suggested_character_id)
            .single();
          character = charData;
        }

        // Enforce caption attribution — reject if no handle
        if (!candidate.suggested_caption) {
          const { buildCaption } = await import("@/lib/mbs/caption-template");
          const caption = buildCaption({
            character: character?.name ?? "MBS Star",
            creatorHandle: creator.handle,
            setting: candidate.suggested_setting,
            danceStyle: candidate.suggested_dance_style,
          });
          if (!caption) {
            await supabase.from("mbs_candidates").update({
              status: "rejected",
              rejected_reason: "no_attribution_possible",
            }).eq("id", candidate.id);
            continue;
          }
          candidate.suggested_caption = caption;
        }

        const prompt = character
          ? `${character.description}, dancing joyfully, ${candidate.suggested_setting ?? "vibrant Soweto street"}, golden hour, cinematic, high quality`
          : `child dancing joyfully in ${candidate.suggested_setting ?? "vibrant Soweto street"}, golden hour, cinematic`;

        // Generate presigned R2 URL so Kling can download the reference video
        // (R2 keys aren't publicly accessible — Kling needs an HTTPS URL)
        const videoUrl = await getSignedDownloadUrl(candidate.reference_video_r2_url, 7200);

        await supabase.from("mbs_jobs").insert({
          candidate_id: candidate.id,
          character_id: candidate.suggested_character_id,
          reference_video_url: videoUrl,
          reference_video_duration_sec: candidate.duration_sec,
          prompt,
          setting: candidate.suggested_setting,
          caption: candidate.suggested_caption,
          duration_sec: candidate.duration_sec ?? 10,
          status: "pending",
        });

        await supabase.from("mbs_candidates").update({
          status: "processed",
        }).eq("id", candidate.id);

        console.log(`[MBS] Candidate ${candidate.id} → job (creator: @${creator.handle})`);
      } catch (err) {
        console.error(`[MBS] Failed to create job from candidate ${candidate.id}:`, err);
      }
    }

    // ── STAGE 1: Submit pending jobs (max 3 concurrent) ──
    const { data: inFlight } = await supabase
      .from("mbs_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted");

    const concurrentLimit = 3;
    const slotsAvailable = concurrentLimit - (inFlight?.length ?? 0);

    if (slotsAvailable > 0) {
      const { data: pendingJobs } = await supabase
        .from("mbs_jobs")
        .select("*, mbs_characters(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(slotsAvailable);

      for (const job of pendingJobs ?? []) {
        try {
          const character = job.mbs_characters;

          // Presign URLs if they're R2 keys (not already https://)
          let charUrl = character?.portrait_url ?? "";
          if (charUrl && !charUrl.startsWith("http")) {
            charUrl = await getSignedDownloadUrl(charUrl, 7200);
          }
          let refUrl = job.reference_video_url;
          if (refUrl && !refUrl.startsWith("http")) {
            refUrl = await getSignedDownloadUrl(refUrl, 7200);
          }

          const { requestId } = await submitKlingMotion({
            prompt: job.prompt,
            characterImageUrl: charUrl,
            referenceVideoUrl: refUrl,
            characterOrientation: "video",
            keepOriginalSound: true,
          });

          await supabase.from("mbs_jobs").update({
            status: "submitted",
            fal_request_id: requestId,
            submitted_at: new Date().toISOString(),
          }).eq("id", job.id);

          results.submitted++;
          console.log(`[MBS] Submitted job ${job.id} → FAL ${requestId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from("mbs_jobs").update({
            status: "failed",
            error_message: msg,
          }).eq("id", job.id);
          results.errors++;
          console.error(`[MBS] Submit failed for ${job.id}:`, msg);
        }
      }
    }

    // ── STAGE 2: Poll submitted jobs ──
    const { data: submittedJobs } = await supabase
      .from("mbs_jobs")
      .select("*, mbs_characters(*)")
      .eq("status", "submitted")
      .not("fal_request_id", "is", null);

    for (const job of submittedJobs ?? []) {
      try {
        const { status } = await getKlingMotionStatus(job.fal_request_id);

        if (status === "COMPLETED") {
          const result = await getKlingMotionResult(job.fal_request_id);

          // Persist to R2 as backup, but use FAL CDN URL for Facebook posting
          // (R2 URLs require auth, Facebook can't fetch them)
          const storageKey = `mbs-finished/${job.id}.mp4`;
          persistExternalVideo(result.videoUrl, storageKey).catch((e) =>
            console.error(`[MBS] R2 backup persist failed for ${job.id}:`, e)
          );

          // Store FAL CDN URL — publicly accessible for ~24h, sufficient for FB posting
          await supabase.from("mbs_jobs").update({
            status: "quality_check",
            finished_video_url: result.videoUrl,
            cost_usd: result.costUsd,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);

          // Run quality gate — updates status to scheduled/quality_review/failed
          try {
            const qr = await runQualityCheck(job.id);
            if (qr.verdict === "auto_post") {
              await scheduleJob(job.id);
            }
          } catch (qErr) {
            console.error(`[MBS] Quality check error for ${job.id}:`, qErr);
            // On quality check failure, auto-schedule (degrade gracefully)
            await scheduleJob(job.id);
          }

          recordSpend("fal-kling-i2v", result.costUsd).catch(() => {});
          results.completed++;

          const charName = job.mbs_characters?.name ?? "Unknown";
          sendSlackAlert({
            level: "info",
            title: "MBS video generated",
            message: `Character: ${charName} | Cost: $${result.costUsd.toFixed(2)} | Job: ${job.id}`,
          }).catch(() => {});

          console.log(`[MBS] Completed ${job.id}: $${result.costUsd.toFixed(2)}`);
        } else if (status === "FAILED") {
          if (job.retry_count < 2) {
            await supabase.from("mbs_jobs").update({
              status: "pending",
              fal_request_id: null,
              retry_count: job.retry_count + 1,
              error_message: "FAL generation failed, retrying",
            }).eq("id", job.id);
          } else {
            await supabase.from("mbs_jobs").update({
              status: "failed",
              error_message: "FAL generation failed after 2 retries",
            }).eq("id", job.id);
            results.errors++;

            sendSlackAlert({
              level: "warning",
              title: "MBS generation failed",
              message: `Job ${job.id} failed after 2 retries`,
            }).catch(() => {});
          }
        }
        // IN_QUEUE / IN_PROGRESS → do nothing, poll again next cycle
      } catch (err) {
        console.error(`[MBS] Poll error for ${job.id}:`, err);
      }
    }

    // ── STAGE 3: Post completed jobs to Facebook ──
    const postingEnabled = envString("MBS_POSTING_ENABLED") !== "false";
    if (postingEnabled) {
      const now = new Date().toISOString();
      const { data: readyJobs } = await supabase
        .from("mbs_jobs")
        .select("*, mbs_characters(*)")
        .eq("status", "scheduled")
        .not("finished_video_url", "is", null)
        .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
        .limit(1);

      for (const job of readyJobs ?? []) {
        try {
          // finished_video_url contains the FAL CDN URL (publicly accessible)
          const videoUrl = job.finished_video_url;

          const { postId } = await postVideoToFacebookPage({
            videoUrl,
            description: job.caption ?? `${job.mbs_characters?.name ?? "MBS"} feeling the music`,
          });

          await supabase.from("mbs_jobs").update({
            status: "posted",
            facebook_post_id: postId,
            facebook_post_url: `https://www.facebook.com/${postId}`,
            posted_at: new Date().toISOString(),
          }).eq("id", job.id);

          results.posted++;

          sendSlackAlert({
            level: "info",
            title: "MBS post live",
            message: `${job.mbs_characters?.name ?? "MBS"} → https://www.facebook.com/${postId}\nCost: $${job.cost_usd ?? "?"}`,
          }).catch(() => {});

          console.log(`[MBS] Posted ${job.id} → FB ${postId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from("mbs_jobs").update({
            error_message: `Post failed: ${msg}`,
          }).eq("id", job.id);
          results.errors++;
          console.error(`[MBS] Post failed for ${job.id}:`, msg);
        }
      }
    }
  } catch (err) {
    console.error("[MBS] Cron error:", err);
    results.errors++;
  }

  return NextResponse.json(results);
}
