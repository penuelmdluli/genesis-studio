// ============================================
// GENESIS STUDIO — Motion Control Service
// ============================================
// Powered by FAL.AI Kling motion control endpoints.
// Supports: custom reference videos, 40+ built-in fun effects, native audio.
// Fallback: Replicate MimicMotion for basic motion transfer.

import { fal } from "@fal-ai/client";

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

// Submit motion control job (async queue to avoid Vercel timeout)
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

  console.log(`[Motion] Submitting to ${endpoint}: effect=${effect || "custom"}, duration=${duration}s`);

  const result = await fal.queue.submit(endpoint, { input });

  return {
    requestId: result.request_id,
    endpoint,
  };
}

// Poll motion control job status
export async function getMotionJobStatus(
  endpoint: string,
  requestId: string
): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
}> {
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
export async function getMotionJobResult(
  endpoint: string,
  requestId: string
): Promise<{ videoUrl: string }> {
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
