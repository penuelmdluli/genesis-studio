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
import { envFlag, envString, envNumber } from "./env";

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
  const apiKey = envString("RUNPOD_COMFYUI_API_KEY") || envString("RUNPOD_API_KEY");
  const endpointId = envString("RUNPOD_COMFYUI_ENDPOINT_ID");
  return { apiKey: apiKey || null, endpointId: endpointId || null };
}

/** Check if the RunPod ComfyUI endpoint is configured and enabled */
export function isRunPodComfyUIAvailable(): boolean {
  if (!envFlag("COMFYUI_PROVIDER_ENABLED")) return false;
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
  const routing = envString("COMFYUI_TIER_ROUTING") ?? "free,creator";
  const tiers = routing.split(",").map(s => s.trim());
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

interface ExtractedOutput {
  url?: string;
  base64Data?: string;
  filename?: string;
}

/**
 * Extract video/image output from RunPod ComfyUI worker response.
 *
 * The worker returns output in one of these shapes:
 * - { images: [{ url: "..." }] } — S3 mode (URL ready to download)
 * - { images: [{ data: "base64...", type: "base64", filename: "..." }] } — base64 mode
 * - { message: "..." } — error or info string
 */
function extractOutput(output: unknown): ExtractedOutput | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;

  if (Array.isArray(o.images)) {
    for (const img of o.images) {
      if (typeof img !== "object" || img === null) continue;
      const item = img as Record<string, unknown>;
      // S3 URL mode
      if (typeof item.url === "string") {
        return { url: item.url, filename: item.filename as string | undefined };
      }
      // Base64 mode
      if (typeof item.data === "string" && item.data.length > 100) {
        return { base64Data: item.data, filename: item.filename as string | undefined };
      }
    }
  }

  // Direct URL in message
  if (typeof o.message === "string" && o.message.startsWith("http")) {
    return { url: o.message };
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
      const extracted = extractOutput(statusData.output);
      if (!extracted) {
        throw new Error(
          `RunPod ComfyUI job ${jobId} completed but no output found. Raw: ${JSON.stringify(statusData.output).slice(0, 500)}`
        );
      }

      let videoUrl: string;

      if (extracted.url) {
        videoUrl = extracted.url;
      } else if (extracted.base64Data) {
        // Base64 mode: upload to R2 directly
        const { uploadVideo } = await import("@/lib/storage");
        const buffer = Buffer.from(extracted.base64Data, "base64");
        const ext = extracted.filename?.endsWith(".mp4") ? "mp4" : extracted.filename?.endsWith(".png") ? "png" : "mp4";
        const key = `comfyui/${jobId}.${ext}`;
        videoUrl = await uploadVideo(key, buffer, ext === "png" ? "image/png" : "video/mp4");
        console.log(`[RunPod-ComfyUI] Base64 output uploaded to R2: ${key} (${buffer.length} bytes)`);
      } else {
        throw new Error(`RunPod ComfyUI job ${jobId}: output has neither URL nor base64 data`);
      }

      const elapsedMs = Date.now() - startTime;
      const executionMs = statusData.executionTime ?? elapsedMs;
      const gpuRate = envNumber("RUNPOD_COMFYUI_GPU_RATE", DEFAULT_GPU_RATE);
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

/**
 * Submit a ComfyUI job asynchronously with webhook callback.
 * Returns immediately with the jobId — no polling.
 * RunPod will POST to webhookUrl when the job completes.
 *
 * Also inserts a tracking row into comfyui_jobs table.
 */
export async function submitRunPodComfyUIJobAsync(
  input: RunPodComfyInput & {
    userId?: string;
    productionId?: string;
    sceneId?: string;
  }
): Promise<{ jobId: string }> {
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

  // Build webhook URL
  const appUrl = envString("APP_URL") || envString("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/webhooks/runpod-comfyui`;

  // Submit with webhook — RunPod will call back when done
  const baseUrl = `${RUNPOD_API_BASE}/${endpointId}`;
  const submitRes = await fetch(`${baseUrl}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { workflow },
      webhook: webhookUrl,
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`RunPod ComfyUI submit failed (${submitRes.status}): ${errText}`);
  }

  const submitData = SubmitResponseSchema.parse(await submitRes.json());
  const jobId = submitData.id;

  // Insert tracking row
  const { createSupabaseAdmin } = await import("@/lib/supabase");
  const supabase = createSupabaseAdmin();
  await supabase.from("comfyui_jobs").insert({
    user_id: input.userId || null,
    production_id: input.productionId || null,
    scene_id: input.sceneId || null,
    provider: "runpod-comfyui",
    runpod_job_id: jobId,
    status: "pending",
    prompt: input.prompt?.slice(0, 500),
  });

  console.log(`[RunPod-ComfyUI] Async job submitted: ${jobId} (webhook: ${webhookUrl})`);
  return { jobId };
}
