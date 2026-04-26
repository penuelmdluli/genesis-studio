// ============================================
// FAL Kling 2.6 Pro — Motion Control (I2V)
// Transfers motion from reference video onto
// a character image. One API call → complete video.
// ============================================

import { envString } from "@/lib/env";

const ENDPOINT = "fal-ai/kling-video/v2.6/pro/motion-control";
const QUEUE_BASE = "https://queue.fal.run";
const SYNC_BASE = "https://fal.run";

// Kling 2.6 Pro pricing: $0.07/s (no audio), $0.14/s (with audio)
const COST_PER_SEC_WITH_AUDIO = 0.14;
const COST_PER_SEC_NO_AUDIO = 0.07;

export interface KlingMotionInput {
  prompt: string;
  characterImageUrl: string;
  referenceVideoUrl: string;
  characterOrientation?: "video" | "image";
  keepOriginalSound?: boolean;
}

export interface KlingMotionOutput {
  videoUrl: string;
  requestId: string;
  fileSizeBytes: number;
  costUsd: number;
}

function getApiKey(): string {
  const key = envString("FAL_KEY");
  if (!key) throw new Error("FAL_KEY not configured");
  return key;
}

/**
 * Submit a motion control job to the FAL queue.
 * Returns immediately with a request ID for polling.
 */
export async function submitKlingMotion(input: KlingMotionInput): Promise<{ requestId: string; statusUrl?: string; responseUrl?: string }> {
  const res = await fetch(`${QUEUE_BASE}/${ENDPOINT}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      image_url: input.characterImageUrl,
      video_url: input.referenceVideoUrl,
      character_orientation: input.characterOrientation ?? "video",
      keep_original_sound: input.keepOriginalSound ?? true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling motion submit failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    request_id: string;
    status_url?: string;
    response_url?: string;
  };
  return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}

/**
 * Check job status on the FAL queue.
 * Uses the status_url from the submit response (FAL queue uses a
 * simplified path that drops the version/variant suffix).
 */
export async function getKlingMotionStatus(requestId: string): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  queuePosition?: number;
}> {
  // FAL queue status URL format: queue.fal.run/fal-ai/kling-video/requests/{id}/status
  const statusUrl = `${QUEUE_BASE}/fal-ai/kling-video/requests/${requestId}/status`;
  const res = await fetch(statusUrl, {
    headers: { Authorization: `Key ${getApiKey()}` },
  });
  if (!res.ok) throw new Error(`Kling status check failed: ${res.status} at ${statusUrl}`);
  const data = (await res.json()) as { status: string; queue_position?: number };
  return {
    status: data.status as "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED",
    queuePosition: data.queue_position,
  };
}

/**
 * Get the completed result from the FAL queue.
 */
export async function getKlingMotionResult(requestId: string): Promise<KlingMotionOutput> {
  const responseUrl = `${QUEUE_BASE}/fal-ai/kling-video/requests/${requestId}`;
  const res = await fetch(responseUrl, {
    headers: { Authorization: `Key ${getApiKey()}` },
  });
  if (!res.ok) throw new Error(`Kling result fetch failed: ${res.status} at ${responseUrl}`);
  const data = (await res.json()) as {
    video: { url: string; file_size?: number; content_type?: string };
  };

  if (!data.video?.url) throw new Error("Kling result missing video URL");

  // Estimate cost: ~5s reference → $0.70 with audio
  // File size ~20MB for 5s = ~4MB/s, so duration ≈ fileSize / 4MB
  const fileSizeBytes = data.video.file_size ?? 0;
  const estimatedDuration = fileSizeBytes > 0 ? Math.max(5, Math.round(fileSizeBytes / 4_000_000)) : 5;
  const costUsd = estimatedDuration * COST_PER_SEC_WITH_AUDIO;

  return {
    videoUrl: data.video.url,
    requestId,
    fileSizeBytes,
    costUsd,
  };
}

/**
 * Synchronous convenience: submit and wait for result.
 * Use only for tests, NOT in serverless functions.
 */
export async function generateKlingMotion(
  input: KlingMotionInput,
  timeoutMs = 10 * 60 * 1000
): Promise<KlingMotionOutput> {
  const res = await fetch(`${SYNC_BASE}/${ENDPOINT}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      image_url: input.characterImageUrl,
      video_url: input.referenceVideoUrl,
      character_orientation: input.characterOrientation ?? "video",
      keep_original_sound: input.keepOriginalSound ?? true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling motion generate failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    video: { url: string; file_size?: number };
  };

  const fileSizeBytes = data.video.file_size ?? 0;
  const estimatedDuration = fileSizeBytes > 0 ? Math.max(5, Math.round(fileSizeBytes / 4_000_000)) : 5;

  return {
    videoUrl: data.video.url,
    requestId: "sync",
    fileSizeBytes,
    costUsd: estimatedDuration * COST_PER_SEC_WITH_AUDIO,
  };
}
