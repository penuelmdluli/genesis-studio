// ============================================
// GENESIS STUDIO — Hosted job finalizer
// ============================================
// One place that turns a finished provider job into a delivered video, and
// one place that gives up on it. Used by the reaper, the stuck-job sweep,
// the admin recovery route and the per-minute proactive sweep.
//
// Why this exists: on 2026-09-12 a paying customer's Seedance render was
// killed by the reaper at its 5-minute deadline, refunded, and then finished
// on the provider two minutes later. We paid for the video, the customer got
// nothing, and the refund made the ledger say we were being generous. Three
// separate code paths could do that; none of them asked the provider first.
//
// Rules enforced here:
//   1. Never fail a hosted job without polling the provider in the same
//      breath. If it is done, deliver it. If it is still running and under
//      the hard cap, extend the deadline instead.
//   2. Completion always goes through updateJobStatus so the credit hold is
//      captured (a raw status write leaves the hold dangling, which the
//      orphan sweep later releases — a delivered video for free).
//   3. Tool jobs ("[tool:...]" prompts) are owned by /api/tools/[jobId] and
//      are only ever timed out here, never finalized as videos.

import { randomUUID } from "crypto";
import { getDb } from "@/lib/db-driver";
import { updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits, deductCredits } from "@/lib/credits";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { sendVideoReadyEmail } from "@/lib/email";
import { getWavespeedJobStatus, getWavespeedJobResult } from "@/lib/wavespeed";
import { getFalJobStatus, getFalJobResult } from "@/lib/fal";
import { getMotionJobStatus, getMotionJobResult } from "@/lib/motion-control";
import { AI_MODELS } from "@/lib/constants";
import { ModelId, GenerationType, AspectRatio } from "@/types";

/**
 * D1 writes `created_at` as "YYYY-MM-DD HH:MM:SS" (CURRENT_TIMESTAMP), and the
 * shim compares it as a string. An ISO cutoff ("...T...Z") sorts AFTER every
 * same-day SQL timestamp because " " < "T", so `created_at < isoCutoff` was
 * true for every job created today — the reaper killed brand-new tool jobs
 * two seconds after creation. Cutoffs on created_at must use this format.
 */
export function sqlTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

/** Age in ms from either timestamp format. */
export function jobAgeMs(createdAt: string): number {
  const iso = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z";
  return Date.now() - new Date(iso).getTime();
}

/** Absolute longest we wait for any hosted render before giving up. */
export const HOSTED_HARD_CAP_MS = 45 * 60 * 1000;
/** How much extra time a still-running job gets when its deadline passes. */
export const DEADLINE_EXTENSION_MS = 10 * 60 * 1000;

export interface HostedJobRow {
  id: string;
  user_id: string;
  model_id: string;
  type?: string;
  runpod_job_id: string | null;
  credits_cost: number;
  prompt: string | null;
  resolution?: string;
  duration?: number;
  fps?: number;
  aspect_ratio?: string;
  audio_url?: string | null;
  audio_track_id?: string | null;
  created_at: string;
  status?: string;
}

export type ProviderPoll =
  | { state: "completed"; videoUrl?: string; videoBytes?: Uint8Array }
  | { state: "pending" }
  | { state: "failed"; error: string }
  | { state: "unsupported" };

export function isToolJob(job: { prompt: string | null }): boolean {
  return (job.prompt || "").startsWith("[tool:");
}

/** Ask the provider where a job stands. Never throws. */
export async function pollHostedJob(job: HostedJobRow): Promise<ProviderPoll> {
  const ref = job.runpod_job_id;
  if (!ref) return { state: "unsupported" };

  try {
    if (ref.startsWith("ws:")) {
      const wsId = ref.slice(3);
      const s = await getWavespeedJobStatus(wsId);
      if (s.status === "COMPLETED") {
        const r = await getWavespeedJobResult(wsId);
        return { state: "completed", videoUrl: r.videoUrl };
      }
      if (s.status === "FAILED") return { state: "failed", error: s.error || "Generation failed" };
      return { state: "pending" };
    }

    if (ref.startsWith("fal:")) {
      const parts = ref.split(":");
      const endpoint = parts.slice(1, -1).join(":");
      const requestId = parts[parts.length - 1];
      const s = await getMotionJobStatus(endpoint, requestId);
      if (s.status === "COMPLETED") {
        const r = await getMotionJobResult(endpoint, requestId);
        return { state: "completed", videoUrl: r.videoUrl, videoBytes: r.videoBytes };
      }
      if (s.status === "FAILED") return { state: "failed", error: s.error || "Motion generation failed" };
      return { state: "pending" };
    }

    const model = AI_MODELS[job.model_id as ModelId];
    if (model?.provider === "fal") {
      const type = (job.type || "t2v") as GenerationType;
      const s = await getFalJobStatus(job.model_id as ModelId, ref, type);
      if (s.status === "COMPLETED") {
        const r = await getFalJobResult(job.model_id as ModelId, ref, type);
        return { state: "completed", videoUrl: r.videoUrl };
      }
      if (s.status === "FAILED") return { state: "failed", error: s.error || "Generation failed" };
      return { state: "pending" };
    }
  } catch (err) {
    // A transient provider error is not a verdict. Treat as still running so
    // the caller extends rather than refunds.
    console.warn(`[FINALIZER] Poll error for ${job.id}:`, err instanceof Error ? err.message : err);
    return { state: "pending" };
  }

  // RunPod-native jobs keep their existing webhook/poll path.
  return { state: "unsupported" };
}

/** Deliver a finished provider output: R2 → gallery row → completed (captures the hold). */
export async function finalizeHostedJob(
  job: HostedJobRow,
  output: { videoUrl?: string; videoBytes?: Uint8Array },
  opts: { source?: string } = {}
): Promise<string> {
  const vKey = videoStorageKey(job.user_id, job.id);

  let buffer: Buffer;
  if (output.videoBytes) {
    buffer = Buffer.from(output.videoBytes);
  } else {
    if (!output.videoUrl) throw new Error("Completed job had neither a video URL nor bytes");
    const res = await fetch(output.videoUrl);
    if (!res.ok) throw new Error(`Failed to download provider output: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  await uploadVideo(vKey, buffer);
  await verifyR2Upload(vKey);

  const db = getDb();
  // A previous attempt may already have created the gallery row.
  const { data: existing } = await db.from("videos").select("id, url").eq("job_id", job.id).maybeSingle();

  let videoApiUrl: string;
  if (existing) {
    videoApiUrl = existing.url.startsWith("/api/videos/") ? existing.url : `/api/videos/${existing.id}`;
  } else {
    const videoId = randomUUID();
    videoApiUrl = `/api/videos/${videoId}`;
    const thumbnailUrl = await extractAndUploadThumbnail(vKey, job.user_id, videoId).catch(() => "");
    await createVideo({
      id: videoId,
      userId: job.user_id,
      jobId: job.id,
      title: (job.prompt || "").slice(0, 100),
      url: videoApiUrl,
      thumbnailUrl,
      modelId: job.model_id as ModelId,
      prompt: job.prompt || "",
      resolution: job.resolution || "720p",
      duration: job.duration || 0,
      fps: job.fps || 24,
      fileSize: buffer.length,
      aspectRatio: (job.aspect_ratio || "landscape") as AspectRatio,
      audioUrl: job.audio_url || undefined,
      audioTrackId: job.audio_track_id || undefined,
    });
  }

  // Goes through updateJobStatus on purpose: that is where the hold is captured.
  await updateJobStatus(job.id, {
    status: "completed",
    progress: 100,
    outputVideoUrl: videoApiUrl,
    errorMessage: "",
    completedAt: new Date().toISOString(),
  });

  try {
    const { data: user } = await db.from("users").select("email, name").eq("id", job.user_id).single();
    if (user?.email) {
      const videoId = videoApiUrl.split("/").pop() || "";
      sendVideoReadyEmail(user.email, user.name || "Creator", videoId).catch(() => {});
    }
  } catch {
    // email is best-effort
  }

  console.log(`[FINALIZER] Delivered ${job.id} → ${videoApiUrl}${opts.source ? ` (${opts.source})` : ""}`);
  return videoApiUrl;
}

/** Give up on a job: failed status (releases the hold) + refund fallback for pre-escrow debits. */
export async function failHostedJob(job: HostedJobRow, message: string, code = "timeout"): Promise<void> {
  await updateJobStatus(job.id, {
    status: "failed",
    errorCode: code,
    errorMessage: message,
    completedAt: new Date().toISOString(),
  });
  // Idempotent per job; no-ops when the hold release above already returned the credits.
  if (job.credits_cost > 0) {
    await refundCredits(job.user_id, job.credits_cost, job.id, message);
  }
}

/**
 * Proactive sweep: finish any active hosted job the provider says is done,
 * fail any it says has failed. Runs every minute, so a customer who closed
 * the tab still gets their video within a minute of it rendering instead of
 * waiting for the 30-minute stuck-job pass.
 */
export async function sweepActiveHostedJobs(opts: { minAgeSec?: number; limit?: number } = {}) {
  const minAgeSec = opts.minAgeSec ?? 45;
  const limit = opts.limit ?? 25;
  const db = getDb();
  const cutoff = sqlTimestamp(new Date(Date.now() - minAgeSec * 1000));

  const { data: jobs } = await db
    .from("generation_jobs")
    .select(
      "id, user_id, model_id, type, runpod_job_id, credits_cost, prompt, resolution, duration, fps, aspect_ratio, audio_url, audio_track_id, created_at, status"
    )
    .in("status", ["queued", "processing"])
    .lt("created_at", cutoff)
    .limit(limit * 4);

  const summary = { checked: 0, delivered: 0, failed: 0, pending: 0 };
  const hosted = ((jobs || []) as HostedJobRow[])
    .filter((j) => !!j.runpod_job_id && (j.runpod_job_id.startsWith("ws:") || j.runpod_job_id.startsWith("fal:")))
    .filter((j) => !isToolJob(j))
    .filter((j) => jobAgeMs(j.created_at) >= minAgeSec * 1000)
    .slice(0, limit);
  for (const job of hosted) {
    summary.checked++;
    const poll = await pollHostedJob(job);
    try {
      if (poll.state === "completed") {
        await finalizeHostedJob(job, poll, { source: "sweep" });
        summary.delivered++;
      } else if (poll.state === "failed") {
        await failHostedJob(job, "Generation failed at the provider. Your credits have been returned.", "provider_failed");
        summary.failed++;
      } else {
        summary.pending++;
      }
    } catch (err) {
      console.error(`[FINALIZER] Sweep error for ${job.id}:`, err);
    }
  }
  return summary;
}

/**
 * Recover a specific job by id, whatever its current status. If it had
 * already been failed and refunded, the charge is reinstated on delivery —
 * the customer is getting the video they paid for, and the books must say so.
 */
export async function recoverJob(jobId: string): Promise<{ ok: boolean; message: string; videoUrl?: string }> {
  const db = getDb();
  const { data: job } = await db
    .from("generation_jobs")
    .select(
      "id, user_id, model_id, type, runpod_job_id, credits_cost, prompt, resolution, duration, fps, aspect_ratio, audio_url, audio_track_id, created_at, status, output_video_url"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, message: "Job not found" };
  if (job.status === "completed" && job.output_video_url) {
    return { ok: true, message: "Already delivered", videoUrl: job.output_video_url };
  }
  if (isToolJob(job)) return { ok: false, message: "Tool jobs are finalized by /api/tools/[jobId]" };

  const poll = await pollHostedJob(job as HostedJobRow);
  if (poll.state !== "completed") {
    return { ok: false, message: `Provider state: ${poll.state}${poll.state === "failed" ? ` (${poll.error})` : ""}` };
  }

  const wasRefunded = job.status === "failed";
  const videoUrl = await finalizeHostedJob(job as HostedJobRow, poll, { source: "recover" });

  if (wasRefunded && job.credits_cost > 0) {
    const { data: refund } = await db
      .from("credit_transactions")
      .select("id")
      .eq("job_id", job.id)
      .eq("type", "generation_refund")
      .limit(1);
    if (refund?.length) {
      const charged = await deductCredits(
        job.user_id,
        job.credits_cost,
        job.id,
        "Video delivered after recovery — earlier timeout refund reversed"
      );
      if (!charged.success) {
        console.warn(`[FINALIZER] Could not reinstate ${job.credits_cost} credits for ${job.id} (balance too low) — delivered anyway`);
      }
    }
  }

  return { ok: true, message: wasRefunded ? "Delivered; timeout refund reversed" : "Delivered", videoUrl };
}
