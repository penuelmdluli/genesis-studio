// ============================================
// GENESIS STUDIO — Motion Control Service
// ============================================
// Powered by FAL.AI Kling motion control endpoints.
// Supports: custom reference videos, 40+ built-in fun effects, native audio.
// Fallback: Replicate MimicMotion for basic motion transfer.

import { fal } from "@fal-ai/client";
import { envString } from "@/lib/env";
import {
  isProviderAvailable,
  recordProviderSuccess,
  recordProviderFailure,
} from "@/lib/vendor-failover";

fal.config({ credentials: process.env.FAL_KEY || "" });

export type MotionQuality = "standard" | "pro";
export type MotionModel = "kling-v3" | "kling-v2.6";
export type MotionOrientation = "video" | "image";

export interface MotionControlParams {
  characterImageUrl: string;
  referenceVideoUrl?: string;
  effect?: string;
  prompt?: string;
  quality?: MotionQuality;
  model?: MotionModel;
  orientation?: MotionOrientation;
  duration?: number;
  enableAudio?: boolean;
  keepOriginalSound?: boolean;
  seed?: number;
  cfgScale?: number;
}

export interface MotionControlResult {
  videoUrl: string;
  hasAudio: boolean;
  model: string;
  duration: number;
}

const MOTION_ENDPOINTS: Record<string, Record<string, string>> = {
  "kling-v3": {
    standard: "fal-ai/kling-video/v3/standard/motion-control",
    pro: "fal-ai/kling-video/v3/pro/motion-control",
  },
  "kling-v2.6": {
    standard: "fal-ai/kling-video/v2.6/standard/motion-control",
    pro: "fal-ai/kling-video/v2.6/pro/motion-control",
  },
};

// WaveSpeed motion control endpoints (cheaper alternative)
const WAVESPEED_MOTION_ENDPOINTS: Record<string, Record<string, string>> = {
  "kling-v3": {
    standard: "kwaivgi/kling-v3.0-std/motion-control",
    pro: "kwaivgi/kling-v3.0-pro/motion-control",
  },
  "kling-v2.6": {
    standard: "kwaivgi/kling-v2.6-std/motion-control",
    pro: "kwaivgi/kling-v2.6-pro/motion-control",
  },
};

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

/**
 * Submit motion control to WaveSpeed (cheaper).
 * Returns null if WaveSpeed is unavailable or fails.
 */
async function tryWavespeedMotion(params: {
  characterImageUrl: string;
  referenceVideoUrl?: string;
  effect?: string;
  prompt?: string;
  quality: string;
  model: string;
  orientation: string;
  keepOriginalSound: boolean;
  negativePrompt?: string;
}): Promise<{ requestId: string; endpoint: string } | null> {
  const wsKey = envString("WAVESPEED_API_KEY");
  if (!wsKey) return null;
  if (!isProviderAvailable("wavespeed")) return null;

  // Effects are only supported on FAL (Kling-specific feature)
  if (params.effect) return null;

  // Must have a reference video for WaveSpeed motion control
  if (!params.referenceVideoUrl) return null;

  const wsEndpoint = WAVESPEED_MOTION_ENDPOINTS[params.model]?.[params.quality]
    || WAVESPEED_MOTION_ENDPOINTS["kling-v3"]["standard"];

  const body: Record<string, unknown> = {
    image: params.characterImageUrl,
    video: params.referenceVideoUrl,
    character_orientation: params.orientation,
    keep_original_sound: params.keepOriginalSound,
  };
  if (params.prompt) body.prompt = params.prompt;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;

  try {
    console.log(`[Motion] Trying WaveSpeed: ${wsEndpoint}`);
    const res = await fetch(`${WAVESPEED_API_BASE}/${wsEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wsKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WaveSpeed motion failed (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as { data: { id: string; status: string } };
    const data = json.data;
    recordProviderSuccess("wavespeed");
    console.log(`[Motion] WaveSpeed motion submitted: ${data.id}`);

    return {
      requestId: data.id,
      // Use "ws:" prefix on endpoint so the poller routes to WaveSpeed API
      endpoint: `ws:${wsEndpoint}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Motion] WaveSpeed motion failed: ${msg}, falling back to FAL`);
    recordProviderFailure("wavespeed", msg);
    return null;
  }
}

// Submit motion control job (async queue to avoid Vercel timeout)
// Tries WaveSpeed first (cheaper), falls back to FAL.AI
export async function submitMotionControlJob(params: MotionControlParams): Promise<{
  requestId: string;
  endpoint: string;
}> {
  const {
    characterImageUrl,
    referenceVideoUrl,
    effect,
    prompt,
    quality = "standard",
    model = "kling-v3",
    orientation = "video",
    duration = 10,
    enableAudio = false,
    keepOriginalSound = false,
    seed,
    cfgScale = 0.5,
  } = params;

  if (!referenceVideoUrl && !effect) {
    throw new Error("Either a reference video or a fun effect is required");
  }

  // Try WaveSpeed first for custom reference video motion (not effects)
  const wsResult = await tryWavespeedMotion({
    characterImageUrl,
    referenceVideoUrl,
    effect,
    prompt,
    quality,
    model,
    orientation,
    keepOriginalSound,
  });

  if (wsResult) {
    return wsResult;
  }

  // Fallback to FAL.AI (always available, supports effects)
  const endpoint = MOTION_ENDPOINTS[model]?.[quality] || MOTION_ENDPOINTS["kling-v3"]["standard"];

  const input: Record<string, unknown> = {
    image_url: characterImageUrl,
    character_orientation: orientation,
    duration: String(duration),
    cfg_scale: cfgScale,
  };

  if (referenceVideoUrl) input.video_url = referenceVideoUrl;
  if (effect) input.effect = effect;
  if (prompt) input.prompt = prompt;
  if (enableAudio) input.native_audio = true;
  if (keepOriginalSound) input.keep_original_sound = true;
  if (seed !== undefined && seed >= 0) input.seed = seed;

  console.log(`[Motion] Submitting to FAL: ${endpoint}: effect=${effect || "custom"}, duration=${duration}s`);

  const result = await fal.queue.submit(endpoint, { input });

  return {
    requestId: result.request_id,
    endpoint,
  };
}

// Poll motion control job status
// Handles both FAL endpoints and WaveSpeed endpoints (prefixed with "ws:")
export async function getMotionJobStatus(
  endpoint: string,
  requestId: string
): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
}> {
  // WaveSpeed motion — endpoint starts with "ws:"
  if (endpoint.startsWith("ws:")) {
    try {
      const wsKey = envString("WAVESPEED_API_KEY");
      if (!wsKey) return { status: "FAILED", error: "WAVESPEED_API_KEY not configured" };

      const res = await fetch(`${WAVESPEED_API_BASE}/predictions/${requestId}/result`, {
        headers: { Authorization: `Bearer ${wsKey}` },
      });

      if (!res.ok) {
        if (res.status === 404) return { status: "IN_QUEUE" };
        return { status: "FAILED", error: `WaveSpeed status check failed: ${res.status}` };
      }

      const json = (await res.json()) as { data: { status: string; error?: string } };
      const data = json.data;
      switch (data.status) {
        case "completed": return { status: "COMPLETED" };
        case "failed": return { status: "FAILED", error: data.error || "WaveSpeed motion failed" };
        case "processing": return { status: "IN_PROGRESS" };
        default: return { status: "IN_QUEUE" };
      }
    } catch (err) {
      return { status: "FAILED", error: String(err) };
    }
  }

  // FAL motion
  try {
    const status = await fal.queue.status(endpoint, {
      requestId,
      logs: false,
    });
    return { status: status.status as "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" };
  } catch (err) {
    return { status: "FAILED", error: String(err) };
  }
}

// Get completed motion control result
// Handles both FAL and WaveSpeed endpoints
export async function getMotionJobResult(
  endpoint: string,
  requestId: string
): Promise<{ videoUrl: string }> {
  // WaveSpeed motion
  if (endpoint.startsWith("ws:")) {
    const wsKey = envString("WAVESPEED_API_KEY");
    if (!wsKey) throw new Error("WAVESPEED_API_KEY not configured");

    const res = await fetch(`${WAVESPEED_API_BASE}/predictions/${requestId}/result`, {
      headers: { Authorization: `Bearer ${wsKey}` },
    });

    if (!res.ok) throw new Error(`WaveSpeed motion result fetch failed: ${res.status}`);

    const json = (await res.json()) as { data: { outputs?: string[]; status: string } };
    const data = json.data;
    if (data.status !== "completed" || !data.outputs?.length) {
      throw new Error("WaveSpeed motion result not ready or missing outputs");
    }

    return { videoUrl: data.outputs[0] };
  }

  // FAL motion
  const result = await fal.queue.result(endpoint, { requestId });
  const data = result.data as { video?: { url: string } };

  if (!data?.video?.url) {
    throw new Error("No video URL in motion control result");
  }

  return { videoUrl: data.video.url };
}

// --- Built-in Fun Effects ---

export interface FunEffect {
  id: string;
  name: string;
  category: string;
  icon: string;
}

export const FUN_EFFECT_CATEGORIES = [
  "All",
  "Dance",
  "Gesture",
  "Fantasy",
  "Effects",
  "Celebration",
  "Style",
  "Fun",
] as const;

export const FUN_EFFECTS: FunEffect[] = [
  // Dance
  { id: "running_man", name: "Running Man", category: "Dance", icon: "running_man" },
  { id: "jazz_jazz", name: "Jazz Dance", category: "Dance", icon: "jazz_jazz" },
  { id: "swing_swing", name: "Swing Dance", category: "Dance", icon: "swing_swing" },
  // Gesture
  { id: "hug", name: "Hug", category: "Gesture", icon: "hug" },
  { id: "kiss", name: "Kiss", category: "Gesture", icon: "kiss" },
  { id: "heart_gesture", name: "Heart Gesture", category: "Gesture", icon: "heart_gesture" },
  { id: "squish", name: "Squish", category: "Gesture", icon: "squish" },
  // Fantasy
  { id: "fly_fly", name: "Flying", category: "Fantasy", icon: "fly_fly" },
  { id: "golden_wing", name: "Golden Wings", category: "Fantasy", icon: "golden_wing" },
  { id: "pure_white_wings", name: "Angel Wings", category: "Fantasy", icon: "pure_white_wings" },
  { id: "black_wings", name: "Dark Wings", category: "Fantasy", icon: "black_wings" },
  { id: "pink_pink_wings", name: "Fairy Wings", category: "Fantasy", icon: "pink_pink_wings" },
  // Effects
  { id: "lightning_power", name: "Lightning Power", category: "Effects", icon: "lightning_power" },
  { id: "bullet_time", name: "Bullet Time", category: "Effects", icon: "bullet_time" },
  { id: "bullet_time_360", name: "360 Bullet Time", category: "Effects", icon: "bullet_time_360" },
  { id: "disappear", name: "Disappear", category: "Effects", icon: "disappear" },
  { id: "day_to_night", name: "Day to Night", category: "Effects", icon: "day_to_night" },
  // Celebration
  { id: "firework_2026", name: "Fireworks", category: "Celebration", icon: "firework_2026" },
  { id: "celebration", name: "Celebration", category: "Celebration", icon: "celebration" },
  { id: "birthday_star", name: "Birthday Star", category: "Celebration", icon: "birthday_star" },
  // Style
  { id: "anime_figure", name: "Anime Style", category: "Style", icon: "anime_figure" },
  { id: "yearbook", name: "Yearbook", category: "Style", icon: "yearbook" },
  { id: "instant_film", name: "Instant Film", category: "Style", icon: "instant_film" },
  { id: "pixelpixel", name: "Pixel Art", category: "Style", icon: "pixelpixel" },
  // Fun
  { id: "rampage_ape", name: "Rampage Ape", category: "Fun", icon: "rampage_ape" },
  { id: "tiger_hug_pro", name: "Tiger Hug", category: "Fun", icon: "tiger_hug_pro" },
  { id: "jelly_jiggle", name: "Jelly Jiggle", category: "Fun", icon: "jelly_jiggle" },
  { id: "jelly_press", name: "Jelly Press", category: "Fun", icon: "jelly_press" },
  { id: "skateskate", name: "Skateboard", category: "Fun", icon: "skateskate" },
];

// Cost estimation for motion control
export function estimateMotionCost(
  quality: MotionQuality,
  duration: number
): { costUsd: number; credits: number } {
  const ratePerSec = quality === "pro" ? 0.14 : 0.07;
  const costUsd = ratePerSec * duration;
  // Convert to credits with 4x markup: costUsd * 400 (1 credit ≈ $0.01 face, $0.03 revenue)
  // Standard 10s: $0.70 → 280 credits ($8.40 revenue, 12x margin)
  // Pro 10s: $1.40 → 560 credits ($16.80 revenue, 12x margin)
  const credits = Math.ceil(costUsd * 400);
  return { costUsd, credits };
}
