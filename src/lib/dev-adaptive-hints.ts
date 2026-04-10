/**
 * Dev Adaptive Hints — the brain that teaches every part of the pipeline
 * from past engagement data.
 *
 * Everything here reads from dev_content_queue.input_data.latest_metrics
 * (populated by /api/dev/pull-metrics). No new tables. No extra DDL.
 *
 * Exposed signals:
 *  - preferredCtaPatternFor(pageId)   -> which of the 6 CTA patterns wins on this page
 *  - preferredEngineFor(pillar)       -> which engine produced the best engagement for this pillar
 *  - preferredSourceBoosts()          -> per-source trend boost from past winners
 *  - bestPostingHourFor(pageId)       -> UTC hour that produced the best mean engagement
 *
 * Each signal falls back gracefully when there isn't enough data yet
 * (returns undefined / empty map). Consumers must handle that.
 */

import { createSupabaseAdmin } from "@/lib/supabase";
import { ModelId } from "@/types";

const LOOKBACK_DAYS = 30;
const MIN_SAMPLES_FOR_DECISION = 2;

type CtaPattern =
  | "authority"
  | "intimacy"
  | "curiosity"
  | "community"
  | "fomo"
  | "gratitude";

export interface AdaptiveHints {
  /** Per-page preferred CTA pattern (only pages with MIN_SAMPLES_FOR_DECISION+ samples) */
  ctaPatternByPage: Record<string, CtaPattern>;
  /** Per-pillar preferred engine override */
  engineByPillar: Record<string, ModelId>;
  /** Per-source trend boost — positive for winners, negative for losers */
  sourceBoosts: Record<string, number>;
  /** Per-page best posting hour (0-23 UTC) */
  bestHourByPage: Record<string, number>;
  /** Total sample size used to compute these hints */
  samples: number;
}

interface LatestMetricsShape {
  combined?: {
    engagement_rate?: number;
    views?: number;
  };
}

interface QueueItemRow {
  page_id: string;
  pillar: string;
  engine: string;
  posted_at: string | null;
  input_data: Record<string, unknown>;
}

/**
 * Load everything once and compute all adaptive signals. Designed to be called
 * once per scheduler cycle — the result should be cached and passed into each
 * step that needs it.
 */
export async function computeAdaptiveHints(): Promise<AdaptiveHints> {
  const empty: AdaptiveHints = {
    ctaPatternByPage: {},
    engineByPillar: {},
    sourceBoosts: {},
    bestHourByPage: {},
    samples: 0,
  };

  try {
    const supabase = createSupabaseAdmin();
    const since = new Date(
      Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("page_id, pillar, engine, posted_at, input_data")
      .eq("status", "posted")
      .gte("posted_at", since)
      .limit(500);

    if (error || !data || data.length === 0) return empty;

    const rows = data as unknown as QueueItemRow[];

    // Bucket engagement by dimension
    const ctaByPage: Record<string, Record<CtaPattern, number[]>> = {};
    const engineByPillar: Record<string, Record<string, number[]>> = {};
    const sourceBucket: Record<string, number[]> = {};
    const hourByPage: Record<string, Record<number, number[]>> = {};

    let samples = 0;

    for (const row of rows) {
      const input = row.input_data || {};
      const latest = input.latest_metrics as LatestMetricsShape | undefined;
      const engagement = Number(latest?.combined?.engagement_rate || 0);
      if (!latest?.combined) continue;
      samples++;

      const page = row.page_id || "unknown";
      const pillar = row.pillar || "unknown";
      const engine = row.engine || "unknown";
      const pattern = input.cta_pattern as CtaPattern | undefined;
      const source = input.topic_source as string | undefined;
      const postedAt = row.posted_at ? new Date(row.posted_at) : null;

      if (pattern) {
        const pageBucket = (ctaByPage[page] ||= {
          authority: [],
          intimacy: [],
          curiosity: [],
          community: [],
          fomo: [],
          gratitude: [],
        });
        pageBucket[pattern].push(engagement);
      }

      const pillarEngineBucket = (engineByPillar[pillar] ||= {});
      (pillarEngineBucket[engine] ||= []).push(engagement);

      if (source) {
        (sourceBucket[source] ||= []).push(engagement);
      }

      if (postedAt) {
        const hour = postedAt.getUTCHours();
        const pageHourBucket = (hourByPage[page] ||= {});
        (pageHourBucket[hour] ||= []).push(engagement);
      }
    }

    // Winners per dimension
    const ctaPatternByPage: Record<string, CtaPattern> = {};
    for (const [page, patterns] of Object.entries(ctaByPage)) {
      let best: { pattern: CtaPattern; mean: number; samples: number } | null =
        null;
      for (const [pattern, list] of Object.entries(patterns) as [
        CtaPattern,
        number[],
      ][]) {
        if (list.length < MIN_SAMPLES_FOR_DECISION) continue;
        const mean = list.reduce((a, b) => a + b, 0) / list.length;
        if (!best || mean > best.mean) {
          best = { pattern, mean, samples: list.length };
        }
      }
      if (best) ctaPatternByPage[page] = best.pattern;
    }

    const learnedEngineByPillar: Record<string, ModelId> = {};
    for (const [pillar, engineMap] of Object.entries(engineByPillar)) {
      let best: { engine: string; mean: number; samples: number } | null = null;
      for (const [engine, list] of Object.entries(engineMap)) {
        if (list.length < MIN_SAMPLES_FOR_DECISION) continue;
        const mean = list.reduce((a, b) => a + b, 0) / list.length;
        if (!best || mean > best.mean) best = { engine, mean, samples: list.length };
      }
      if (best) learnedEngineByPillar[pillar] = best.engine as ModelId;
    }

    // Source boosts: delta vs. global mean, scaled to integer score units
    const allEngagement = rows
      .map((r) => {
        const latest = (r.input_data?.latest_metrics as LatestMetricsShape) || {};
        return Number(latest.combined?.engagement_rate || 0);
      })
      .filter((n) => n > 0);
    const globalMean = allEngagement.length
      ? allEngagement.reduce((a, b) => a + b, 0) / allEngagement.length
      : 0;

    const sourceBoosts: Record<string, number> = {};
    for (const [source, list] of Object.entries(sourceBucket)) {
      if (list.length < MIN_SAMPLES_FOR_DECISION) continue;
      const mean = list.reduce((a, b) => a + b, 0) / list.length;
      const delta = Math.round((mean - globalMean) * 200);
      if (Math.abs(delta) >= 1) sourceBoosts[source] = delta;
    }

    const bestHourByPage: Record<string, number> = {};
    for (const [page, hourMap] of Object.entries(hourByPage)) {
      let best: { hour: number; mean: number } | null = null;
      for (const [hourStr, list] of Object.entries(hourMap)) {
        if (list.length < MIN_SAMPLES_FOR_DECISION) continue;
        const hour = Number(hourStr);
        const mean = list.reduce((a, b) => a + b, 0) / list.length;
        if (!best || mean > best.mean) best = { hour, mean };
      }
      if (best) bestHourByPage[page] = best.hour;
    }

    return {
      ctaPatternByPage,
      engineByPillar: learnedEngineByPillar,
      sourceBoosts,
      bestHourByPage,
      samples,
    };
  } catch (err) {
    console.warn("[ADAPTIVE HINTS] compute failed:", err);
    return empty;
  }
}

/**
 * Lookup helpers — all return undefined when there is no learned signal,
 * so callers can fall back to their static defaults.
 */
export function preferredCtaPatternFor(
  hints: AdaptiveHints,
  pageId: string,
): CtaPattern | undefined {
  return hints.ctaPatternByPage[pageId];
}

export function preferredEngineFor(
  hints: AdaptiveHints,
  pillar: string,
): ModelId | undefined {
  return hints.engineByPillar[pillar];
}
