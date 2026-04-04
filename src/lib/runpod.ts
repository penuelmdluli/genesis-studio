// ============================================
// GENESIS STUDIO — RunPod Serverless Integration
// ============================================

import { ModelId, GenerationType, AspectRatio } from "@/types";

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

// Map model IDs to RunPod endpoint IDs
const ENDPOINT_MAP: Record<ModelId, string> = {
  "wan-2.2": process.env.RUNPOD_ENDPOINT_WAN22 || "",
  "hunyuan-video": process.env.RUNPOD_ENDPOINT_HUNYUAN || "",
  "ltx-video": process.env.RUNPOD_ENDPOINT_LTX || "",
  "wan-2.1-turbo": process.env.RUNPOD_ENDPOINT_WAN21_TURBO || "",
  "mochi-1": process.env.RUNPOD_ENDPOINT_MOCHI || "",
  "cogvideo-x": process.env.RUNPOD_ENDPOINT_COGVIDEO || "",
};

interface RunPodRunResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
}

interface RunPodStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    video_url?: string;
    thumbnail_url?: string;
  };
  error?: string;
  executionTime?: number;
}

async function runpodFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RunPod API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function submitRunPodJob(
  modelId: ModelId,
  input: Record<string, unknown>,
  webhookUrl?: string
): Promise<RunPodRunResponse> {
  const endpointId = ENDPOINT_MAP[modelId];
  if (!endpointId) {
    throw new Error(`No RunPod endpoint configured for model: ${modelId}`);
  }

  const payload: Record<string, unknown> = {
    input,
    ...(webhookUrl && { webhook: webhookUrl }),
  };

  return runpodFetch(`${RUNPOD_API_BASE}/${endpointId}/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRunPodJobStatus(
  modelId: ModelId,
  jobId: string
): Promise<RunPodStatusResponse> {
  const endpointId = ENDPOINT_MAP[modelId];
  if (!endpointId) {
    throw new Error(`No RunPod endpoint configured for model: ${modelId}`);
  }

  return runpodFetch(`${RUNPOD_API_BASE}/${endpointId}/status/${jobId}`);
}

export async function cancelRunPodJob(
  modelId: ModelId,
  jobId: string
): Promise<void> {
  const endpointId = ENDPOINT_MAP[modelId];
  if (!endpointId) {
    throw new Error(`No RunPod endpoint configured for model: ${modelId}`);
  }

  await runpodFetch(`${RUNPOD_API_BASE}/${endpointId}/cancel/${jobId}`, {
    method: "POST",
  });
}

// Convert resolution string to width/height, respecting aspect ratio
export function resolutionToSize(
  resolution: string,
  aspectRatio?: AspectRatio
): { width: number; height: number } {
  if (aspectRatio === "portrait") {
    // Vertical (9:16) for reels
    const sizes: Record<string, { width: number; height: number }> = {
      "480p": { width: 480, height: 854 },
      "720p": { width: 720, height: 1280 },
      "1080p": { width: 1080, height: 1920 },
    };
    return sizes[resolution] || sizes["720p"];
  }
  if (aspectRatio === "square") {
    const sizes: Record<string, { width: number; height: number }> = {
      "480p": { width: 480, height: 480 },
      "720p": { width: 720, height: 720 },
      "1080p": { width: 1080, height: 1080 },
    };
    return sizes[resolution] || sizes["720p"];
  }
  // Default: landscape (16:9)
  const sizes: Record<string, { width: number; height: number }> = {
    "480p": { width: 854, height: 480 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    "4k": { width: 3840, height: 2160 },
  };
  return sizes[resolution] || sizes["720p"];
}

// Convert duration + fps to number of frames
export function durationToFrames(duration: number, fps: number): number {
  return duration * fps;
}

export interface BuildRunPodInputParams {
  modelId: ModelId;
  type: GenerationType;
  prompt: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  inputVideoUrl?: string;
  resolution: string;
  duration: number;
  fps: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  isDraft?: boolean;
  aspectRatio?: AspectRatio;
}

// Build model-specific RunPod job input
// Each RunPod Hub template expects different field names/formats
export function buildRunPodInput(params: BuildRunPodInputParams): Record<string, unknown> {
  const { width, height } = resolutionToSize(params.resolution, params.aspectRatio);
  const numFrames = durationToFrames(params.duration, params.fps);
  const steps = params.numInferenceSteps ?? (params.isDraft ? 15 : 30);
  const guidance = params.guidanceScale ?? 7.5;

  switch (params.modelId) {
    case "wan-2.2":
      // ComfyUI workflow format — the RunPod endpoint runs a ComfyUI worker
      return {
        workflow: {
          "1": {
            class_type: "UNETLoader",
            inputs: { unet_name: "wan2.2_t2v_5B_fp16.safetensors", weight_dtype: "fp16" },
          },
          "2": {
            class_type: "CLIPLoader",
            inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan" },
          },
          "3": {
            class_type: "VAELoader",
            inputs: { vae_name: "wan2.2_vae.safetensors" },
          },
          "4": {
            class_type: "CLIPTextEncode",
            inputs: { text: params.prompt, clip: ["2", 0] },
          },
          "5": {
            class_type: "CLIPTextEncode",
            inputs: { text: params.negativePrompt || "blurry, low quality, distorted", clip: ["2", 0] },
          },
          "6": {
            class_type: "EmptyWanLatentVideo",
            inputs: { width, height, length: numFrames, batch_size: 1 },
          },
          "7": {
            class_type: "KSampler",
            inputs: {
              seed: params.seed ?? Math.floor(Math.random() * 2147483647),
              steps,
              cfg: guidance,
              sampler_name: "euler",
              scheduler: "normal",
              denoise: 1.0,
              model: ["1", 0],
              positive: ["4", 0],
              negative: ["5", 0],
              latent_image: ["6", 0],
            },
          },
          "8": {
            class_type: "VAEDecode",
            inputs: { samples: ["7", 0], vae: ["3", 0] },
          },
          "9": {
            class_type: "VHS_VideoCombine",
            inputs: {
              images: ["8", 0],
              frame_rate: params.fps,
              loop_count: 0,
              filename_prefix: "genesis",
              format: "video/h264-mp4",
              pingpong: false,
              save_output: true,
            },
          },
          // Include image/video inputs for i2v and motion control
          ...(params.inputImageUrl && {
            "10": {
              class_type: "LoadImage",
              inputs: { image: params.inputImageUrl },
            },
          }),
          ...(params.inputVideoUrl && {
            "11": {
              class_type: "VHS_LoadVideo",
              inputs: { video: params.inputVideoUrl, force_rate: params.fps, force_size: "Disabled" },
            },
          }),
        },
      };

    case "mochi-1":
      // Mochi Hub template uses positive_prompt / negative_prompt
      return {
        positive_prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        num_frames: Math.min(numFrames, 163), // Mochi max ~6.8s at 24fps
        num_inference_steps: Math.min(steps, 64),
        guidance_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
      };

    case "hunyuan-video":
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        video_length: numFrames,
        infer_steps: steps,
        cfg_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
        ...(params.inputImageUrl && { image_url: params.inputImageUrl }),
      };

    case "ltx-video":
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        num_frames: numFrames,
        num_inference_steps: steps,
        guidance_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
        ...(params.inputImageUrl && { image_url: params.inputImageUrl }),
        ...(params.inputVideoUrl && { video_url: params.inputVideoUrl }),
      };

    case "wan-2.1-turbo":
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        num_frames: numFrames,
        num_inference_steps: Math.min(steps, 12), // turbo uses fewer steps
        guidance_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
        ...(params.inputImageUrl && { image_url: params.inputImageUrl }),
      };

    case "cogvideo-x":
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        num_frames: Math.min(numFrames, 49), // CogVideoX max 49 frames
        num_inference_steps: steps,
        guidance_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
      };

    default:
      // Generic fallback
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        width,
        height,
        num_frames: numFrames,
        num_inference_steps: steps,
        guidance_scale: guidance,
        fps: params.fps,
        seed: params.seed ?? Math.floor(Math.random() * 2147483647),
      };
  }
}
