// ============================================
// GENESIS STUDIO — FAL.AI Integration
// ============================================
// FAL.AI provides access to premium video models (Kling, Veo, Seedance)
// with native audio support (dialogue, sound effects, ambient sound).
// Uses async queue API to avoid Vercel function timeouts.

import { fal } from "@fal-ai/client";
import { ModelId } from "@/types";
import { AI_MODELS } from "@/lib/constants";

// Configure FAL client
fal.config({ credentials: process.env.FAL_KEY || "" });

interface FalSubmitResult {
  request_id: string;
  status: string;
}

interface FalStatusResult {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  progress?: number;
}

interface FalVideoResult {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
}

// Map aspect ratio to FAL format
function toFalAspectRatio(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "portrait": return "9:16";
    case "square": return "1:1";
    default: return "16:9";
  }
}

// Submit a video generation job to FAL.AI (async, returns request_id)
export async function submitFalJob(params: {
  modelId: ModelId;
  type: "t2v" | "i2v";
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  enableAudio?: boolean;
  seed?: number;
}): Promise<FalSubmitResult> {
  const model = AI_MODELS[params.modelId];
  if (!model || model.provider !== "fal") {
    throw new Error(`Model ${params.modelId} is not a FAL.AI model`);
  }

  const falModelId = params.type === "i2v" && model.falModelIdI2V
    ? model.falModelIdI2V
    : model.falModelId;

  if (!falModelId) {
    throw new Error(`No FAL.AI model ID configured for ${params.modelId} (${params.type})`);
  }

  // Build input based on model
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(params.duration || 10),
    aspect_ratio: toFalAspectRatio(params.aspectRatio),
  };

  // Add seed (-1 = random for FAL)
  if (params.seed !== undefined) {
    input.seed = params.seed;
  }

  // Add negative prompt if supported
  if (params.negativePrompt) {
    input.negative_prompt = params.negativePrompt;
  }

  // Audio flags (model-specific)
  if (model.hasAudio && params.enableAudio !== false) {
    if (params.modelId === "veo-3.1") {
      input.enable_audio = true;
    } else {
      // Kling models use native_audio
      input.native_audio = true;
    }
  }

  // Image for i2v
  if (params.type === "i2v" && params.imageUrl) {
    input.image_url = params.imageUrl;
  }

  console.log(`[FAL] Submitting to ${falModelId}: "${params.prompt.substring(0, 80)}..."`);

  // Use queue API for async (avoids Vercel timeout)
  const result = await fal.queue.submit(falModelId, { input });

  return {
    request_id: result.request_id,
    status: "IN_QUEUE",
  };
}

// Poll FAL.AI job status
export async function getFalJobStatus(
  modelId: ModelId,
  requestId: string,
  jobType?: string
): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  progress?: number;
  error?: string;
}> {
  const model = AI_MODELS[modelId];
  const falModelId = jobType === "i2v" && model?.falModelIdI2V
    ? model.falModelIdI2V
    : model?.falModelId;
  if (!falModelId) {
    throw new Error(`No FAL.AI model ID for ${modelId}`);
  }

  try {
    const status = await fal.queue.status(falModelId, {
      requestId,
      logs: false,
    });

    return {
      status: status.status as FalStatusResult["status"],
      progress: undefined,
    };
  } catch (err) {
    console.error("[FAL] Status check error:", err);
    return { status: "FAILED", error: String(err) };
  }
}

// Get completed FAL.AI job result
export async function getFalJobResult(
  modelId: ModelId,
  requestId: string,
  jobType?: string
): Promise<{ videoUrl: string; hasAudio: boolean }> {
  const model = AI_MODELS[modelId];
  const falModelId = jobType === "i2v" && model?.falModelIdI2V
    ? model.falModelIdI2V
    : model?.falModelId;
  if (!falModelId) {
    throw new Error(`No FAL.AI model ID for ${modelId}`);
  }

  const result = await fal.queue.result(falModelId, {
    requestId,
  });

  const data = result.data as FalVideoResult;

  if (!data?.video?.url) {
    throw new Error("No video URL in FAL.AI result");
  }

  return {
    videoUrl: data.video.url,
    hasAudio: model.hasAudio || false,
  };
}
