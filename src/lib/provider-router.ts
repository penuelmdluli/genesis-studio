// ============================================
// GENESIS STUDIO — Provider Router
// ============================================
// Selects the video generation provider chain based on user tier,
// feature flags, percentage rollout, and spend cap.
//
// Gradual rollout: COMFYUI_FREE_TIER_PERCENTAGE (0-100) controls
// what fraction of free-tier users get ComfyUI. Uses deterministic
// hash of userId so the same user always gets the same provider.
//
// Circuit breaker: if ComfyUI daily spend cap is hit, automatically
// routes to FAL until midnight UTC.

import crypto from "crypto";
import { shouldUseRunPodComfyUI } from "./runpod-comfyui";
import { VendorProvider, isProviderAvailable, recordProviderSuccess, recordProviderFailure } from "./vendor-failover";
import { isOverDailyProviderCap } from "./spend-tracker";
import { envNumber } from "./env";
import { envString } from "./env";
import { submitFalJob } from "./fal";
import { submitWavespeedJob } from "./wavespeed";
import { AI_MODELS } from "./constants";
import { ModelId } from "@/types";

export type ProviderChain = VendorProvider[];

/**
 * Deterministic percentage check using a hash of userId.
 * Returns true if the user falls within the rollout percentage.
 * Same userId always returns the same result for the same percentage.
 */
function isInRolloutPercentage(userId: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  const hash = crypto.createHash("md5").update(userId).digest();
  const bucket = hash.readUInt16BE(0) % 100; // 0-99
  return bucket < percentage;
}

/**
 * Get the rollout percentage for a tier.
 * COMFYUI_FREE_TIER_PERCENTAGE controls free tier (default: 100 if COMFYUI_TIER_ROUTING includes free)
 * COMFYUI_CREATOR_TIER_PERCENTAGE controls creator tier (default: 0)
 */
function getTierPercentage(plan: string): number {
  if (plan === "free") {
    return envNumber("COMFYUI_FREE_TIER_PERCENTAGE", 100);
  }
  if (plan === "creator") {
    return envNumber("COMFYUI_CREATOR_TIER_PERCENTAGE", 0);
  }
  return 0;
}

/**
 * Select an ordered provider fallback chain for video generation.
 *
 * @param userPlan - User's subscription tier
 * @param userId - Used for deterministic percentage routing
 */
export async function selectProviderChain(
  userPlan: string,
  userId?: string
): Promise<ProviderChain> {
  if (!shouldUseRunPodComfyUI(userPlan)) {
    return ["fal", "runpod", "replicate"];
  }

  // Percentage-based rollout: check if this user is in the rollout bucket
  const percentage = getTierPercentage(userPlan);
  if (userId && percentage < 100) {
    if (!isInRolloutPercentage(userId, percentage)) {
      return ["fal", "runpod"];
    }
  }

  // Circuit breaker: check daily spend cap
  const { over } = await isOverDailyProviderCap("runpod-comfyui");
  if (over) {
    return ["fal", "runpod"];
  }

  return ["runpod-comfyui", "runpod", "fal"];
}

/**
 * Synchronous version — does NOT check spend cap or percentage rollout.
 */
export function selectProviderChainSync(userPlan: string): ProviderChain {
  if (shouldUseRunPodComfyUI(userPlan)) {
    return ["runpod-comfyui", "runpod", "fal"];
  }
  return ["fal", "runpod", "replicate"];
}

// ============================================
// Multi-Provider Video Submission
// ============================================
// Routes video gen to cheapest provider (WaveSpeed) with FAL fallback.
// WaveSpeed jobs are prefixed with "ws:" in the request_id so the
// status poller knows which API to call.

export type VideoSubmitResult = {
  request_id: string;
  status: string;
  provider: "wavespeed" | "fal";
};

/**
 * Check if WaveSpeed is configured and available for a model + type.
 */
function canUseWavespeed(modelId: ModelId, type: "t2v" | "i2v"): boolean {
  if (!envString("WAVESPEED_API_KEY")) return false;
  if (!isProviderAvailable("wavespeed")) return false;

  const model = AI_MODELS[modelId];
  if (!model) return false;

  if (type === "i2v") return !!model.wavespeedModelIdI2V;
  return !!model.wavespeedModelId;
}

/**
 * Submit a video generation job to the cheapest available provider.
 * Tries WaveSpeed first (30-50% cheaper), falls back to FAL.AI.
 *
 * Returns a VideoSubmitResult with a prefixed request_id:
 *  - "ws:{id}" for WaveSpeed jobs
 *  - raw FAL request_id for FAL jobs
 */
export async function submitVideoJob(params: {
  modelId: ModelId;
  type: "t2v" | "i2v";
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: string;
  enableAudio?: boolean;
  seed?: number;
}): Promise<VideoSubmitResult> {
  // Try WaveSpeed first (cheaper for video gen)
  if (canUseWavespeed(params.modelId, params.type)) {
    try {
      const result = await submitWavespeedJob(params);
      recordProviderSuccess("wavespeed");
      console.log(`[ROUTER] ${params.modelId} routed to WaveSpeed (cheaper)`);
      return {
        request_id: `ws:${result.request_id}`,
        status: result.status,
        provider: "wavespeed",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ROUTER] WaveSpeed failed for ${params.modelId}: ${msg}, falling back to FAL`);
      recordProviderFailure("wavespeed", msg);
    }
  }

  // Fallback to FAL.AI (always available, full feature set)
  const falResult = await submitFalJob(params);
  recordProviderSuccess("fal");
  console.log(`[ROUTER] ${params.modelId} routed to FAL.AI`);
  return {
    request_id: falResult.request_id,
    status: falResult.status,
    provider: "fal",
  };
}
