/**
 * Dev Analyze Performance API — the "adapt" brain of learn-and-adapt.
 *
 * POST /api/dev/analyze-performance
 * Auth: CRON_SECRET
 *
 * Reads dev_content_queue items that already have input_data.latest_metrics
 * (populated by /api/dev/pull-metrics), aggregates engagement by
 *   - pillar  (news_animated, ai_news, etc.)
 *   - page    (tech_pulse_africa_dev, etc.)
 *   - engine  (wan-2.2, veo-3, etc.)
 *   - CTA-on vs CTA-off (when the engagementCTA flag is known)
 *
 * Returns per-group mean engagement rate + a ranked "what works" report.
 * Also writes a per-item performance_tier (top / mid / low) back onto the
 * queue row so downstream generation can prefer winning pillars.
 *
 * This endpoint is stateless — it only reads/writes JSONB on existing
 * dev_content_queue rows. No new tables required.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;

interface PlatformSnapshot {
  platform: "facebook" | "youtube";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

interface LatestMetrics {
  updated_at: string;
  facebook?: PlatformSnapshot | null;
  youtube?: PlatformSnapshot | null;
  combined?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
  };
}

interface Aggregate {
  key: string;
  samples: number;
  mean_engagement: number;
  mean_views: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
}

function toAggregateRow(key: string, bucket: number[]): Aggregate {
  return {
    key,
    samples: bucket.length,
    mean_engagement: bucket.length
      ? Number(
          (bucket.reduce((a, b) => a + b, 0) / bucket.length).toFixed(4),
        )
      : 0,
    mean_views: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
  };
}

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: items, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, engine, posted_at, input_data")
      .eq("status", "posted")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { error: `Failed to load posted items: ${error.message}` },
        { status: 500 },
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        analyzed: 0,
        note: "No posted items to analyze yet",
      });
    }

    // Buckets
    const byPillar: Record<string, number[]> = {};
    const byPage: Record<string, number[]> = {};
    const byEngine: Record<string, number[]> = {};
    const byCTA: Record<"on" | "off" | "unknown", number[]> = {
      on: [],
      off: [],
      unknown: [],
    };
    const byCtaPattern: Record<string, number[]> = {};
    const byPostingHour: Record<number, number[]> = {};
    const bySource: Record<string, number[]> = {};
    const byPagePillar: Record<string, number[]> = {};

    // Per-item list for percentile tier assignment
    const scored: Array<{
      id: string;
      page_id: string;
      pillar: string;
      engagement: number;
      views: number;
      input: Record<string, unknown>;
    }> = [];

    const totalsByPagePillar: Record<
      string,
      { views: number; likes: number; comments: number; shares: number; samples: number }
    > = {};

    let analyzed = 0;
    let skipped = 0;

    for (const item of items) {
      const input = (item.input_data as Record<string, unknown>) || {};
      const latest = input.latest_metrics as LatestMetrics | undefined;
      if (!latest || !latest.combined) {
        skipped++;
        continue;
      }

      const combined = latest.combined;
      const engagement = Number(combined.engagement_rate || 0);
      const views = Number(combined.views || 0);
      analyzed++;

      const pillar = (item.pillar as string) || "unknown";
      const pageId = (item.page_id as string) || "unknown";
      const engine = (item.engine as string) || "unknown";
      const ctaOn = (input.engagement_cta as boolean | undefined) ?? undefined;
      const ctaKey: "on" | "off" | "unknown" =
        ctaOn === true ? "on" : ctaOn === false ? "off" : "unknown";

      (byPillar[pillar] ||= []).push(engagement);
      (byPage[pageId] ||= []).push(engagement);
      (byEngine[engine] ||= []).push(engagement);
      byCTA[ctaKey].push(engagement);

      // Learn-and-adapt: tag-level aggregation
      const ctaPattern = input.cta_pattern as string | undefined;
      if (ctaPattern) {
        (byCtaPattern[ctaPattern] ||= []).push(engagement);
      }
      const source = input.topic_source as string | undefined;
      if (source) {
        (bySource[source] ||= []).push(engagement);
      }
      if (item.posted_at) {
        const hour = new Date(item.posted_at as string).getUTCHours();
        (byPostingHour[hour] ||= []).push(engagement);
      }

      const pagePillarKey = `${pageId}::${pillar}`;
      (byPagePillar[pagePillarKey] ||= []).push(engagement);

      const t =
        (totalsByPagePillar[pagePillarKey] ||= {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          samples: 0,
        });
      t.views += views;
      t.likes += Number(combined.likes || 0);
      t.comments += Number(combined.comments || 0);
      t.shares += Number(combined.shares || 0);
      t.samples += 1;

      scored.push({
        id: item.id as string,
        page_id: pageId,
        pillar,
        engagement,
        views,
        input,
      });
    }

    if (analyzed === 0) {
      return NextResponse.json({
        success: true,
        analyzed: 0,
        items: items.length,
        note: "No items had metrics yet — run /api/dev/pull-metrics first",
      });
    }

    // Compute percentile tiers (top 25% = top, bottom 25% = low, else mid)
    const sortedEng = [...scored]
      .map((s) => s.engagement)
      .sort((a, b) => a - b);
    const p75 = sortedEng[Math.floor(sortedEng.length * 0.75)] || 0;
    const p25 = sortedEng[Math.floor(sortedEng.length * 0.25)] || 0;

    // Write performance_tier back to each queue item (best-effort, non-blocking)
    let tierWrites = 0;
    for (const s of scored) {
      const tier: "top" | "mid" | "low" =
        s.engagement >= p75 ? "top" : s.engagement <= p25 ? "low" : "mid";
      const merged = {
        ...s.input,
        performance_tier: tier,
      };
      const { error: updErr } = await supabase
        .from("dev_content_queue")
        .update({ input_data: merged })
        .eq("id", s.id);
      if (!updErr) tierWrites++;
    }

    // Aggregate rows
    const pillarRows = Object.entries(byPillar)
      .map(([k, v]) => toAggregateRow(k, v))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const pageRows = Object.entries(byPage)
      .map(([k, v]) => toAggregateRow(k, v))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const engineRows = Object.entries(byEngine)
      .map(([k, v]) => toAggregateRow(k, v))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const ctaRows = Object.entries(byCTA)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => toAggregateRow(k, v));

    const ctaPatternRows = Object.entries(byCtaPattern)
      .map(([k, v]) => toAggregateRow(k, v))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const sourceRows = Object.entries(bySource)
      .map(([k, v]) => toAggregateRow(k, v))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const postingHourRows = Object.entries(byPostingHour)
      .map(([hour, v]) => ({
        hour_utc: Number(hour),
        ...toAggregateRow(`utc_${hour}`, v),
      }))
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    const pagePillarRows = Object.entries(byPagePillar)
      .map(([k, v]) => {
        const row = toAggregateRow(k, v);
        const totals = totalsByPagePillar[k];
        if (totals) {
          row.total_views = totals.views;
          row.total_likes = totals.likes;
          row.total_comments = totals.comments;
          row.total_shares = totals.shares;
          row.mean_views = totals.samples
            ? Math.round(totals.views / totals.samples)
            : 0;
        }
        return row;
      })
      .sort((a, b) => b.mean_engagement - a.mean_engagement);

    // "What works" winners and losers summary
    const winners = pagePillarRows.slice(0, 5);
    const losers = pagePillarRows.slice(-5).reverse();

    // Build learned niche_weights — boost top pillars by +3, drag bottom pillars by -2
    // These get applied on top of the static page.niche_weights in the scheduler.
    const learnedPillarBoost: Record<string, number> = {};
    const globalPillarMean =
      pillarRows.reduce((a, r) => a + r.mean_engagement, 0) /
      Math.max(pillarRows.length, 1);
    for (const row of pillarRows) {
      const delta = row.mean_engagement - globalPillarMean;
      // Amplify: +/- 10 units for each +0.05 above/below global mean
      const boost = Math.round(delta * 200);
      if (Math.abs(boost) >= 1) {
        learnedPillarBoost[row.key] = boost;
      }
    }

    return NextResponse.json({
      success: true,
      analyzed,
      skipped,
      items: items.length,
      percentiles: { p25, p75 },
      tier_writes: tierWrites,
      learned_pillar_boost: learnedPillarBoost,
      aggregates: {
        by_pillar: pillarRows,
        by_page: pageRows,
        by_engine: engineRows,
        by_cta: ctaRows,
        by_cta_pattern: ctaPatternRows,
        by_source: sourceRows,
        by_posting_hour: postingHourRows,
        by_page_pillar: pagePillarRows,
      },
      winners,
      losers,
    });
  } catch (err) {
    console.error("[ANALYZE PERFORMANCE] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
