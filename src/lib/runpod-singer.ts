// ============================================
// GENESIS STUDIO — RunPod AI Singer Integration
// ============================================
// Self-hosted ACE-Step (song gen) + SadTalker (lip-sync)
// on RunPod Serverless. 10-20x cheaper than FAL/Kling.

import { envString } from "@/lib/env";

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

function getApiKey(): string {
  const key = envString("RUNPOD_API_KEY");
  if (!key) throw new Error("RUNPOD_API_KEY not configured");
  return key;
}

function getAceStepEndpoint(): string {
  const ep = envString("RUNPOD_ENDPOINT_ACE_STEP");
  if (!ep) throw new Error("RUNPOD_ENDPOINT_ACE_STEP not configured");
  return ep;
}

function getSadTalkerEndpoint(): string {
  const ep = envString("RUNPOD_ENDPOINT_SADTALKER");
  if (!ep) throw new Error("RUNPOD_ENDPOINT_SADTALKER not configured");
  return ep;
}

interface RunPodResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
}

interface RunPodStatusResponse extends RunPodResponse {
  output?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
}

async function rpFetch(url: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RunPod API error: ${res.status} - ${err}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ── ACE-Step (Song Generation) ─────────────────────────────────

export async function submitAceStepJob(input: {
  tags: string;
  lyrics: string;
  duration: number;
  num_steps?: number;
  lyric_guidance_scale?: number;
  scheduler?: string;
  seed?: number;
}): Promise<string> {
  const endpoint = getAceStepEndpoint();
  const result = await rpFetch(`${RUNPOD_API_BASE}/${endpoint}/run`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        tags: input.tags,
        lyrics: input.lyrics,
        duration: input.duration,
        num_steps: input.num_steps ?? 40,
        lyric_guidance_scale: input.lyric_guidance_scale ?? 2.5,
        scheduler: input.scheduler ?? "euler",
        seed: input.seed ?? -1,
      },
    }),
  });
  const id = result.id as string;
  console.log(`[RunPod ACE-Step] Submitted: ${id}`);
  return id;
}

export async function getAceStepStatus(jobId: string): Promise<RunPodStatusResponse> {
  const endpoint = getAceStepEndpoint();
  return rpFetch(`${RUNPOD_API_BASE}/${endpoint}/status/${jobId}`) as unknown as Promise<RunPodStatusResponse>;
}

/**
 * Extract audio from ACE-Step result.
 * Returns base64 audio or a URL depending on handler output.
 */
export function extractAceStepAudio(output: Record<string, unknown>): {
  audioBase64?: string;
  audioUrl?: string;
  sampleRate: number;
  format: string;
} {
  return {
    audioBase64: output.audio_base64 as string | undefined,
    audioUrl: output.audio_url as string | undefined,
    sampleRate: (output.sample_rate as number) || 44100,
    format: (output.format as string) || "wav",
  };
}

// ── SadTalker (Lip-Sync Video) ─────────────────────────────────

export async function submitSadTalkerJob(input: {
  faceImageUrl: string;
  audioUrl: string;
  preprocess?: string;
  stillMode?: boolean;
  enhancer?: string;
}): Promise<string> {
  const endpoint = getSadTalkerEndpoint();
  const result = await rpFetch(`${RUNPOD_API_BASE}/${endpoint}/run`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        face_image_url: input.faceImageUrl,
        audio_url: input.audioUrl,
        preprocess: input.preprocess ?? "crop",
        still_mode: input.stillMode ?? false,
        enhancer: input.enhancer ?? "gfpgan",
      },
    }),
  });
  const id = result.id as string;
  console.log(`[RunPod SadTalker] Submitted: ${id}`);
  return id;
}

export async function getSadTalkerStatus(jobId: string): Promise<RunPodStatusResponse> {
  const endpoint = getSadTalkerEndpoint();
  return rpFetch(`${RUNPOD_API_BASE}/${endpoint}/status/${jobId}`) as unknown as Promise<RunPodStatusResponse>;
}

/**
 * Extract video from SadTalker result.
 * Returns base64 video.
 */
export function extractSadTalkerVideo(output: Record<string, unknown>): {
  videoBase64?: string;
  videoUrl?: string;
  fileSize: number;
} {
  return {
    videoBase64: output.video_base64 as string | undefined,
    videoUrl: output.video_url as string | undefined,
    fileSize: (output.file_size as number) || 0,
  };
}
