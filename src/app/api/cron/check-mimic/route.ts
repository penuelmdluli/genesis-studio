import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { getKlingMotionStatus, getKlingMotionResult } from "@/lib/providers/fal-kling-i2v";
import { persistExternalVideo } from "@/lib/storage";
import { createVideo } from "@/lib/db";
import { sendVideoReadyEmail } from "@/lib/email";
import { recordSpend } from "@/lib/spend-tracker";
import { triggerOutro, pollOutro, pollMerge } from "@/lib/mimic-outro";
import { isOwnerClerkId } from "@/lib/credits";

// Cron job: checks all "submitted" mimic jobs and completes them server-side.
// Also polls pending outro jobs and concatenates when ready.
// This prevents jobs from being lost when the user closes the browser.
// Run every 2 minutes via Cloudflare Workers cron trigger.

export async function GET(req: NextRequest) {
  // Auth: cron secret or owner only
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // ── Phase 1: Check submitted dance jobs ──────────────────────
  const { data: pendingJobs } = await db
    .from("mimic_jobs")
    .select("id, user_id, fal_request_id, prompt, duration_sec, keep_video_sound, character_image_url, aspect_ratio")
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(10);

  let completed = 0;
  let failed = 0;

  if (pendingJobs && pendingJobs.length > 0) {
    for (const job of pendingJobs) {
      if (!job.fal_request_id) continue;

      try {
        const { status: falStatus } = await getKlingMotionStatus(job.fal_request_id);

        if (falStatus === "COMPLETED") {
          const result = await getKlingMotionResult(job.fal_request_id);

          // Persist to R2
          const r2Key = `mimic-outputs/${job.user_id}/${job.id}.mp4`;
          let outputUrl = result.videoUrl;
          try {
            await persistExternalVideo(result.videoUrl, r2Key);
            outputUrl = `/api/videos/${job.id}`;
          } catch { /* use FAL URL as fallback */ }

          // Save to gallery
          try {
            await createVideo({
              id: job.id,
              userId: job.user_id,
              jobId: null,
              title: job.prompt || "Mimic Studio generation",
              url: outputUrl,
              thumbnailUrl: job.character_image_url || "",
              modelId: "mimic-motion" as any,
              prompt: job.prompt || "Mimic Studio",
              resolution: "720p",
              duration: job.duration_sec || 10,
              fps: 24,
              fileSize: result.fileSizeBytes || 0,
              aspectRatio: job.aspect_ratio === "16:9" ? "landscape" : "portrait",
            });
          } catch { /* may already exist */ }

          // Update job status
          await db.from("mimic_jobs").update({
            status: "completed",
            output_video_url: outputUrl,
            cost_usd: result.costUsd,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);

          recordSpend("fal-kling-i2v-mimic", result.costUsd).catch(() => {});

          // Send email notification
          try {
            const { data: user } = await db.from("users").select("email, name").eq("id", job.user_id).single();
            if (user?.email) {
              await sendVideoReadyEmail(user.email, user.name || "Creator", job.id);
            }
          } catch { /* non-blocking */ }

          completed++;
          console.log(`[CRON-MIMIC] Completed: ${job.id} ($${result.costUsd})`);

        } else if (falStatus === "FAILED") {
          await db.from("mimic_jobs").update({
            status: "failed",
            error_message: "Generation failed on FAL",
          }).eq("id", job.id);

          // Refund credits
          try {
            const { refundCredits } = await import("@/lib/credits");
            await refundCredits(job.user_id, 1500, job.id, "Mimic cron: FAL failed — auto refund");
          } catch { /* non-blocking */ }

          failed++;
          console.log(`[CRON-MIMIC] Failed: ${job.id}`);
        }
        // IN_QUEUE / IN_PROGRESS — skip, check next cycle
      } catch (err) {
        console.error(`[CRON-MIMIC] Error checking ${job.id}:`, err);
      }
    }
  }

  // ── Phase 2: Trigger outros for completed jobs that don't have one yet
  // Fire-and-forget doesn't work on Workers — must await here
  let outrosTriggered = 0;

  // Only add marketing outros to owner's videos — not customers
  const { data: needsOutro } = await db
    .from("mimic_jobs")
    .select("id, user_id")
    .eq("status", "completed")
    .eq("outro_status", "none")
    .order("completed_at", { ascending: false })
    .limit(5);

  if (needsOutro && needsOutro.length > 0) {
    for (const job of needsOutro) {
      try {
        // Look up clerk_id to check if this is the owner
        const { data: user } = await db
          .from("users")
          .select("clerk_id")
          .eq("id", job.user_id)
          .single();

        if (!user?.clerk_id || !isOwnerClerkId(user.clerk_id)) {
          // Skip customer videos — mark as 'skipped' so we don't re-check
          await db.from("mimic_jobs").update({ outro_status: "skipped" }).eq("id", job.id);
          console.log(`[CRON-MIMIC] Skipping outro for customer job ${job.id}`);
          continue;
        }

        await triggerOutro(job.id);
        outrosTriggered++;
        console.log(`[CRON-MIMIC] Outro triggered for owner job ${job.id}`);
      } catch (err) {
        console.error(`[CRON-MIMIC] Outro trigger failed for ${job.id}:`, err);
      }
    }
  }

  // ── Phase 3: Poll pending lip-sync outros ─────────────────────
  let outrosAdvanced = 0;

  const { data: outroJobs } = await db
    .from("mimic_jobs")
    .select("id")
    .eq("status", "completed")
    .eq("outro_status", "submitted")
    .order("completed_at", { ascending: true })
    .limit(5);

  if (outroJobs && outroJobs.length > 0) {
    for (const job of outroJobs) {
      try {
        const done = await pollOutro(job.id);
        if (done) outrosAdvanced++;
      } catch (err) {
        console.error(`[CRON-MIMIC] Outro poll error for ${job.id}:`, err);
      }
    }
  }

  // ── Phase 4: Poll pending merge jobs ────────────────────────
  let mergesCompleted = 0;

  const { data: mergeJobs } = await db
    .from("mimic_jobs")
    .select("id")
    .eq("status", "completed")
    .eq("outro_status", "merging")
    .order("completed_at", { ascending: true })
    .limit(5);

  if (mergeJobs && mergeJobs.length > 0) {
    for (const job of mergeJobs) {
      try {
        const done = await pollMerge(job.id);
        if (done) mergesCompleted++;
      } catch (err) {
        console.error(`[CRON-MIMIC] Merge poll error for ${job.id}:`, err);
      }
    }
  }

  return NextResponse.json({
    checked: pendingJobs?.length || 0,
    completed,
    failed,
    stillPending: (pendingJobs?.length || 0) - completed - failed,
    outros: { triggered: outrosTriggered, lipSyncPolled: outroJobs?.length || 0, advanced: outrosAdvanced, mergesCompleted },
  });
}
