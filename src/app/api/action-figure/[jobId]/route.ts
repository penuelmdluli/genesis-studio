// ============================================
// GENESIS STUDIO — AI Action Figure: collect the commercial
// ============================================
// GET /api/action-figure/[jobId] → the state of one advert.
//
// The join runs on the video service for minutes after the generate request
// has already answered, so this is what finishes the job: when the file is
// there it is filed in the creator's gallery like any other video, which is
// what puts it behind the usual download and share. Safe to call repeatedly;
// a job that has already finished answers from the row.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, getJob, updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { envString } from "@/lib/env";
import { videoStorageKey } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { jobAgeMs } from "@/lib/job-finalizer";

export const dynamic = "force-dynamic";

/** Long enough for a four-shot join on a 512MB box, short enough to give up. */
const TIMEOUT_MS = 15 * 60 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await getJob(jobId).catch(() => null);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const figureImageUrl = job.thumbnail_url || null;

  if (job.status === "completed") {
    return NextResponse.json({ status: "completed", videoUrl: job.output_video_url, figureImageUrl, progress: 100 });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", errorMessage: job.error_message, figureImageUrl });
  }

  // Still filming — the generate request has not started the join yet.
  if (!job.runpod_job_id?.startsWith("af:")) {
    return NextResponse.json({ status: "processing", progress: job.progress || 10, figureImageUrl });
  }

  const serviceUrl = envString("SCRAPER_SERVICE_URL");
  const serviceSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!serviceUrl || !serviceSecret) {
    return NextResponse.json({ status: "processing", progress: job.progress || 80, figureImageUrl });
  }

  const fail = async (reason: string) => {
    await updateJobStatus(job.id, {
      status: "failed",
      errorMessage: reason,
      completedAt: new Date().toISOString(),
    });
    if (job.credits_cost > 0) {
      await refundCredits(job.user_id, job.credits_cost, job.id, "AI Action Figure failed — automatic refund");
    }
    return NextResponse.json({ status: "failed", errorMessage: reason, figureImageUrl });
  };

  const [stitchJobId, videoId] = job.runpod_job_id.slice(3).split("|");
  if (!stitchJobId || !videoId) return fail("The advert could not be put together. Credits refunded.");

  try {
    const res = await fetch(`${serviceUrl}/stitch-episode/${stitchJobId}`, {
      headers: { "x-scraper-secret": serviceSecret },
    });

    // The video service drops in-memory jobs when it restarts while idle.
    // Series can start the join again from its stored shots; there are no
    // stored shots here, so the honest answer is to refund.
    if (res.status === 404) {
      return fail("The advert was interrupted while being put together. Credits refunded.");
    }
    if (!res.ok) {
      return NextResponse.json({ status: "processing", progress: job.progress || 85, figureImageUrl });
    }

    const body = (await res.json()) as { status?: string; error?: string };

    if (body.status === "running") {
      if (jobAgeMs(job.created_at) > TIMEOUT_MS) {
        return fail("The advert took too long to finish. Credits refunded.");
      }
      const progress = Math.min(95, 80 + Math.round(jobAgeMs(job.created_at) / 20_000));
      if (progress !== job.progress) await updateJobStatus(job.id, { progress });
      return NextResponse.json({ status: "processing", progress, figureImageUrl });
    }

    if (body.status !== "done") {
      console.error(`[ACTION-FIGURE] join failed for job ${job.id}: ${body.error || "unknown"}`);
      return fail("The advert could not be put together. Credits refunded.");
    }

    const outputKey = videoStorageKey(job.user_id, `figure-${videoId}`);
    const thumbnailUrl = await extractAndUploadThumbnail(outputKey, job.user_id, videoId).catch(() => "");
    const videoUrl = `/api/videos/${videoId}`;

    await createVideo({
      id: videoId,
      userId: job.user_id,
      jobId: job.id,
      title: `${job.prompt.replace("[action-figure] ", "")} — Action Figure`.slice(0, 100),
      url: videoUrl,
      thumbnailUrl,
      modelId: job.model_id,
      prompt: job.prompt,
      resolution: job.resolution,
      duration: job.duration || 0,
      fps: job.fps,
      fileSize: 0,
      aspectRatio: job.aspect_ratio,
    });

    await updateJobStatus(job.id, {
      status: "completed",
      progress: 100,
      outputVideoUrl: videoUrl,
      completedAt: new Date().toISOString(),
    });

    console.log(`[ACTION-FIGURE] job ${job.id} complete → ${videoId}`);
    return NextResponse.json({ status: "completed", videoUrl, figureImageUrl, progress: 100 });
  } catch (err) {
    console.error("[ACTION-FIGURE] poll error:", err);
    return NextResponse.json({ status: "processing", progress: job.progress || 80, figureImageUrl });
  }
}
