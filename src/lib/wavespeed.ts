// ============================================
// GENESIS STUDIO — WaveSpeed AI Integration
// ============================================
// WaveSpeed provides cheaper access to premium video models
// (Kling, Veo, Seedance) via a unified REST API.
// Used as primary provider for video gen; FAL.AI as fallback.

import { ModelId } from "@/types";
import { AI_MODELS } from "@/lib/constants";
import { envString } from "@/lib/env";

const API_BASE = "https://api.wavespeed.ai/api/v3";

function getApiKey(): string {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) throw new Error("WAVESPEED_API_KEY not configured");
  return key;
}

export interface WavespeedSubmitResult {
  request_id: string;
  status: string;
}

interface WavespeedPrediction {
  id: string;
  model: string;
  status: "created" | "processing" | "completed" | "failed";
  outputs?: string[];
  has_nsfw_contents?: boolean[];
  created_at?: string;
  urls?: { get: string };
  error?: string;
}

// WaveSpeed wraps responses in { code, message, data: {...} }
interface WavespeedApiResponse {
  code: number;
  message: string;
  data: WavespeedPrediction;
}

// Map aspect ratio to WaveSpeed format
function toWavespeedAspectRatio(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "portrait": return "9:16";
    case "square": return "1:1";
    default: return "16:9";
  }
}

// Build model-specific request body
function buildRequestBody(params: {
  modelId: ModelId;
  type: "t2v" | "i2v";
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  enableAudio?: boolean;
  seed?: number;
}): Record<string, unknown> {
  const isKling = params.modelId.startsWith("kling-");
  const isVeo = params.modelId === "veo-3.1";
  const isSeedance = params.modelId === "seedance-1.5";
  const model = AI_MODELS[params.modelId];

  if (isKling) {
    // Kling uses "sound" boolean and "cfg_scale"
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      duration: params.duration || 5,
      aspect_ratio: toWavespeedAspectRatio(params.aspectRatio),
      cfg_scale: 0.5,
      sound: model.hasAudio && params.enableAudio !== false,
    };
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
    if (params.seed !== undefined && params.seed !== -1) body.seed = params.seed;
    if (params.type === "i2v" && params.imageUrl) {
      body.image = params.imageUrl;
    }
    return body;
  }

  if (isVeo) {
    // Veo 3.1 uses "generate_audio", "resolution", and "duration" (4/6/8)
    return {
      prompt: params.prompt,
      aspect_ratio: toWavespeedAspectRatio(params.aspectRatio),
      duration: Math.min(params.duration || 8, 8),
      resolution: "1080p",
      generate_audio: model.hasAudio && params.enableAudio !== false,
      ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
      ...(params.seed !== undefined && params.seed !== -1 && { seed: params.seed }),
    };
  }

  if (isSeedance) {
    // Seedance uses "generate_audio", "resolution", "camera_fixed"
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: toWavespeedAspectRatio(params.aspectRatio),
      duration: params.duration || 5,
      resolution: "720p",
      generate_audio: false, // Seedance 1.5 has no native audio
      camera_fixed: false,
      seed: params.seed ?? -1,
    };
    if (params.type === "i2v" && params.imageUrl) {
      body.image = params.imageUrl;
    }
    return body;
  }

  // Generic fallback
  return {
    prompt: params.prompt,
    duration: params.duration || 5,
    aspect_ratio: toWavespeedAspectRatio(params.aspectRatio),
    ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
    ...(params.imageUrl && params.type === "i2v" && { image: params.imageUrl }),
  };
}

// Submit a video generation job to WaveSpeed (async, returns prediction ID)
export async function submitWavespeedJob(params: {
  modelId: ModelId;
  type: "t2v" | "i2v";
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  enableAudio?: boolean;
  seed?: number;
}): Promise<WavespeedSubmitResult> {
  const model = AI_MODELS[params.modelId];
  if (!model) throw new Error(`Unknown model: ${params.modelId}`);

  const wavespeedModelId = params.type === "i2v" && model.wavespeedModelIdI2V
    ? model.wavespeedModelIdI2V
    : model.wavespeedModelId;

  if (!wavespeedModelId) {
    throw new Error(`No WaveSpeed model ID configured for ${params.modelId} (${params.type})`);
  }

  const body = buildRequestBody(params);

  console.log(`[WAVESPEED] Submitting to ${wavespeedModelId}: "${params.prompt.substring(0, 80)}..."`);

  const res = await fetch(`${API_BASE}/${wavespeedModelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WaveSpeed submit failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as WavespeedApiResponse;
  const data = json.data;

  return {
    request_id: data.id,
    status: data.status || "created",
  };
}

// Poll WaveSpeed job status
export async function getWavespeedJobStatus(
  requestId: string
): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/predictions/${requestId}/result`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    // 404 usually means still processing
    if (res.status === 404) {
      return { status: "IN_QUEUE" };
    }
    return { status: "FAILED", error: `Status check failed: ${res.status}` };
  }

  const json = (await res.json()) as WavespeedApiResponse;
  const data = json.data;

  // Map WaveSpeed statuses to our internal format
  switch (data.status) {
    case "completed":
      return { status: "COMPLETED" };
    case "failed":
      return { status: "FAILED", error: data.error || "WaveSpeed generation failed" };
    case "processing":
      return { status: "IN_PROGRESS" };
    default:
      return { status: "IN_QUEUE" };
  }
}

// Get completed WaveSpeed job result
export async function getWavespeedJobResult(
  requestId: string
): Promise<{ videoUrl: string; hasAudio: boolean }> {
  const res = await fetch(`${API_BASE}/predictions/${requestId}/result`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    throw new Error(`WaveSpeed result fetch failed: ${res.status}`);
  }

  const json = (await res.json()) as WavespeedApiResponse;
  const data = json.data;

  if (data.status !== "completed" || !data.outputs?.length) {
    throw new Error("WaveSpeed result not ready or missing outputs");
  }

  const videoUrl = data.outputs[0];
  if (!videoUrl) {
    throw new Error("No video URL in WaveSpeed result");
  }

  return {
    videoUrl,
    hasAudio: true, // WaveSpeed models with audio enabled return audio in the video
  };
}
