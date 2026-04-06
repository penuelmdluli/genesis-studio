/**
 * Genesis Studio — Vendor Failover System
 * Routes video generation across multiple providers with automatic fallback.
 * Priority: FAL.AI → RunPod → Replicate
 */

import { ModelId } from "@/types";
import { AI_MODELS } from "@/lib/constants";

export type VendorProvider = "fal" | "runpod" | "replicate";

interface ProviderHealth {
  provider: VendorProvider;
  healthy: boolean;
  lastChecked: number;
  failCount: number;
  lastError?: string;
}

// In-memory health state (resets on cold start — acceptable for serverless)
const providerHealth: Record<VendorProvider, ProviderHealth> = {
  fal: { provider: "fal", healthy: true, lastChecked: 0, failCount: 0 },
  runpod: { provider: "runpod", healthy: true, lastChecked: 0, failCount: 0 },
  replicate: { provider: "replicate", healthy: true, lastChecked: 0, failCount: 0 },
};

const HEALTH_CHECK_INTERVAL = 60_000; // 1 minute
const FAIL_THRESHOLD = 3; // Mark unhealthy after 3 consecutive failures
const RECOVERY_COOLDOWN = 300_000; // 5 minutes before retrying a failed provider

/**
 * Record a provider failure.
 */
export function recordProviderFailure(provider: VendorProvider, error: string) {
  const health = providerHealth[provider];
  health.failCount++;
  health.lastError = error;
  health.lastChecked = Date.now();
  if (health.failCount >= FAIL_THRESHOLD) {
    health.healthy = false;
    console.error(`[FAILOVER] Provider ${provider} marked UNHEALTHY after ${health.failCount} failures: ${error}`);
  }
}

/**
 * Record a provider success.
 */
export function recordProviderSuccess(provider: VendorProvider) {
  const health = providerHealth[provider];
  health.healthy = true;
  health.failCount = 0;
  health.lastChecked = Date.now();
  health.lastError = undefined;
}

/**
 * Check if a provider should be attempted.
 */
export function isProviderAvailable(provider: VendorProvider): boolean {
  const health = providerHealth[provider];
  // If healthy, always available
  if (health.healthy) return true;
  // If unhealthy but cooldown elapsed, allow retry
  if (Date.now() - health.lastChecked > RECOVERY_COOLDOWN) return true;
  return false;
}

/**
 * Get the fallback provider chain for a model.
 * Returns providers in priority order, skipping unhealthy ones.
 */
export function getProviderChain(modelId: ModelId): VendorProvider[] {
  const model = AI_MODELS[modelId];
  if (!model) return ["runpod"];

  const chain: VendorProvider[] = [];

  // Primary provider first
  if (model.provider === "fal") {
    chain.push("fal", "runpod");
  } else {
    chain.push("runpod", "fal");
  }

  // Replicate as last resort (if configured)
  if (process.env.REPLICATE_API_KEY) {
    chain.push("replicate");
  }

  // Filter to available providers
  return chain.filter((p) => isProviderAvailable(p));
}

/**
 * Get current health status for all providers (for admin dashboard).
 */
export function getProviderHealthStatus() {
  return Object.values(providerHealth).map((h) => ({
    provider: h.provider,
    healthy: h.healthy,
    failCount: h.failCount,
    lastError: h.lastError,
    lastChecked: h.lastChecked ? new Date(h.lastChecked).toISOString() : null,
  }));
}
