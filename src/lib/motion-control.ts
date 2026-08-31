// ============================================
// GENESIS STUDIO — Motion Control Service
// ============================================
// Provider chain for a custom reference video:
//   1. WaveSpeed (hosted Kling)
//   2. FAL.AI (hosted Kling)
//   3. RunPod Wan2.2-Animate — opt-in only, see below
//
// RunPod is last and off by default despite being the capacity we own. A
// controlled run on 2026-08-31 (job 18ca7ace, character = a still of an older
// man, driving video = a child dancing in a plaza) returned a 29-minute,
// ~$2.50 clip of an unrelated man carrying a beam through a crowd — neither
// input appears in it, and its first frame matches an artifact from an earlier
// unrelated run. The worker's handler falls back to globbing animate-14B*.mp4
// when its --save_file does not land, so it can return a previous render
// instead of failing. It also writes 25fps preprocessing at 30fps, so a 5.0s
// driver comes back as 4.167s.
//
// Set MOTION_RUNPOD_ENABLED=true to put it back in the chain once the worker
// is fixed; hosted Kling is meanwhile both cheaper and an order of magnitude
// faster, so this is not a cost tradeoff.
//
// Built-in fun effects and prompt-only mode are Kling-specific — Wan-Animate
// needs a driving video — so they can only ever run on WaveSpeed/FAL.

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
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

// Wan2.2-Animate takes a character still + a driving video and transfers the
// motion. It has no equivalent of Kling's named "fun effects", so it can only
// serve the custom-reference-video path.
function runpodMotionEndpointId(): string {
  const raw = envString("RUNPOD_ENDPOINT_WAN_ANIMATE") || "";
  // Guard against placeholder values ("your-endpoint-id") reaching the API.
  return /^[a-z0-9]{10,20}$/.test(raw) ? raw : "";
}

function motionSteps(): number | null {
  const n = Number(envString("RUNPOD_MOTION_STEPS"));
  return Number.isInteger(n) && n >= 4 && n <= 50 ? n : null;
}

/**
 * Make an asset URL fetchable by the RunPod worker.
 *
 * The worker downloads with urllib, whose "Python-urllib/3.x" User-Agent is
 * rejected with 403 by the Cloudflare rules in front of cdn.ivideostudio.ai.
 * Presigning against the R2 S3 endpoint sidesteps the CDN entirely — the
 * signature is the authorization, so no bot rule applies. Anything not on our
 * own CDN is passed through untouched.
 */
async function toWorkerFetchableUrl(url: string): Promise<string> {
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (!base || !url.startsWith(base + "/")) return url;

  const key = decodeURI(url.slice(base.length + 1).split("?")[0]);
  try {
    const { getSignedDownloadUrl } = await import("@/lib/storage");
    // Wan-Animate runs long; keep the link valid well past the worker cold start.
    return await getSignedDownloadUrl(key, 7200);
  } catch (err) {
    console.warn(`[Motion] Could not presign ${key}, using public URL:`, err);
    return url;
  }
}

/**
 * Submit motion transfer to our own RunPod Wan2.2-Animate endpoint.
 * Returns null when RunPod cannot serve this request, so the caller falls
 * through to the hosted providers.
 */
async function tryRunpodMotion(params: {
  characterImageUrl: string;
  referenceVideoUrl?: string;
  effect?: string;
  seed?: number;
}): Promise<{ requestId: string; endpoint: string } | null> {
  if (envString("MOTION_RUNPOD_ENABLED") !== "true") return null;

  const endpointId = runpodMotionEndpointId();
  if (!endpointId) return null;
  if (!envString("RUNPOD_API_KEY")) return null;
  if (!isProviderAvailable("runpod-motion")) return null;

  // No driving video means an effect or prompt-only request — Kling territory.
  if (!params.referenceVideoUrl || params.effect) return null;

  try {
    const [characterImage, drivingVideo] = await Promise.all([
      toWorkerFetchableUrl(params.characterImageUrl),
      toWorkerFetchableUrl(params.referenceVideoUrl),
    ]);

    console.log(`[Motion] Trying RunPod Wan-Animate: ${endpointId}`);
    const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${envString("RUNPOD_API_KEY")}`,
      },
      body: JSON.stringify({
        input: {
          character_image: characterImage,
          driving_video: drivingVideo,
          mode: "animate",
          // Wan's preprocessing takes these as a resolution *area* and fits the
          // driving video into it preserving aspect, so the output orientation
          // follows the reference video either way. 720x1280 is the pixel
          // budget, not a forced portrait crop — which is why the UI's
          // "Match Video"/"Match Image" toggle has no effect on this path.
          width: 720,
          height: 1280,
          fps: 25,
          refert_num: 1,
          // Sampling steps dominate the render time, and on our own GPU that is
          // billed by the second — a 5s clip at the model default runs ~30 min
          // for ~$1.40. Set RUNPOD_MOTION_STEPS to trade quality for cost
          // without a redeploy; unset keeps the model's own default.
          ...(motionSteps() ? { steps: motionSteps() } : {}),
          ...(params.seed !== undefined && params.seed >= 0 ? { seed: params.seed } : {}),
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`RunPod motion submit failed (${res.status}): ${await res.text()}`);
    }

    const json = (await res.json()) as { id?: string; error?: string };
    if (!json.id) throw new Error(json.error || "RunPod returned no job id");

    recordProviderSuccess("runpod-motion");
    console.log(`[Motion] RunPod motion submitted: ${json.id}`);
    // "rp:" prefix routes the poller back to the RunPod API.
    return { requestId: json.id, endpoint: `rp:${endpointId}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Motion] RunPod motion failed: ${msg}, falling back to hosted providers`);
    recordProviderFailure("runpod-motion", msg);
    return null;
  }
}

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
  duration: number;
  keepOriginalSound: boolean;
  negativePrompt?: string;
}): Promise<{ requestId: string; endpoint: string } | null> {
  const wsKey = envString("WAVESPEED_API_KEY");
  if (!wsKey) return null;
  if (!isProviderAvailable("wavespeed")) return null;

  // Must have either a reference video or an effect
  if (!params.referenceVideoUrl && !params.effect) return null;

  const wsEndpoint = WAVESPEED_MOTION_ENDPOINTS[params.model]?.[params.quality]
    || WAVESPEED_MOTION_ENDPOINTS["kling-v3"]["standard"];

  const body: Record<string, unknown> = {
    image: params.characterImageUrl,
    character_orientation: params.orientation,
    duration: String(params.duration || 10),
    keep_original_sound: params.keepOriginalSound,
    cfg_scale: 0.5,
  };
  // WaveSpeed requires 'video' field even for effects
  if (params.referenceVideoUrl) {
    body.video = params.referenceVideoUrl;
  } else if (params.effect) {
    // Use a minimal stock dance video as base reference for effects
    // WaveSpeed will override motion with the effect but needs a valid video input
    body.video = "https://d1q70pf5vjeyhc.cloudfront.net/predictions/5c972e863dd24bf9bd2821a3e1e601b3/1.mp4";
  }
  if (params.effect) body.effect = params.effect;
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
// Tries our own RunPod GPU first, then WaveSpeed, then FAL.AI
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
    keepOriginalSound = true,
    seed,
    cfgScale = 0.5,
  } = params;

  if (!referenceVideoUrl && !effect) {
    throw new Error("Either a reference video or a fun effect is required");
  }

  // WaveSpeed first — cheapest of the two hosted providers
  const wsResult = await tryWavespeedMotion({
    characterImageUrl,
    referenceVideoUrl,
    effect,
    prompt,
    quality,
    model,
    orientation,
    duration,
    keepOriginalSound,
  });

  if (wsResult) {
    return wsResult;
  }

  // Then our own RunPod GPU, if it has been explicitly re-enabled. Returns
  // null for anything it cannot serve (effects, prompt-only) and whenever the
  // opt-in flag is unset, which is the default.
  const rpResult = await tryRunpodMotion({
    characterImageUrl,
    referenceVideoUrl,
    effect,
    seed,
  });

  if (rpResult) {
    return rpResult;
  }

  // Fallback to FAL.AI (supports effects)
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

interface RunPodMotionStatus {
  status: string;
  error?: string;
  output?: { video_base64?: string; error?: string; mp4_bytes?: number; seconds?: number };
}

async function runpodMotionStatus(endpointId: string, requestId: string): Promise<RunPodMotionStatus> {
  const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/status/${requestId}`, {
    headers: { Authorization: `Bearer ${envString("RUNPOD_API_KEY")}` },
  });
  if (!res.ok) throw new Error(`RunPod motion status failed (${res.status})`);
  return (await res.json()) as RunPodMotionStatus;
}

/**
 * Hosted providers hand back a URL to download; RunPod hands back the mp4
 * itself. Exactly one of these is set.
 */
export interface MotionJobOutput {
  videoUrl?: string;
  videoBytes?: Uint8Array;
}

// Poll motion control job status
// Handles FAL endpoints, WaveSpeed ("ws:") and RunPod ("rp:") endpoints
export async function getMotionJobStatus(
  endpoint: string,
  requestId: string
): Promise<{
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
}> {
  // RunPod Wan-Animate — endpoint starts with "rp:"
  if (endpoint.startsWith("rp:")) {
    try {
      const rp = await runpodMotionStatus(endpoint.slice(3), requestId);
      switch (rp.status) {
        case "COMPLETED":
          // The handler catches its own exceptions and reports them in the
          // output, so a COMPLETED RunPod job can still be a failed render.
          if (rp.output?.error) return { status: "FAILED", error: rp.output.error };
          return { status: "COMPLETED" };
        case "FAILED":
        case "CANCELLED":
        case "TIMED_OUT":
          return { status: "FAILED", error: rp.error || rp.output?.error || "RunPod motion job failed" };
        case "IN_PROGRESS":
          return { status: "IN_PROGRESS" };
        default:
          return { status: "IN_QUEUE" };
      }
    } catch (err) {
      return { status: "FAILED", error: String(err) };
    }
  }

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
): Promise<MotionJobOutput> {
  // RunPod Wan-Animate returns the mp4 inline as base64 rather than a URL,
  // so callers get bytes here and a URL from the hosted providers.
  if (endpoint.startsWith("rp:")) {
    const rp = await runpodMotionStatus(endpoint.slice(3), requestId);
    if (rp.output?.error) throw new Error(rp.output.error);
    const b64 = rp.output?.video_base64;
    if (!b64) throw new Error("RunPod motion result had no video");

    // Buffer decodes natively (nodejs_compat); a char-by-char atob loop over a
    // multi-megabyte mp4 would burn the Worker's CPU budget.
    return { videoBytes: Buffer.from(b64, "base64") };
  }

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

/**
 * Can a hosted Kling provider actually serve a request right now?
 *
 * Named fun effects and prompt-only motion have no Wan-Animate equivalent, so
 * they can only run on FAL or WaveSpeed. Both answer an exhausted balance with
 * a bare 403 at submit time, which used to reach users as "Forbidden" *after*
 * their credits had been deducted — one user burned five retries that way on
 * 2026-08-24. Checking first lets the caller refuse cheaply and honestly.
 *
 * Both probes are free: WaveSpeed publishes a balance endpoint, and an empty
 * body to FAL is rejected at validation (422) before any billable work, so a
 * 403 there is unambiguously an account problem.
 */
let hostedProbe: { ok: boolean; at: number } | null = null;
const HOSTED_PROBE_TTL = 5 * 60 * 1000;

export async function hostedMotionAvailable(): Promise<boolean> {
  if (hostedProbe && Date.now() - hostedProbe.at < HOSTED_PROBE_TTL) {
    return hostedProbe.ok;
  }

  const ok = (await Promise.all([wavespeedFunded(), falFunded()])).some(Boolean);
  hostedProbe = { ok, at: Date.now() };
  if (!ok) {
    console.error("[Motion] No hosted provider has funds — effects and prompt-only motion are unavailable");
  }
  return ok;
}

/**
 * Record that a hosted provider just refused us, so the next effects request is
 * turned away immediately instead of taking credits to learn the same thing.
 */
export function hostedMotionUnavailable(): void {
  hostedProbe = { ok: false, at: Date.now() };
}

async function wavespeedFunded(): Promise<boolean> {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) return false;
  try {
    const res = await fetch(`${WAVESPEED_API_BASE}/balance`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { balance?: number } };
    return (json.data?.balance ?? 0) > 0;
  } catch {
    return false;
  }
}

async function falFunded(): Promise<boolean> {
  const key = process.env.FAL_KEY || "";
  if (!key) return false;
  try {
    const res = await fetch(
      `https://queue.fal.run/${MOTION_ENDPOINTS["kling-v3"].standard}`,
      {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: "{}",
      }
    );
    // 403 means the account is locked or out of balance. Anything else —
    // including the 422 we expect from the empty body — means FAL would run it.
    return res.status !== 403 && res.status !== 401;
  } catch {
    return false;
  }
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
