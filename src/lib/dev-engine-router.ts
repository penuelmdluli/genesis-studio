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

  // PRIORITY: Use RunPod models (user has credits there).
  // Wan 2.2 has been RETIRED as the default engine — it requires H100-class
  // GPUs, which caused chronic "GPU supply low" / cold-start / timeout issues.
  // Hunyuan + LTX run on widely-available RTX 4090s and are far more reliable.
  // Wan 2.2 remains reachable only via an explicit learnedOverride above.

  // SPEED TIER — time-sensitive content ships fast on LTX-Video: ~3x faster
  // than Hunyuan, ~$0.01/gen, runs on cheap, always-available GPUs. Quality is
  // secondary when minutes-old stories need to go out immediately.
  const SPEED_PILLARS = new Set<string>([
    "breaking_news",
    "breaking-news",
    "news",
    "geopolitics",
  ]);
  if (SPEED_PILLARS.has(pillar)) {
    return {
      modelId: "ltx-video" as ModelId,
      provider: "runpod-hub",
      estimatedCostUsd: ENGINE_COSTS["ltx-video"],
      reason:
        "Speed tier — LTX-Video (fast, high GPU availability) for time-sensitive pillar",
    };
  }

  // WORKHORSE — Hunyuan Video is now the default engine for ~90% of content:
  // best natural motion/physics, mature ecosystem, strong cost/quality/speed
  // ratio, and it runs reliably on available GPUs. Covers hero/premium too,
  // since it is the highest-quality engine we can serve dependably.
  return {
    modelId: "hunyuan-video" as ModelId,
    provider: "runpod-hub",
    estimatedCostUsd: ENGINE_COSTS["hunyuan-video"],
    reason:
      "Workhorse — Hunyuan Video (best quality/cost/reliability; replaces Wan 2.2 as primary)",
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
