// ============================================
// GENESIS STUDIO — RunPod Serverless Integration
// ============================================

import { ModelId, GenerationType, AspectRatio } from "@/types";

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

// Map model IDs to RunPod endpoint IDs
// Only RunPod-hosted models need endpoint mappings
// FAL.AI models (kling, veo, seedance) are handled by src/lib/fal.ts
const ENDPOINT_MAP: Partial<Record<ModelId, string>> = {
  "wan-2.2": process.env.RUNPOD_ENDPOINT_WAN22 || "",
  "hunyuan-video": process.env.RUNPOD_ENDPOINT_HUNYUAN || "",
  "ltx-video": process.env.RUNPOD_ENDPOINT_LTX || "",
  "wan-2.1-turbo": process.env.RUNPOD_ENDPOINT_WAN21_TURBO || "",
  "mochi-1": process.env.RUNPOD_ENDPOINT_MOCHI || "",
  "cogvideo-x": process.env.RUNPOD_ENDPOINT_COGVIDEO || "",
  "mimic-motion": process.env.RUNPOD_ENDPOINT_MIMIC_MOTION || "",
};

// Wan 2.2 uses separate Hub endpoints for t2v vs i2v
const WAN22_I2V_ENDPOINT = process.env.RUNPOD_ENDPOINT_WAN22_I2V || "";

// Get the correct endpoint for a model, considering generation type
function getEndpointForModel(modelId: ModelId, type?: GenerationType): string {
  if (modelId === "wan-2.2" && (type === "i2v" || type === "motion")) {
    return WAN22_I2V_ENDPOINT || ENDPOINT_MAP["wan-2.2"] || "";
  }
  return ENDPOINT_MAP[modelId] || "";
}

interface RunPodRunResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
}

interface RunPodStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    video_url?: string;
    result?: string; // Hub endpoints return video URL as 'result'
    thumbnail_url?: string;
    cost?: number;
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
  webhookUrl?: string,
  type?: GenerationType
): Promise<RunPodRunResponse> {
  const endpointId = getEndpointForModel(modelId, type);
  if (!endpointId) {
    throw new Error(`No RunPod endpoint configured for model: ${modelId}`);
  }

  const payload: Record<string, unknown> = {
    input,
    ...(webhookUrl && { webhook: webhookUrl }),
  };

  // Log what we're sending to RunPod for debugging prompt delivery
  const promptPreview = typeof input.prompt === "string"
    ? input.prompt.substring(0, 100)
    : typeof input.positive_prompt === "string"
    ? input.positive_prompt.substring(0, 100)
    : input.prompt && typeof input.prompt === "object"
    ? `[ComfyUI workflow with ${Object.keys(input.prompt as object).length} nodes]`
    : "[unknown format]";
  console.log(`[RunPod] Submitting to ${endpointId}: ${promptPreview}`);

  return runpodFetch(`${RUNPOD_API_BASE}/${endpointId}/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRunPodJobStatus(
  modelId: ModelId,
  jobId: string,
  type?: GenerationType
): Promise<RunPodStatusResponse> {
  const endpointId = getEndpointForModel(modelId, type);
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
    case "wan-2.2": {
      // RunPod Hub public endpoints: wan-2-2-t2v-720 and wan-2-2-i2v-720-lora
      // Hub constraints: size must be "1280*720" or "720*1280", duration must be 5 or 8
      const hubSize = params.aspectRatio === "portrait" ? "720*1280" : "1280*720";
      const hubDuration = params.duration <= 5 ? 5 : 8;

      if (params.type === "i2v" && params.inputImageUrl) {
        // Image-to-video: wan-2-2-i2v-720-lora endpoint
        return {
          prompt: params.prompt,
          image: params.inputImageUrl,
          high_noise_loras: [],
          low_noise_loras: [],
          duration: hubDuration,
          seed: params.seed ?? -1,
          enable_safety_checker: false,
        };
      }
      // Text-to-video: wan-2-2-t2v-720 endpoint
      return {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "blurry, low quality, distorted, watermark",
        num_inference_steps: params.isDraft ? 15 : steps,
        guidance: guidance,
        size: hubSize,
        duration: hubDuration,
        flow_shift: 5,
        seed: params.seed ?? -1,
        enable_prompt_optimization: true,
        enable_safety_checker: false,
      };
    }

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
      // ComfyUI workflow format for Hunyuan Video worker
      return {
        prompt: {
          "1": {
            class_type: "HunyuanVideoSampler",
            inputs: {
              prompt: params.prompt,
              negative_prompt: params.negativePrompt || "blurry, low quality, distorted",
              width,
              height,
              video_length: numFrames,
              infer_steps: steps,
              cfg_scale: guidance,
              seed: params.seed ?? Math.floor(Math.random() * 2147483647),
              embedded_guidance_scale: 6.0,
            },
          },
          "2": {
            class_type: "VHS_VideoCombine",
            inputs: {
              images: ["1", 0],
              frame_rate: params.fps,
              loop_count: 0,
              filename_prefix: "genesis_hunyuan",
              format: "video/h264-mp4",
              pingpong: false,
              save_output: true,
            },
          },
          ...(params.inputImageUrl && {
            "3": {
              class_type: "LoadImage",
              inputs: { image: params.inputImageUrl },
            },
          }),
        },
      };

    case "ltx-video":
      // ComfyUI workflow format for LTX Video worker
      return {
        prompt: {
          "1": {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: "ltx-video-2b-v0.9.safetensors" },
          },
          "2": {
            class_type: "CLIPTextEncode",
            inputs: { text: params.prompt, clip: ["1", 1] },
          },
          "3": {
            class_type: "CLIPTextEncode",
            inputs: { text: params.negativePrompt || "blurry, low quality, distorted", clip: ["1", 1] },
          },
          "4": {
            class_type: "EmptyLatentImage",
            inputs: { width, height, batch_size: numFrames },
          },
          "5": {
            class_type: "KSampler",
            inputs: {
              seed: params.seed ?? Math.floor(Math.random() * 2147483647),
              steps,
              cfg: guidance,
              sampler_name: "euler",
              scheduler: "normal",
              denoise: 1.0,
              model: ["1", 0],
              positive: ["2", 0],
              negative: ["3", 0],
              latent_image: ["4", 0],
            },
          },
          "6": {
            class_type: "VAEDecode",
            inputs: { samples: ["5", 0], vae: ["1", 2] },
          },
          "7": {
            class_type: "VHS_VideoCombine",
            inputs: {
              images: ["6", 0],
              frame_rate: params.fps,
              loop_count: 0,
              filename_prefix: "genesis_ltx",
              format: "video/h264-mp4",
              pingpong: false,
              save_output: true,
            },
          },
          ...(params.inputImageUrl && {
            "8": {
              class_type: "LoadImage",
              inputs: { image: params.inputImageUrl },
            },
          }),
          ...(params.inputVideoUrl && {
            "9": {
              class_type: "VHS_LoadVideo",
              inputs: { video: params.inputVideoUrl, force_rate: params.fps, force_size: "Disabled" },
            },
          }),
        },
      };

    case "wan-2.1-turbo":
      // ComfyUI workflow format — similar to Wan 2.2 but with turbo checkpoint and fewer steps
      return {
        prompt: {
          "1": {
            class_type: "UNETLoader",
            inputs: { unet_name: "wan2.1_t2v_turbo_fp16.safetensors", weight_dtype: "fp16" },
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
              steps: Math.min(steps, 12),
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
              filename_prefix: "genesis_wan21turbo",
              format: "video/h264-mp4",
              pingpong: false,
              save_output: true,
            },
          },
          ...(params.inputImageUrl && {
            "10": {
              class_type: "LoadImage",
              inputs: { image: params.inputImageUrl },
            },
          }),
        },
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

    case "mimic-motion":
      // MimicMotion — EngUI ComfyUI worker (wlsdml1114/engui_mimicmotion)
      // Extracts pose from reference video via DWPose, applies to character image using SVD
      return {
        prompt: {
          "1": {
            class_type: "LoadImage",
            inputs: {
              image: params.inputImageUrl,  // Character reference image (appearance)
            },
          },
          "2": {
            class_type: "VHS_LoadVideo",
            inputs: {
              video: params.inputVideoUrl,  // Motion reference video (pose source)
              force_rate: params.fps,
              force_size: "Disabled",
            },
          },
          "3": {
            class_type: "DWPose",
            inputs: {
              images: ["2", 0],  // Extract pose from motion video
            },
          },
          "4": {
            class_type: "MimicMotionSampler",
            inputs: {
              ref_image: ["1", 0],       // Character appearance
              pose_images: ["3", 0],     // Extracted pose sequence
              width,
              height,
              num_frames: numFrames,
              frames_overlap: 6,
              num_inference_steps: Math.min(steps, 25),
              guidance_scale: guidance,
              noise_aug_strength: 0.0625,
              sample_stride: 2,
              fps: params.fps,
              seed: params.seed ?? Math.floor(Math.random() * 2147483647),
            },
          },
          "5": {
            class_type: "VHS_VideoCombine",
            inputs: {
              images: ["4", 0],
              frame_rate: params.fps,
              loop_count: 0,
              filename_prefix: "genesis_mimicmotion",
              format: "video/h264-mp4",
              pingpong: false,
              save_output: true,
            },
          },
        },
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
