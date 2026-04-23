// ============================================
// GENESIS STUDIO — Provider Router
// ============================================
// Selects the video generation provider chain based on user tier
// and feature flags. The orchestrator iterates the chain, trying
// each provider until one succeeds.

import { shouldUseRunPodComfyUI } from "./runpod-comfyui";
import { VendorProvider } from "./vendor-failover";

export type ProviderChain = VendorProvider[];

/**
 * Select an ordered provider fallback chain for video generation.
 *
 * Free/Creator with ComfyUI enabled:
 *   runpod-comfyui → runpod → fal
 *
 * Pro/Studio or when ComfyUI disabled:
 *   fal → runpod → replicate (existing behavior)
 */
export function selectProviderChain(userPlan: string): ProviderChain {
  if (shouldUseRunPodComfyUI(userPlan)) {
    return ["runpod-comfyui", "runpod", "fal"];
  }
  return ["fal", "runpod", "replicate"];
}
