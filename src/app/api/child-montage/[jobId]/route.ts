// ============================================
// GENESIS STUDIO — Child montage: collect the film
// ============================================
// GET /api/child-montage/[jobId] → the state of one montage.
//
// The join runs on the video service for minutes after the generate request
// has already answered, so this is what finishes the job: when the file is
// there it is filed in the creator's gallery like any other video, which is
// what puts it behind the usual download and share. Safe to call repeatedly;
// a job that has already finished answers from the row.
//
// Every path that gives up here refunds first. The montage is charged up
// front and a film that was never delivered was never sold.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, getJob, updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { envString } from "@/lib/env";
import { videoStorageKey } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { jobAgeMs } from "@/lib/job-finalizer";
import { MONTAGE_JOB_PREFIX, MONTAGE_RETRY_MESSAGE, MONTAGE_TITLE } from "@/lib/child-montage";

export const dynamic = "force-dynamic";

/** Long enough for a three-clip join on a 512MB box, short enough to give up. */
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

  const childFaceUrl = job.thumbnail_url || null;

  if (job.status === "completed") {
    return NextResponse.json({ status: "completed", videoUrl: job.output_video_url, childFaceUrl, progress: 100 });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", errorMessage: job.error_message, childFaceUrl, retry: true });
  }

  // Still filming — the generate request has not started the join yet.
  if (!job.runpod_job_id?.startsWith(MONTAGE_JOB_PREFIX)) {
    return NextResponse.json({ status: "processing", progress: job.progress || 10, childFaceUrl });
  }

  const serviceUrl = envString("SCRAPER_SERVICE_URL");
  const serviceSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!serviceUrl || !serviceSecret) {
    return NextResponse.json({ status: "processing", progress: job.progress || 80, childFaceUrl });
  }

  const fail = async () => {
    await updateJobStatus(job.id, {
      status: "failed",
      errorMessage: MONTAGE_RETRY_MESSAGE,
      completedAt: new Date().toISOString(),
    });
    if (job.credits_cost > 0) {
      await refundCredits(job.user_id, job.credits_cost, job.id, "Montage failed — automatic refund");
    }
    return NextResponse.json({ status: "failed", errorMessage: MONTAGE_RETRY_MESSAGE, childFaceUrl, retry: true });
  };

  const [stitchJobId, videoId] = job.runpod_job_id.slice(MONTAGE_JOB_PREFIX.length).split("|");
  if (!stitchJobId || !videoId) return fail();

  try {
    const res = await fetch(`${serviceUrl}/stitch-episode/${stitchJobId}`, {
      headers: { "x-scraper-secret": serviceSecret },
    });

    // The video service drops in-memory jobs when it restarts while idle.
    // Series can start the join again from its stored shots; there are no
    // stored clips here, so the honest answer is to refund and let them press
    // the button again — the stored face means a retry costs no new upload.
    if (res.status === 404) return fail();
    if (!res.ok) {
      return NextResponse.json({ status: "processing", progress: job.progress || 85, childFaceUrl });
    }

    const body = (await res.json()) as { status?: string; error?: string };

    if (body.status === "running") {
      if (jobAgeMs(job.created_at) > TIMEOUT_MS) return fail();
      const progress = Math.min(95, 80 + Math.round(jobAgeMs(job.created_at) / 20_000));
      if (progress !== job.progress) await updateJobStatus(job.id, { progress });
      return NextResponse.json({ status: "processing", progress, childFaceUrl });
    }

    if (body.status !== "done") {
      console.error(`[CHILD-MONTAGE] join failed for job ${job.id}: ${body.error || "unknown"}`);
      return fail();
    }

    const outputKey = videoStorageKey(job.user_id, `montage-${videoId}`);
    const thumbnailUrl = await extractAndUploadThumbnail(outputKey, job.user_id, videoId).catch(() => "");
    const videoUrl = `/api/videos/${videoId}`;

    await createVideo({
      id: videoId,
      userId: job.user_id,
      jobId: job.id,
      title: MONTAGE_TITLE,
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

    console.log(`[CHILD-MONTAGE] job ${job.id} complete → ${videoId}`);
    return NextResponse.json({ status: "completed", videoUrl, childFaceUrl, progress: 100 });
  } catch (err) {
    console.error("[CHILD-MONTAGE] poll error:", err);
    return NextResponse.json({ status: "processing", progress: job.progress || 80, childFaceUrl });
  }
}
