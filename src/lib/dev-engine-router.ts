// ============================================
// GENESIS STUDIO — Dev Engine Router
// Smart routing: RunPod models preferred (credits available)
// FAL.AI models avoided (out of credits)
// ============================================

import { ModelId } from "@/types";

export interface EngineSelection {
  modelId: ModelId;
  provider: "runpod-hub" | "fal";
  estimatedCostUsd: number;
  reason: string;
}

// Cost estimates per generation (USD)
const ENGINE_COSTS: Record<string, number> = {
  "wan-2.2": 0.02,
  "hunyuan-video": 0.015,
  "ltx-video": 0.01,
  "mochi-1": 0.02,
  "wan-2.1-turbo": 0.01,
  // FAL models - expensive and currently out of credits
  "kling-2.6": 0.10,
  "kling-3.0": 0.15,
  "veo-3.1": 0.20,
  "seedance-1.5": 0.08,
};

export function selectEngine(
  pillar: string,
  contentType?: string,
  preferPremium?: boolean
): EngineSelection {
  // PRIORITY: Use RunPod models (user has credits there)

  // HERO content - best RunPod model
  if (pillar === "genesis_demo" || contentType === "hero") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "Hero content — Wan 2.2 flagship (RunPod credits available)",
    };
  }

  // PREMIUM: Human-heavy cinematic content
  if (
    pillar === "african_folklore" ||
    pillar === "mbs_episodes" ||
    contentType === "premium_episode"
  ) {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "Premium cinematic — Wan 2.2 (best RunPod quality)",
    };
  }

  // FAST: News content needs speed
  if (pillar === "news_animated" || pillar === "breaking_news" || pillar === "geopolitics" || contentType === "breaking_news") {
    return {
      modelId: "ltx-video" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["ltx-video"],
      reason: "Breaking news — LTX Video (fastest, 30s generation)",
    };
  }

  // ENTERTAINMENT: Celebrity/viral content — good quality
  if (pillar === "entertainment" || pillar === "celebrity" || pillar === "viral_moments") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "Entertainment content — Wan 2.2 (best visual quality)",
    };
  }

  // AI/TECH: AI disruption content
  if (pillar === "ai_news" || pillar === "ai_disruption" || pillar === "tech") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "AI/Tech content — Wan 2.2 (cinematic quality)",
    };
  }

  // AFROFUTURISM: Visual quality matters
  if (pillar === "afrofuturism" || pillar === "african_cities") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "Visual quality priority — Wan 2.2 flagship",
    };
  }

  // DEFAULT: Wan 2.2 for everything else
  return {
    modelId: "wan-2.2" as ModelId,
    provider: "runpod-hub",
    estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
    reason: "Default — Wan 2.2 (reliable, RunPod credits)",
  };
}

// Track generation cost
export interface GenerationCostEntry {
  engine: string;
  pillar: string;
  page_id: string;
  estimated_cost_usd: number;
  actual_cost_usd?: number;
  timestamp: string;
}

export function createCostEntry(
  selection: EngineSelection,
  pillar: string,
  pageId: string
): GenerationCostEntry {
  return {
    engine: selection.modelId,
    pillar,
    page_id: pageId,
    estimated_cost_usd: selection.estimatedCostUsd,
    timestamp: new Date().toISOString(),
  };
}
