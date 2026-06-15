/**
 * CHECK-STUCK-JOBS CRON — fail generation jobs stuck for 30+ minutes
 *
 * GET /api/cron/check-stuck-jobs
 * Auth: Bearer CRON_SECRET
 * Schedule: every 5 minutes
 *
 * The dashboard client-side poller has a 30-min timeout, but it only
 * runs while the browser tab is open. This server-side cron catches
 * jobs that are stuck when the user closes the browser.
 *
 * Also polls WaveSpeed/FAL for stuck jobs that might have completed
 * but weren't picked up by the client poller.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { getWavespeedJobStatus, getWavespeedJobResult } from "@/lib/wavespeed";
import { getMotionJobStatus, getMotionJobResult } from "@/lib/motion-control";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { sendVideoReadyEmail } from "@/lib/email";
import { randomUUID } from "crypto";

export const maxDuration = 60;

const STUCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_TIMEOUT_MS).toISOString();

  // Find jobs stuck in queued/processing for 30+ minutes
  const { data: stuckJobs } = await db
    .from("generation_jobs")
    .select("id, status, model_id, runpod_job_id, user_id, credits_cost, prompt, created_at, resolution, duration, fps, aspect_ratio, audio_url, audio_track_id")
    .in("status", ["queued", "processing"])
    .lt("created_at", cutoff)
    .limit(20);

  const summary = { checked: 0, completed: 0, failed: 0, timedOut: 0 };

  for (const job of stuckJobs || []) {
    summary.checked++;
    const jobId = job.runpod_job_id as string | null;
    if (!jobId) {
      // No provider job ID — can't poll, just timeout
      await db.from("generation_jobs").update({
        status: "failed",
        error_message: "Job had no provider ID. Credits refunded.",
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      await refundCredits(job.user_id, job.credits_cost, job.id, "Stuck job — no provider ID");
      summary.timedOut++;
      continue;
    }

    // Try to poll the provider one last time before timing out
    try {
      if (jobId.startsWith("ws:")) {
        // WaveSpeed video gen job
        const wsId = jobId.slice(3);
        const status = await getWavespeedJobStatus(wsId);

        if (status.status === "COMPLETED") {
          const result = await getWavespeedJobResult(wsId);
          await completeJob(db, job, result.videoUrl);
          summary.completed++;
          continue;
        }
      } else if (jobId.startsWith("fal:")) {
        // Motion control job (FAL or WaveSpeed motion)
        const parts = jobId.split(":");
        const endpoint = parts.slice(1, -1).join(":");
        const requestId = parts[parts.length - 1];
        const motionStatus = await getMotionJobStatus(endpoint, requestId);

        if (motionStatus.status === "COMPLETED") {
          const result = await getMotionJobResult(endpoint, requestId);
          await completeJob(db, job, result.videoUrl);
          summary.completed++;
          continue;
        }
      }
    } catch (pollErr) {
      console.warn(`[STUCK-JOBS] Poll error for ${job.id}:`, pollErr);
    }

    // Still not done after 30 min — fail it
    await db.from("generation_jobs").update({
      status: "failed",
      error_message: "Generation timed out after 30 minutes. Credits have been refunded.",
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);
    await refundCredits(job.user_id, job.credits_cost, job.id, "Generation timed out — automatic refund");
    summary.timedOut++;

    // Notify via Discord/Slack
    try {
      const { sendSlackAlert } = await import("@/lib/alerts");
      await sendSlackAlert({
        level: "warning",
        title: "Stuck job timed out",
        message: `Job ${job.id.slice(0, 8)} stuck for 30+ min\nModel: ${job.model_id}\nPrompt: ${(job.prompt || "").slice(0, 60)}\nCredits refunded: ${job.credits_cost}`,
      });
    } catch {}
  }

  console.log(`[STUCK-JOBS] Checked ${summary.checked}: ${summary.completed} completed, ${summary.timedOut} timed out`);

  return NextResponse.json({ summary });
}

async function completeJob(
  db: ReturnType<typeof getDb>,
  job: Record<string, unknown>,
  videoUrl: string
) {
  const userId = job.user_id as string;
  const jobId = job.id as string;

  // Download and upload to R2
  const vKey = videoStorageKey(userId, jobId);
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to download: ${videoRes.status}`);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  await uploadVideo(vKey, videoBuffer);
  await verifyR2Upload(vKey);

  // Create video record
  const videoId = randomUUID();
  const videoApiUrl = `/api/videos/${videoId}`;
  const thumbnailUrl = await extractAndUploadThumbnail(vKey, userId, videoId);

  await db.from("videos").insert({
    id: videoId,
    user_id: userId,
    job_id: jobId,
    title: ((job.prompt as string) || "").slice(0, 100),
    url: videoApiUrl,
    thumbnail_url: thumbnailUrl || "",
    model_id: job.model_id,
    prompt: job.prompt,
    resolution: job.resolution,
    duration: job.duration,
    fps: job.fps || 24,
    file_size: videoBuffer.length,
    aspect_ratio: job.aspect_ratio || "landscape",
    audio_url: job.audio_url || null,
    audio_track_id: job.audio_track_id || null,
  });

  await db.from("generation_jobs").update({
    status: "completed",
    progress: 100,
    output_video_url: videoApiUrl,
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);

  // Email notification
  try {
    const { data: user } = await db.from("users").select("email, name").eq("id", userId).single();
    if (user?.email) {
      sendVideoReadyEmail(user.email, user.name || "Creator", videoId).catch(() => {});
    }
  } catch {}

  // Discord notification
  try {
    const { sendSlackAlert } = await import("@/lib/alerts");
    await sendSlackAlert({
      level: "info",
      title: "Stuck job recovered!",
      message: `Job ${jobId.slice(0, 8)} completed after cron recovery\nVideo: ${videoApiUrl}`,
    });
  } catch {}

  console.log(`[STUCK-JOBS] Recovered job ${jobId} → ${videoApiUrl}`);
}
