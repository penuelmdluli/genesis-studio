// ============================================
// GENESIS STUDIO — RunPod ComfyUI Provider
// ============================================
// Sends Wan 2.2 video generation jobs to a RunPod Serverless
// endpoint running the ComfyUI worker (runpod-worker-comfy).
//
// The worker accepts a full ComfyUI API-format workflow JSON.
// This adapter builds the workflow with injected parameters
// (prompt, seed, dimensions) and handles submit → poll → result.
//
// Cost: ~$0.04-0.06 per 5s video on A100 80GB serverless.

import { z } from "zod";

// --- RunPod API response schemas ---

const SubmitResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const StatusResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]),
  output: z.unknown().optional(),
  error: z.string().nullable().optional(),
  executionTime: z.number().optional(),
  delayTime: z.number().optional(),
});

// --- Types ---

export interface RunPodComfyInput {
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number; // default 5
  width?: number;
  height?: number;
  seed?: number;
  aspectRatio?: "landscape" | "portrait" | "square";
}

export interface RunPodComfyResult {
  videoUrl: string;
  jobId: string;
  durationSeconds: number;
  elapsedMs: number;
  executionMs: number;
  costUsd: number;
}

// --- Constants ---

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";
const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 5 * 60 * 1_000;
// A100 80GB serverless rate; override via RUNPOD_COMFYUI_GPU_RATE
const DEFAULT_GPU_RATE = 1.89;

// --- Helpers ---

function getConfig() {
  const apiKey = process.env.RUNPOD_COMFYUI_API_KEY || process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_COMFYUI_ENDPOINT_ID;
  return { apiKey: apiKey || null, endpointId: endpointId || null };
}

/** Check if the RunPod ComfyUI endpoint is configured and enabled */
export function isRunPodComfyUIAvailable(): boolean {
  if (process.env.COMFYUI_PROVIDER_ENABLED !== "true") return false;
  const { apiKey, endpointId } = getConfig();
  if (!apiKey || !endpointId) {
    console.warn("[RunPod-ComfyUI] Skipped — missing API key or endpoint ID");
    return false;
  }
  return true;
}

/** Check if a user tier should route to RunPod ComfyUI */
export function shouldUseRunPodComfyUI(userPlan: string): boolean {
  if (!isRunPodComfyUIAvailable()) return false;
  const tiers = (process.env.COMFYUI_TIER_ROUTING ?? "free,creator").split(",").map(s => s.trim());
  return tiers.includes(userPlan);
}

function resolveResolution(aspectRatio?: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "portrait": return { width: 720, height: 1280 };
    case "square": return { width: 720, height: 720 };
    default: return { width: 1280, height: 720 };
  }
}

/**
 * Build a complete ComfyUI API-format workflow JSON with injected parameters.
 * This matches the node IDs in infra/runpod-comfyui/workflows/wan22-t2v.json.
 */
function buildWorkflow(opts: {
  prompt: string;
  negativePrompt: string;
  seed: number;
  width: number;
  height: number;
  frameCount: number;
}): Record<string, unknown> {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: opts.seed,
        steps: 25,
        cfg: 7.0,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1.0,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "WanVideoModelLoader",
      inputs: {
        model: "wan2.2_t2v_14B_fp8_e4m3fn.safetensors",
        base_precision: "fp8_e4m3fn",
        quantization: "fp8_e4m3fn",
      },
    },
    "5": {
      class_type: "WanVideoEmptyLatent",
      inputs: {
        width: opts.width,
        height: opts.height,
        length: opts.frameCount,
        batch_size: 1,
      },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: opts.prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: opts.negativePrompt, clip: ["4", 1] },
    },
    "8": {
      class_type: "WanVideoDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "VHS_VideoCombine",
      inputs: {
        images: ["8", 0],
        frame_rate: 16,
        format: "video/h264-mp4",
        crf: 19,
        save_output: true,
        filename_prefix: "genesis_wan22",
      },
    },
  };
}

/**
 * Extract video URL from RunPod ComfyUI worker output.
 *
 * The worker returns output in one of these shapes:
 * - { images: [{ url: "..." }] } (S3 mode)
 * - { images: [{ data: "base64...", filename: "..." }] } (base64 mode)
 * - { message: "..." } (error or info)
 *
 * For video workflows, VHS_VideoCombine produces video files that
 * appear in the images array (ComfyUI treats all outputs as "images").
 */
function extractOutputUrl(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;

  // S3 URL mode (preferred — configured via worker env vars)
  if (Array.isArray(o.images)) {
    for (const img of o.images) {
      if (typeof img === "object" && img !== null) {
        const item = img as Record<string, unknown>;
        if (typeof item.url === "string") return item.url;
      }
    }
  }

  // Direct URL in message (some worker versions)
  if (typeof o.message === "string" && o.message.startsWith("http")) {
    return o.message;
  }

  return null;
}

/**
 * Submit a Wan 2.2 video generation job to RunPod ComfyUI
 * and poll until completion. Returns the video URL.
 *
 * Blocking call — up to 5 minutes. Use with maxDuration=300.
 */
export async function submitRunPodComfyUIJob(
  input: RunPodComfyInput
): Promise<RunPodComfyResult> {
  const { apiKey, endpointId } = getConfig();
  if (!apiKey || !endpointId) {
    throw new Error("RunPod ComfyUI not configured: missing API key or endpoint ID");
  }

  const { width, height } = input.width && input.height
    ? { width: input.width, height: input.height }
    : resolveResolution(input.aspectRatio);

  const frameCount = (input.durationSeconds ?? 5) * 16;
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const negativePrompt = input.negativePrompt ?? "blurry, low quality, deformed, watermark, text, ugly";

  const workflow = buildWorkflow({ prompt: input.prompt, negativePrompt, seed, width, height, frameCount });

  // Step 1: Submit
  const baseUrl = `${RUNPOD_API_BASE}/${endpointId}`;
  const submitRes = await fetch(`${baseUrl}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { workflow },
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`RunPod ComfyUI submit failed (${submitRes.status}): ${errText}`);
  }

  const submitData = SubmitResponseSchema.parse(await submitRes.json());
  const jobId = submitData.id;
  console.log(`[RunPod-ComfyUI] Job submitted: ${jobId}`);

  // Step 2: Poll
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let statusData: z.infer<typeof StatusResponseSchema>;
    try {
      const statusRes = await fetch(`${baseUrl}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) {
        console.warn(`[RunPod-ComfyUI] Poll error ${statusRes.status}, retrying...`);
        continue;
      }
      statusData = StatusResponseSchema.parse(await statusRes.json());
    } catch (err) {
      console.warn(`[RunPod-ComfyUI] Poll parse error: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    if (statusData.status === "COMPLETED") {
      const videoUrl = extractOutputUrl(statusData.output);
      if (!videoUrl) {
        throw new Error(
          `RunPod ComfyUI job ${jobId} completed but no video URL. Output: ${JSON.stringify(statusData.output).slice(0, 500)}`
        );
      }

      const elapsedMs = Date.now() - startTime;
      const executionMs = statusData.executionTime ?? elapsedMs;
      const gpuRate = parseFloat(process.env.RUNPOD_COMFYUI_GPU_RATE ?? String(DEFAULT_GPU_RATE));
      const costUsd = (executionMs / 1000 / 3600) * gpuRate;

      console.log(
        `[RunPod-ComfyUI] Job ${jobId} completed in ${(elapsedMs / 1000).toFixed(1)}s ` +
        `(GPU: ${(executionMs / 1000).toFixed(1)}s, $${costUsd.toFixed(4)})`
      );

      return { videoUrl, jobId, durationSeconds: input.durationSeconds ?? 5, elapsedMs, executionMs, costUsd };
    }

    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(statusData.status)) {
      throw new Error(
        `RunPod ComfyUI job ${jobId} ${statusData.status}: ${statusData.error ?? "unknown error"}`
      );
    }
  }

  // Timeout — cancel the job (best effort)
  fetch(`${baseUrl}/cancel/${jobId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => {});

  throw new Error(`RunPod ComfyUI job ${jobId} exceeded ${TIMEOUT_MS / 1000}s timeout`);
}
