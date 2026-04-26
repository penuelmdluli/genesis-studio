// ============================================
// GENESIS STUDIO — Provider Router
// ============================================
// Selects the video generation provider chain based on user tier
// and feature flags. The orchestrator iterates the chain, trying
// each provider until one succeeds.
//
// Circuit breaker: if ComfyUI daily spend cap is hit, automatically
// routes to FAL until midnight UTC.

import { shouldUseRunPodComfyUI } from "./runpod-comfyui";
import { VendorProvider } from "./vendor-failover";
import { isOverDailyProviderCap } from "./spend-tracker";

export type ProviderChain = VendorProvider[];

/**
 * Select an ordered provider fallback chain for video generation.
 *
 * Free/Creator with ComfyUI enabled (and under spend cap):
 *   runpod-comfyui → runpod → fal
 *
 * Pro/Studio or when ComfyUI disabled or spend cap hit:
 *   fal → runpod → replicate (existing behavior)
 */
export async function selectProviderChain(userPlan: string): Promise<ProviderChain> {
  if (shouldUseRunPodComfyUI(userPlan)) {
    // Circuit breaker: check daily spend cap
    const { over } = await isOverDailyProviderCap("runpod-comfyui");
    if (over) {
      return ["fal", "runpod"];
    }
    return ["runpod-comfyui", "runpod", "fal"];
  }
  return ["fal", "runpod", "replicate"];
}

/**
 * Synchronous version for contexts where async isn't possible.
 * Does NOT check spend cap — use selectProviderChain() when possible.
 */
export function selectProviderChainSync(userPlan: string): ProviderChain {
  if (shouldUseRunPodComfyUI(userPlan)) {
    return ["runpod-comfyui", "runpod", "fal"];
  }
  return ["fal", "runpod", "replicate"];
}
