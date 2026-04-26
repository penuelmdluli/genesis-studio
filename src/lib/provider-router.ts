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
import { VendorProvider } from "./vendor-failover";
import { isOverDailyProviderCap } from "./spend-tracker";
import { envNumber } from "./env";

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
