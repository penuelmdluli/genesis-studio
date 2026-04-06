// ============================================
// GENESIS STUDIO — Profitability Tracking
// ============================================
// ALL costs must be recovered from customers.
// Every generation must be profitable after GPU + API + taxes + overhead.

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

// Claude API cost per Brain Studio generation (USD)
// ~2K input + 2K output tokens per plan = ~$0.08-0.12 per Brain call
export const CLAUDE_API_COST_PER_BRAIN = 0.10;

// Credit value in USD (based on Creator plan: 500 credits / $12)
export const CREDIT_VALUE_USD = 0.024;

// ============================================
// TAX & PAYMENT PROCESSING — deducted from revenue
// ============================================
export const VAT_RATE = 0.15;            // South Africa VAT 15%
export const PAYMENT_PROCESSOR_FEE = 0.035; // PayStack/Yoco ~3.5%

// Net revenue multiplier: what we actually keep from R1 charged
// R1 charged → R1/1.15 (ex-VAT) → × 0.965 (after processor fee)
export const NET_REVENUE_MULTIPLIER = (1 / (1 + VAT_RATE)) * (1 - PAYMENT_PROCESSOR_FEE);
// = 0.8696 × 0.965 = 0.839 → we keep R0.84 of every R1 charged

// ============================================
// MONTHLY FIXED COSTS (USD) — must be covered by subscriptions
// ============================================
export const FIXED_COSTS_MONTHLY = {
  supabase: 25,       // Database + Storage + Edge Functions
  clerk: 25,          // Authentication + User Management
  cloudflare: 20,     // CDN + DDoS + SSL
  upstash: 10,        // Redis/Queue
  vercel: 20,         // Hosting (Pro plan)
  resend: 20,         // Transactional email (welcome, receipts, alerts)
  domains: 5,         // Domain renewals (genesis-studio.com etc)
  claude_api: 30,     // Claude API for Brain Studio planner
  analytics: 0,       // Vercel Analytics (included in Pro)
  monitoring: 0,      // Error tracking (Sentry free tier)
  total: 155,
};

/**
 * Estimate GPU/API cost for a generation in USD.
 * This is the DIRECT cost of running the generation on GPU/API.
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
    const resMultiplier = resolution === "1080p" ? 1.5 : 1;
    return perSecondRate * durationSeconds * resMultiplier;
  }

  // RunPod models — estimated GPU rental cost
  const gpuType = MODEL_GPU_MAP[modelId] || "RTX_4090";
  const hourlyRate = GPU_RATES[gpuType] || 0.69;

  const baseSecs = model.avgGenerationTime;
  const durationMultiplier = durationSeconds / 5;
  const resMultiplier = resolution === "1080p" ? 2.5 : resolution === "4k" ? 5 : resolution === "720p" ? 1.5 : 1;
  const estimatedGpuSeconds = baseSecs * durationMultiplier * Math.sqrt(resMultiplier);

  return (estimatedGpuSeconds * hourlyRate) / 3600;
}

/**
 * Estimate the FULL cost of a generation including all overhead.
 * GPU + Claude API (if Brain) + infrastructure overhead per generation.
 */
export function estimateFullCostUsd(
  modelId: string,
  durationSeconds: number,
  resolution: string,
  isBrainStudio: boolean = false,
  estimatedMonthlyGenerations: number = 1000
): number {
  // Direct GPU/API cost
  let cost = estimateGpuCostUsd(modelId, durationSeconds, resolution);

  // Claude API cost for Brain Studio planner
  if (isBrainStudio) {
    cost += CLAUDE_API_COST_PER_BRAIN;
  }

  // Amortize fixed infrastructure costs across all generations
  // $155/mo ÷ estimated monthly generations = overhead per generation
  const overheadPerGeneration = FIXED_COSTS_MONTHLY.total / estimatedMonthlyGenerations;
  cost += overheadPerGeneration;

  return cost;
}

/**
 * Calculate GROSS revenue from credits charged (before taxes/fees)
 */
export function creditsToRevenueGross(credits: number): number {
  return credits * CREDIT_VALUE_USD;
}

/**
 * Calculate NET revenue from credits charged (after VAT + payment processor)
 */
export function creditsToRevenueNet(credits: number): number {
  return credits * CREDIT_VALUE_USD * NET_REVENUE_MULTIPLIER;
}

// Keep backward-compatible alias
export const creditsToRevenue = creditsToRevenueGross;

/**
 * Get margin percentage for a generation (using NET revenue after taxes)
 */
export function getGenerationMargin(
  creditsCharged: number,
  gpuCostUsd: number
): number {
  const revenue = creditsToRevenueNet(creditsCharged);
  if (revenue === 0) return 0;
  return ((revenue - gpuCostUsd) / revenue) * 100;
}

/**
 * Full profitability check including ALL costs.
 * A generation must be profitable after: GPU + API + taxes + fees + overhead.
 * Target: minimum 40% net margin.
 */
export function isProfitable(
  creditsCharged: number,
  modelId: string,
  duration: number,
  resolution: string,
  isBrainStudio: boolean = false
): { profitable: boolean; margin: number; gpuCost: number; fullCost: number; grossRevenue: number; netRevenue: number } {
  const gpuCost = estimateGpuCostUsd(modelId, duration, resolution);
  const fullCost = estimateFullCostUsd(modelId, duration, resolution, isBrainStudio);
  const grossRevenue = creditsToRevenueGross(creditsCharged);
  const netRevenue = creditsToRevenueNet(creditsCharged);
  const margin = netRevenue > 0 ? ((netRevenue - fullCost) / netRevenue) * 100 : 0;

  return {
    profitable: margin > 40,  // Must have 40%+ net margin
    margin: Math.round(margin),
    gpuCost: Math.round(gpuCost * 1000) / 1000,
    fullCost: Math.round(fullCost * 1000) / 1000,
    grossRevenue: Math.round(grossRevenue * 1000) / 1000,
    netRevenue: Math.round(netRevenue * 1000) / 1000,
  };
}

/**
 * Calculate break-even number of paid users including ALL costs
 */
export function calculateBreakEven(
  avgRevenuePerUserUsd: number = 24.60,
  fixedCosts: number = FIXED_COSTS_MONTHLY.total,
  avgGpuCostPerUser: number = 5
): number {
  // Net revenue per user after VAT + payment fees
  const netRevenuePerUser = avgRevenuePerUserUsd * NET_REVENUE_MULTIPLIER;
  const netPerUser = netRevenuePerUser - avgGpuCostPerUser;
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
    maxCreditsPerMonth: 8000,
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

/**
 * Storage limits per plan tier
 */
export const STORAGE_LIMITS = {
  free: {
    maxVideos: 10,
    retentionDays: 30,
    maxFileSizeBytes: 50_000_000, // 50MB
  },
  creator: {
    maxVideos: 100,
    retentionDays: 180,
    maxFileSizeBytes: 100_000_000, // 100MB
  },
  pro: {
    maxVideos: 500,
    retentionDays: 365,
    maxFileSizeBytes: 200_000_000, // 200MB
  },
  studio: {
    maxVideos: -1, // Unlimited
    retentionDays: -1, // Forever
    maxFileSizeBytes: 500_000_000, // 500MB
  },
} as const;

/**
 * Check if user can store another video based on their plan
 */
export function checkStorageLimits(
  plan: string,
  currentVideoCount: number
): { allowed: boolean; reason?: string } {
  const limits = STORAGE_LIMITS[plan as keyof typeof STORAGE_LIMITS] || STORAGE_LIMITS.free;

  if (limits.maxVideos !== -1 && currentVideoCount >= limits.maxVideos) {
    return {
      allowed: false,
      reason: `Storage limit reached (${limits.maxVideos} videos on ${plan} plan). Delete old videos or upgrade.`,
    };
  }

  return { allowed: true };
}
