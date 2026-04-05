// ============================================
// GENESIS STUDIO — Profitability Tracking
// ============================================

import { AI_MODELS } from "./constants";
import { ModelId } from "@/types";

// GPU hourly rates by type (USD)
export const GPU_RATES: Record<string, number> = {
  "RTX_4090": 0.69,
  "A6000": 0.76,
  "L40S": 0.74,
  "A100": 1.64,
  "H100": 2.39,
};

// Model → GPU mapping (cheapest GPU that can run each model)
export const MODEL_GPU_MAP: Record<string, string> = {
  "cogvideo-x": "RTX_4090",
  "ltx-video": "RTX_4090",
  "hunyuan-video": "RTX_4090",
  "wan-2.1-turbo": "RTX_4090",
  "wan-2.2": "L40S",
  "mochi-1": "A6000",
  "mimic-motion": "RTX_4090",
  // FAL.AI models — costs are per-API-call, not GPU rental
  "kling-2.6": "FAL_API",
  "kling-3.0": "FAL_API",
  "veo-3.1": "FAL_API",
  "seedance-1.5": "FAL_API",
};

// FAL.AI per-second API costs (USD) — these are what FAL charges us
export const FAL_API_COSTS: Record<string, number> = {
  "kling-2.6": 0.035,    // ~$0.35 per 10s video
  "kling-3.0": 0.050,    // ~$0.50 per 10s video
  "veo-3.1": 0.100,      // ~$0.80 per 8s video
  "seedance-1.5": 0.020, // ~$0.20 per 10s video
};

// Credit value in USD (based on Creator plan: 500 credits / $15)
export const CREDIT_VALUE_USD = 0.03;

// Monthly fixed costs
export const FIXED_COSTS_MONTHLY = {
  supabase: 25,
  clerk: 25,
  cloudflare: 20,
  upstash: 10,
  domains: 5,
  total: 85,
};

/**
 * Estimate GPU/API cost for a generation in USD
 */
export function estimateGpuCostUsd(
  modelId: string,
  durationSeconds: number,
  resolution: string
): number {
  const model = AI_MODELS[modelId as ModelId];
  if (!model) return 0;

  // FAL.AI models — flat per-second API pricing
  if (FAL_API_COSTS[modelId]) {
    const perSecondRate = FAL_API_COSTS[modelId];
    const resMultiplier = resolution === "1080p" ? 1.5 : 1; // 1080p costs more
    return perSecondRate * durationSeconds * resMultiplier;
  }

  // RunPod models — estimated GPU rental cost
  const gpuType = MODEL_GPU_MAP[modelId] || "RTX_4090";
  const hourlyRate = GPU_RATES[gpuType] || 0.69;

  const baseSecs = model.avgGenerationTime;
  const durationMultiplier = durationSeconds / 5; // Normalized to 5s
  const resMultiplier = resolution === "1080p" ? 2.5 : resolution === "4k" ? 5 : resolution === "720p" ? 1.5 : 1;
  const estimatedGpuSeconds = baseSecs * durationMultiplier * Math.sqrt(resMultiplier);

  return (estimatedGpuSeconds * hourlyRate) / 3600;
}

/**
 * Calculate revenue from credits charged
 */
export function creditsToRevenue(credits: number): number {
  return credits * CREDIT_VALUE_USD;
}

/**
 * Get margin percentage for a generation
 */
export function getGenerationMargin(
  creditsCharged: number,
  gpuCostUsd: number
): number {
  const revenue = creditsToRevenue(creditsCharged);
  if (revenue === 0) return 0;
  return ((revenue - gpuCostUsd) / revenue) * 100;
}

/**
 * Check if a generation is profitable (margin > 50%)
 */
export function isProfitable(
  creditsCharged: number,
  modelId: string,
  duration: number,
  resolution: string
): { profitable: boolean; margin: number; gpuCost: number; revenue: number } {
  const gpuCost = estimateGpuCostUsd(modelId, duration, resolution);
  const revenue = creditsToRevenue(creditsCharged);
  const margin = revenue > 0 ? ((revenue - gpuCost) / revenue) * 100 : 0;

  return {
    profitable: margin > 50,
    margin: Math.round(margin),
    gpuCost: Math.round(gpuCost * 1000) / 1000,
    revenue: Math.round(revenue * 1000) / 1000,
  };
}

/**
 * Calculate break-even number of paid users
 */
export function calculateBreakEven(
  avgRevenuePerUser: number = 24.60,
  fixedCosts: number = FIXED_COSTS_MONTHLY.total,
  avgGpuCostPerUser: number = 5
): number {
  const netPerUser = avgRevenuePerUser - avgGpuCostPerUser;
  if (netPerUser <= 0) return Infinity;
  return Math.ceil(fixedCosts / netPerUser);
}

/**
 * Plan-based limits
 */
export const PLAN_LIMITS = {
  free: {
    maxGenerationsPerDay: 5,
    maxConcurrentJobs: 1,
    maxCreditsPerMonth: 50,
    maxCreditPerGeneration: 80,
  },
  creator: {
    maxGenerationsPerDay: 50,
    maxConcurrentJobs: 3,
    maxCreditsPerMonth: 500,
    maxCreditPerGeneration: 200,
  },
  pro: {
    maxGenerationsPerDay: 200,
    maxConcurrentJobs: 5,
    maxCreditsPerMonth: 2000,
    maxCreditPerGeneration: 500,
  },
  studio: {
    maxGenerationsPerDay: 500,
    maxConcurrentJobs: 10,
    maxCreditsPerMonth: 10000,
    maxCreditPerGeneration: 1000,
  },
} as const;

/**
 * Check if user has exceeded plan generation limits
 */
export function checkPlanLimits(
  plan: string,
  dailyGenerations: number,
  activeJobs: number
): { allowed: boolean; reason?: string } {
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

  if (dailyGenerations >= limits.maxGenerationsPerDay) {
    return {
      allowed: false,
      reason: `Daily generation limit reached (${limits.maxGenerationsPerDay}/day on ${plan} plan). Upgrade for more.`,
    };
  }
  if (activeJobs >= limits.maxConcurrentJobs) {
    return {
      allowed: false,
      reason: `Max concurrent jobs reached (${limits.maxConcurrentJobs} on ${plan} plan). Wait for current jobs to finish.`,
    };
  }
  return { allowed: true };
}
