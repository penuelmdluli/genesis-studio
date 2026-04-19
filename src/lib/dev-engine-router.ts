// ============================================
// GENESIS STUDIO — Dev Engine Router
// Smart routing: balanced SPEED × QUALITY × COST. All RunPod models.
//
// Model comparison (from constants.ts):
//   model         | avgGen | $/gen  | quality       | use
//   ltx-video     |  30s   | $0.01  | good (fast)   | breaking news, speed-first
//   wan-2.1-turbo |  60s   | $0.01  | good          | i2v only (not used here)
//   hunyuan-video |  75s   | $0.015 | VERY GOOD     | workhorse — best cost/quality/speed ratio
//   wan-2.2       | ~120s  | $0.02  | FLAGSHIP      | cinematic / character-heavy
//   mochi-1       | 180s   | $0.02  | photorealistic| slow, only when realism required
//
// Strategy — three tiers, chosen for best $/quality/speed balance:
//  1. hunyuan-video (workhorse + flagship-downgraded) for ~90% of content —
//     explicitly described as "best efficiency/quality ratio" in constants.ts.
//  2. ltx-video (speed tier) for breaking news + geopolitics where
//     minutes-old stories need to ship fast, quality is secondary.
//  3. wan-2.2 (flagship tier) ONLY for explicit contentType="premium_episode"
//     or contentType="hero". Pillars no longer auto-qualify — quality gap vs
//     hunyuan is small enough that the cost/speed win dominates at our volume.
//
// Net effect vs old router (wan-2.2 for all character-heavy pillars):
//  • ~25–50% cheaper per video ($0.02 → $0.015 / $0.01)
//  • ~35% faster on downgraded flagship path (120s → 75s)
//  • Wan 2.2 still reachable via explicit contentType override
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
  preferPremium?: boolean,
  learnedOverride?: ModelId,
): EngineSelection {
  // Learn-and-adapt: if the analytics layer has a proven winner for this
  // pillar, honor it regardless of the static routing below — BUT only when
  // the override is one of the RunPod models we can afford.
  const AFFORDABLE = new Set<ModelId>([
    "wan-2.2" as ModelId,
    "hunyuan-video" as ModelId,
    "ltx-video" as ModelId,
    "wan-2.1-turbo" as ModelId,
    "mochi-1" as ModelId,
  ]);
  if (learnedOverride && AFFORDABLE.has(learnedOverride)) {
    return {
      modelId: learnedOverride,
      provider: "runpod-hub",
      estimatedCostUsd:
        ENGINE_COSTS[learnedOverride as string] ?? ENGINE_COSTS["wan-2.2"],
      reason: `Learn-and-adapt override — ${learnedOverride} is the past winner for pillar "${pillar}"`,
    };
  }

  // PRIORITY: Use RunPod models (user has credits there)

  // HERO content — explicit flagship override
  if (contentType === "hero") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason: "Hero content — Wan 2.2 flagship (quality over speed)",
    };
  }

  // TIER 1 — FLAGSHIP: Only "hero" / explicit "premium_episode" still pay the
  // Wan 2.2 premium. Afrofuturism, folklore, MBS episodes, African cities, and
  // baby scenarios are downgraded to hunyuan-video: 25% cheaper ($0.02 →
  // $0.015), ~35% faster (120s → 75s), and the quality gap is small enough that
  // the cost/speed win dominates at our volume. If any pillar visibly regresses
  // we can hoist it back with contentType="premium_episode".
  if (contentType === "premium_episode") {
    return {
      modelId: "wan-2.2" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["wan-2.2"],
      reason:
        "Flagship tier — Wan 2.2 (explicit premium_episode override)",
    };
  }

  // TIER 1b — FLAGSHIP-DOWNGRADED: Character/cinematic pillars now use
  // hunyuan-video. Same "very good" quality bracket per constants.ts, a lot
  // faster, and $0.005/gen cheaper than Wan 2.2. Saves ~25% on the largest
  // share of our spend.
  if (
    pillar === "african_folklore" ||
    pillar === "mbs_episodes" ||
    pillar === "afrofuturism" ||
    pillar === "african_cities" ||
    pillar === "baby_scenarios"
  ) {
    return {
      modelId: "hunyuan-video" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["hunyuan-video"],
      reason:
        "Flagship-downgraded tier — HunyuanVideo (~25% cheaper, ~35% faster than Wan 2.2, very good quality)",
    };
  }

  // TIER 2 — SPEED: Breaking news and geopolitics must ship fast. LTX Video
  // is 2.5× faster than hunyuan (30s vs 75s) and 4× faster than Wan 2.2,
  // and the cheapest option at $0.01/gen. Quality is "good enough" for
  // news-animation style where the story matters more than the render.
  if (
    pillar === "breaking_news" ||
    pillar === "geopolitics" ||
    pillar === "news_animated" ||
    contentType === "breaking_news"
  ) {
    return {
      modelId: "ltx-video" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["ltx-video"],
      reason:
        "Speed tier — LTX Video (30s avg, cheapest, fastest time-to-publish)",
    };
  }

  // TIER 3 — WORKHORSE: hunyuan-video for everything else. Per constants.ts
  // this model is explicitly "best efficiency/quality ratio" — 75s avg, 720p,
  // $0.015/gen. Covers tech, ai_news, ai_disruption, entertainment, celebrity,
  // viral_moments, motivation, health_wellness, finance, and any unknown
  // pillar. Best balance of speed, quality, and cost for the workhorse path.
  return {
    modelId: "hunyuan-video" as ModelId,
    provider: "runpod-hub",
    estimatedCostUsd: ENGINE_COSTS["hunyuan-video"],
    reason:
      "Workhorse tier — HunyuanVideo (best quality/cost/speed ratio: 75s, $0.015, very good)",
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
