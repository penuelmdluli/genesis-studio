// ============================================
// Mimic Studio — Marketing Outro Pipeline
//
// Every OWNER dance video gets a 3-5s lip-sync outro
// using the SAME character image. The character
// "speaks" a marketing tagline, then the outro
// is concatenated to the dance video seamlessly.
//
// Lifecycle (all phases run in the cron):
//   outro_status: none → submitted → merging → completed
//   1. none → submitted: triggerOutro() — submit lip-sync to FAL
//   2. submitted → merging: pollOutro() — lip-sync done, submit merge job
//   3. merging → completed: pollMerge() — merge done, persist final video
// ============================================

import { fal } from "@fal-ai/client";
import { envString } from "@/lib/env";
import { getDb } from "@/lib/db-driver";

fal.config({ credentials: () => envString("FAL_KEY") || "" });

const FAL_AVATAR_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";
const FAL_MERGE_MODEL = "fal-ai/ffmpeg-api/merge-videos";

// ── Marketing prompts (rotated per-job) ────────────────────────
const MARKETING_PROMPTS = [
  'A person looking directly at camera with a warm confident smile, speaking enthusiastically: "This was made with iVideo Studio — create yours free at i video studio dot A I". Natural head movement, friendly hand gesture pointing at viewer, professional lighting, energetic delivery. Perfect lip sync.',
  'A person turning to face the camera with excitement, speaking clearly: "Want me to dance for you too? Try iVideo Studio free at i video studio dot A I". Bright smile, engaging eye contact, slight lean forward, charismatic energy. Perfect lip sync.',
  'A person speaking naturally to camera with pride: "Made with iVideo Studio AI — your turn! Visit i video studio dot A I". Warm expression, confident delivery, subtle hand gestures, direct eye contact. Perfect lip sync.',
  'A person facing camera with a playful smile, speaking warmly: "Powered by iVideo Studio. Make your own at i video studio dot A I". Friendly wave, approachable energy, natural body language. Perfect lip sync.',
  'A person looking at camera with wonder, speaking clearly: "AI magic by iVideo Studio. Create amazing videos free at i video studio dot A I". Enthusiastic expression, expressive gestures, confident delivery. Perfect lip sync.',
];

function pickPrompt(jobId: string): string {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) {
    hash = ((hash << 5) - hash + jobId.charCodeAt(i)) | 0;
  }
  return MARKETING_PROMPTS[Math.abs(hash) % MARKETING_PROMPTS.length];
}

// ── Phase 1: Submit Lip-Sync Outro ─────────────────────────────

export async function triggerOutro(jobId: string): Promise<void> {
  const db = getDb();

  let job: Record<string, unknown> | null = null;
  try {
    const { data } = await db
      .from("mimic_jobs")
      .select("id, character_image_url, aspect_ratio, outro_status")
      .eq("id", jobId)
      .single();
    job = data;
  } catch (e) {
    console.error(`[MIMIC-OUTRO] DB query failed for ${jobId}:`, e);
    return;
  }

  if (!job || !job.character_image_url) {
    console.warn(`[MIMIC-OUTRO] Job ${jobId} not found or no character image`);
    return;
  }

  if (job.outro_status && job.outro_status !== "none" && job.outro_status !== "failed") {
    console.log(`[MIMIC-OUTRO] Outro already ${job.outro_status} for ${jobId}`);
    return;
  }

  try {
    const outroPrompt = pickPrompt(jobId);
    const arMap: Record<string, string> = { "9:16": "9:16", "16:9": "16:9", "1:1": "1:1" };
    const falAr = arMap[(job.aspect_ratio as string) || "9:16"] || "9:16";

    console.log(`[MIMIC-OUTRO] Submitting outro for ${jobId}`);

    const result = await fal.queue.submit(FAL_AVATAR_MODEL, {
      input: {
        prompt: outroPrompt,
        image_url: job.character_image_url,
        duration: "5",
        aspect_ratio: falAr,
        native_audio: true,
      },
    });

    await db.from("mimic_jobs").update({
      outro_request_id: result.request_id,
      outro_status: "submitted",
    }).eq("id", jobId);

    console.log(`[MIMIC-OUTRO] Outro submitted for ${jobId}: ${result.request_id}`);
  } catch (err) {
    console.error(`[MIMIC-OUTRO] Failed to trigger outro for ${jobId}:`, err);
    try {
      await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
    } catch { /* best-effort */ }
  }
}

// Resolve internal /api/videos/xxx URLs to public R2 CDN URLs
// FAL can't access internal proxy URLs — it needs public URLs.
function resolvePublicVideoUrl(outputVideoUrl: string, userId: string, jobId: string): string {
  const cdnBase = (process.env.R2_PUBLIC_URL || "https://cdn.ivideostudio.ai").replace(/\/$/, "");
  // Mimic outputs are stored as mimic-outputs/{userId}/{jobId}.mp4
  if (outputVideoUrl.startsWith("/api/videos/")) {
    return `${cdnBase}/mimic-outputs/${userId}/${jobId}.mp4`;
  }
  // Already a full URL
  return outputVideoUrl;
}

// ── Phase 2: Poll lip-sync, submit merge ───────────────────────

export async function pollOutro(jobId: string): Promise<boolean> {
  const db = getDb();

  const { data: job } = await db
    .from("mimic_jobs")
    .select("id, outro_request_id, outro_status, output_video_url, user_id")
    .eq("id", jobId)
    .single();

  if (!job || !job.outro_request_id || job.outro_status !== "submitted") {
    return true;
  }

  try {
    const statusUrl = `https://queue.fal.run/fal-ai/kling-video/requests/${job.outro_request_id}/status`;
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${envString("FAL_KEY")}` },
    });

    if (!statusRes.ok) return false;

    const statusData = (await statusRes.json()) as { status: string };

    if (statusData.status === "IN_QUEUE" || statusData.status === "IN_PROGRESS") {
      return false;
    }

    if (statusData.status === "FAILED") {
      await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
      return true;
    }

    if (statusData.status === "COMPLETED") {
      // Get the outro video URL
      const resultUrl = `https://queue.fal.run/fal-ai/kling-video/requests/${job.outro_request_id}`;
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${envString("FAL_KEY")}` },
      });

      if (!resultRes.ok) {
        await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
        return true;
      }

      const resultData = (await resultRes.json()) as { video: { url: string } };
      const outroVideoUrl = resultData.video?.url;
      if (!outroVideoUrl) {
        await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
        return true;
      }

      // Persist outro to R2
      let persistedOutroUrl = outroVideoUrl;
      try {
        const { persistExternalVideo, r2PublicUrl } = await import("@/lib/storage");
        const outroR2Key = `mimic-outros/${job.user_id}/${jobId}-outro.mp4`;
        await persistExternalVideo(outroVideoUrl, outroR2Key);
        persistedOutroUrl = r2PublicUrl(outroR2Key);
      } catch (e) {
        console.warn(`[MIMIC-OUTRO] R2 persist failed for outro, using FAL URL:`, e);
      }

      // Submit merge job: [dance, outro] → final
      try {
        const danceVideoUrl = resolvePublicVideoUrl(
          job.output_video_url as string,
          job.user_id as string,
          jobId
        );
        console.log(`[MIMIC-OUTRO] Merging: dance=${danceVideoUrl.slice(0, 80)}... + outro=${persistedOutroUrl.slice(0, 80)}...`);

        const mergeResult = await fal.queue.submit(FAL_MERGE_MODEL, {
          input: { video_urls: [danceVideoUrl, persistedOutroUrl] },
        });

        // Store merge request ID and advance to "merging" status
        // Reuse outro_request_id for the merge job
        await db.from("mimic_jobs").update({
          outro_video_url: persistedOutroUrl,
          outro_request_id: mergeResult.request_id,
          outro_status: "merging",
        }).eq("id", jobId);

        console.log(`[MIMIC-OUTRO] Merge submitted for ${jobId}: ${mergeResult.request_id}`);
      } catch (mergeErr) {
        console.error(`[MIMIC-OUTRO] Merge submit failed for ${jobId}:`, mergeErr);
        await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
      }

      return true;
    }
  } catch (err) {
    console.error(`[MIMIC-OUTRO] Poll error for ${jobId}:`, err);
  }

  return false;
}

// ── Phase 3: Poll merge, finalize ──────────────────────────────

export async function pollMerge(jobId: string): Promise<boolean> {
  const db = getDb();

  const { data: job } = await db
    .from("mimic_jobs")
    .select("id, outro_request_id, user_id")
    .eq("id", jobId)
    .single();

  if (!job || !job.outro_request_id) return true;

  try {
    const statusResult = await fal.queue.status(FAL_MERGE_MODEL, {
      requestId: job.outro_request_id,
      logs: false,
    });
    const mergeStatus = statusResult.status as string;

    if (mergeStatus === "IN_QUEUE" || mergeStatus === "IN_PROGRESS") {
      return false;
    }

    if (mergeStatus === "FAILED") {
      await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
      return true;
    }

    if (mergeStatus === "COMPLETED") {
      const result = await fal.queue.result(FAL_MERGE_MODEL, {
        requestId: job.outro_request_id,
      });

      const data = result.data as Record<string, unknown>;
      const mergedUrl =
        (data?.video_url as string) ||
        (data?.video as { url: string })?.url ||
        "";

      if (!mergedUrl) {
        await db.from("mimic_jobs").update({ outro_status: "failed" }).eq("id", jobId);
        return true;
      }

      // Persist final video to R2
      let finalUrl = mergedUrl;
      try {
        const { persistExternalVideo, r2PublicUrl } = await import("@/lib/storage");
        const finalR2Key = `mimic-final/${job.user_id}/${jobId}.mp4`;
        await persistExternalVideo(mergedUrl, finalR2Key);
        finalUrl = r2PublicUrl(finalR2Key);
      } catch (e) {
        console.warn(`[MIMIC-OUTRO] Final R2 persist failed, using FAL URL:`, e);
      }

      // Update job with final combined video
      await db.from("mimic_jobs").update({
        outro_status: "completed",
        final_video_url: finalUrl,
      }).eq("id", jobId);

      // Update gallery entry too
      try {
        await db.from("videos").update({ url: finalUrl }).eq("id", jobId);
      } catch { /* gallery entry may not exist */ }

      console.log(`[MIMIC-OUTRO] Final video ready for ${jobId}: ${finalUrl}`);
      return true;
    }
  } catch (err) {
    console.error(`[MIMIC-OUTRO] Merge poll error for ${jobId}:`, err);
  }

  return false;
}
