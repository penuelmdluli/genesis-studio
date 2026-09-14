// ============================================
// GENESIS STUDIO — WaveSpeed generic model runner
// ============================================
// `wavespeed.ts` knows about video models by our ModelId. This file is the
// thin layer under every other tool — captions, thumbnails, upscaling, lip
// sync, music, dubbing, background removal — where the caller already knows
// the exact model slug and input shape.
//
// Why WaveSpeed for all of them: it is the one hosted provider with a funded
// balance, it publishes a balance endpoint we can alert on, and its catalog
// has a model for everything the menu advertises. Every FAL-only tool was
// dark for months behind a 403 while the sidebar still listed it.

import { envString } from "@/lib/env";

const API_BASE = "https://api.wavespeed.ai/api/v3";

function apiKey(): string {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) throw new Error("WAVESPEED_API_KEY not configured");
  return key;
}

export interface WsPrediction {
  id: string;
  model: string;
  status: "created" | "processing" | "completed" | "failed";
  outputs?: string[];
  error?: string;
  /** Some models (whisper, captioners) return structured data here. */
  [extra: string]: unknown;
}

interface WsEnvelope {
  code: number;
  message: string;
  data: WsPrediction;
}

/** Submit a job. Returns the prediction id to poll. */
export async function submitWsModel(
  modelId: string,
  input: Record<string, unknown>
): Promise<WsPrediction> {
  const res = await fetch(`${API_BASE}/${modelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WaveSpeed ${modelId} submit failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as WsEnvelope;
  if (!json.data?.id) throw new Error(`WaveSpeed ${modelId} returned no prediction id`);
  return json.data;
}

/** Fetch the current state of a prediction. */
export async function getWsPrediction(id: string): Promise<WsPrediction> {
  const res = await fetch(`${API_BASE}/predictions/${id}/result`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (res.status === 404) {
    // Not indexed yet — treat as still queued.
    return { id, model: "", status: "created" };
  }
  if (!res.ok) throw new Error(`WaveSpeed poll failed (${res.status})`);
  const json = (await res.json()) as WsEnvelope;
  return json.data;
}

/**
 * Block until a prediction finishes, for fast models (images, transcripts,
 * background removal — seconds, not minutes). Anything slower should go
 * through a job row and be polled by the client.
 */
export async function runWsModelSync(
  modelId: string,
  input: Record<string, unknown>,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<WsPrediction> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 1500;

  // Models that support it can answer in the submit response itself.
  const first = await submitWsModel(modelId, { ...input, enable_sync_mode: true });
  if (first.status === "completed") return first;
  if (first.status === "failed") throw new Error(first.error || `${modelId} failed`);

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const p = await getWsPrediction(first.id);
    if (p.status === "completed") return p;
    if (p.status === "failed") throw new Error(p.error || `${modelId} failed`);
  }
  throw new Error(`${modelId} timed out after ${Math.round(timeoutMs / 1000)}s`);
}

/** Map a prediction's state to the three-way status the job poller uses. */
export function wsStatusOf(p: WsPrediction): "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" {
  switch (p.status) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "processing":
      return "IN_PROGRESS";
    default:
      return "IN_QUEUE";
  }
}

/** Prefix so /api/jobs/[id] knows to poll WaveSpeed for this job. */
export function wsJobRef(predictionId: string): string {
  return `ws:${predictionId}`;
}

/**
 * Model slugs used by the tools, in one place. Verified against the live
 * catalog on 2026-09-12 (prices are WaveSpeed's base price per call).
 */
export const WS_MODELS = {
  // Photo + audio → talking video with lip sync.            $0.075
  lipsyncFromImage: "wavespeed-ai/infinitetalk-fast",
  // Video + audio → re-lipsynced video.                     $0.05
  lipsyncFromVideo: "sync/lipsync-2",
  // Video → transcript with timestamps.                     $0.001
  transcribeVideo: "wavespeed-ai/openai-whisper-with-video",
  transcribeAudio: "wavespeed-ai/openai-whisper",
  // Text → image, fast and cheap.                           $0.008
  textToImage: "wavespeed-ai/flux-2-flash/text-to-image",
  // Video upscale to 1080p/2k/4k.                           $0.0072
  videoUpscale: "bytedance/video-upscaler",
  // Image upscale to 2k/4k.                                 $0.01
  imageUpscale: "wavespeed-ai/image-upscaler",
  // Lyrics + genre tags → full song.                        $0.0003
  music: "wavespeed-ai/ace-step-1.5",
  // Silent video + prompt → synced sound effects/ambience.  $0.001
  videoToAudio: "wavespeed-ai/mmaudio-v2",
  // Cut out the background.                                 $0.004 / $0.05
  imageBackgroundRemove: "wavespeed-ai/image-background-remover",
  videoBackgroundRemove: "wavespeed-ai/video-background-remover",
  // Translate the speech in a video into another language.  $0.01
  dubVideo: "elevenlabs/dubbing",
} as const;
