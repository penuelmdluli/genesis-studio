// ============================================
// GENESIS STUDIO — Creator Tools: poll a job
// ============================================
// Finishes a tool job: when the provider is done, copies the output into R2
// (provider URLs expire) and marks the row completed. Audio outputs are served
// from R2 directly, video through /api/videos/* like everything else.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, getJob, updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { getWsPrediction, wsStatusOf } from "@/lib/wavespeed-tools";
import { uploadVideo, uploadAudio, videoStorageKey, audioStorageKey, r2PublicUrl } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { getTool } from "@/lib/tools-registry";
import { toUserFacingProviderError } from "@/lib/user-errors";
import { jobAgeMs } from "@/lib/job-finalizer";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15 * 60 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await getJob(jobId);
  if (!job || job.user_id !== user.id) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const toolId = /^\[tool:([a-z0-9-]+)\]/.exec(job.prompt || "")?.[1];
  const tool = toolId ? getTool(toolId) : undefined;
  const outputKind = tool?.outputKind || "video";

  if (job.status === "completed") {
    return NextResponse.json({ status: "completed", outputUrl: job.output_video_url, outputKind, progress: 100 });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", errorMessage: job.error_message, outputKind });
  }
  if (!job.runpod_job_id?.startsWith("ws:")) {
    return NextResponse.json({ status: job.status, progress: job.progress || 0, outputKind });
  }

  const fail = async (raw: string) => {
    const msg = toUserFacingProviderError(raw);
    await updateJobStatus(job.id, { status: "failed", errorMessage: msg, completedAt: new Date().toISOString() });
    if (job.credits_cost > 0) {
      await refundCredits(job.user_id, job.credits_cost, job.id, `${tool?.name || "Tool"} failed — automatic refund`);
    }
    return NextResponse.json({ status: "failed", errorMessage: msg, outputKind });
  };

  try {
    const p = await getWsPrediction(job.runpod_job_id.slice(3));
    const status = wsStatusOf(p);

    if (status === "FAILED") return fail(p.error || "provider reported failure");

    if (status === "COMPLETED") {
      const src = p.outputs?.[0];
      if (!src) return fail("no output returned");

      const res = await fetch(src);
      if (!res.ok) return fail(`could not download output (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());

      let outputUrl: string;
      if (outputKind === "audio") {
        const key = audioStorageKey(job.user_id, `tool-${job.id}`);
        await uploadAudio(key, buffer);
        outputUrl = r2PublicUrl(key);
      } else {
        const vKey = videoStorageKey(job.user_id, job.id);
        await uploadVideo(vKey, buffer);
        const videoId = randomUUID();
        outputUrl = `/api/videos/${videoId}`;
        const thumbnailUrl = await extractAndUploadThumbnail(vKey, job.user_id, videoId).catch(() => "");
        await createVideo({
          id: videoId,
          userId: job.user_id,
          jobId: job.id,
          title: (tool?.name || "Tool output").slice(0, 100),
          url: outputUrl,
          thumbnailUrl,
          modelId: job.model_id,
          prompt: job.prompt,
          resolution: job.resolution,
          duration: job.duration || 0,
          fps: job.fps,
          fileSize: buffer.length,
          aspectRatio: job.aspect_ratio,
        });
      }

      await updateJobStatus(job.id, {
        status: "completed",
        progress: 100,
        outputVideoUrl: outputUrl,
        completedAt: new Date().toISOString(),
      });
      return NextResponse.json({ status: "completed", outputUrl, outputKind, progress: 100 });
    }

    const age = jobAgeMs(job.created_at);
    if (age > TIMEOUT_MS) return fail("timed out");

    const progress = status === "IN_PROGRESS" ? Math.min(90, 30 + Math.round(age / 2000)) : 15;
    if (progress !== job.progress) await updateJobStatus(job.id, { progress });
    return NextResponse.json({ status: "processing", progress, outputKind });
  } catch (err) {
    console.error("[TOOLS] poll error:", err);
    return NextResponse.json({ status: "processing", progress: job.progress || 10, outputKind });
  }
}
