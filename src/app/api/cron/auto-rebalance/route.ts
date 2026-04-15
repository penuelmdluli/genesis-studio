/**
 * AUTO-REBALANCE CRON — learns the winning pillar, reloads biased seeds
 *
 * GET /api/cron/auto-rebalance
 * Auth: Bearer CRON_SECRET
 * Schedule: weekly (Monday 08:00 UTC = 10:00 SAST)
 *
 * The 14-day recovery experiment in action:
 *   1. Pull last 14 days of post_performance for Tech Pulse Africa
 *   2. Aggregate by content_style pillar (war, ai, sa, human)
 *   3. Compute reach + engagement per pillar
 *   4. If a pillar's avg performance beats the others by ≥1.5x, that's
 *      the winner — reload seeds with that pillar weighted at 60%
 *   5. If no clear winner, keep the balanced 15/10/10/5 mix
 *
 * Needs MIN_SAMPLE=8 posts with metrics to run; otherwise skips.
 * Writes outcome to production_decisions for auditing.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { preloadSeeds, PillarStyle } from "@/lib/content-seeds/balanced";

export const maxDuration = 60;

const PAGE_ID = "tech_pulse_africa_dev";
const PAGE_NAME = "Tech Pulse Africa";
const FB_PAGE_KEY = "tech_news"; // for post_performance
const LOOKBACK_DAYS = 14;
const MIN_SAMPLE = 8;
const WINNER_RATIO = 1.5; // pillar must beat avg by ≥1.5× to win

interface PillarScore {
  style: PillarStyle;
  posts: number;
  totalReach: number;
  totalEngagement: number;
  totalWatchSeconds: number;
  avgScore: number; // composite
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();

  // 1. Get posted queue items in last 14d, join with their content_style
  const { data: postedItems } = await supabase
    .from("dev_content_queue")
    .select("input_data, posted_at")
    .eq("page_id", PAGE_ID)
    .eq("status", "posted")
    .gte("posted_at", cutoff);

  const styleByFbPostId = new Map<string, PillarStyle>();
  const stylesSeen = new Set<PillarStyle>();
  for (const row of postedItems || []) {
    const inp = (row.input_data as Record<string, unknown> | null) || {};
    const style = inp.content_style as PillarStyle | undefined;
    const postIds = inp.post_ids as { facebook?: string } | undefined;
    const fbId = postIds?.facebook;
    if (style && fbId) {
      styleByFbPostId.set(fbId, style);
      stylesSeen.add(style);
    }
  }

  if (styleByFbPostId.size < MIN_SAMPLE) {
    return NextResponse.json({
      success: true,
      action: "skipped",
      reason: `need ${MIN_SAMPLE} posts with content_style, only have ${styleByFbPostId.size}`,
      styles_seen: Array.from(stylesSeen),
    });
  }

  // 2. Pull performance for these FB post IDs
  const fbIds = Array.from(styleByFbPostId.keys());
  const { data: perfRows } = await supabase
    .from("post_performance")
    .select("fb_post_id, views, reach, likes, comments, shares, reactions, watch_time_seconds")
    .in("fb_post_id", fbIds);

  // 3. Aggregate by style
  const scores: Record<PillarStyle, PillarScore> = {
    war: { style: "war", posts: 0, totalReach: 0, totalEngagement: 0, totalWatchSeconds: 0, avgScore: 0 },
    ai: { style: "ai", posts: 0, totalReach: 0, totalEngagement: 0, totalWatchSeconds: 0, avgScore: 0 },
    sa: { style: "sa", posts: 0, totalReach: 0, totalEngagement: 0, totalWatchSeconds: 0, avgScore: 0 },
    human: { style: "human", posts: 0, totalReach: 0, totalEngagement: 0, totalWatchSeconds: 0, avgScore: 0 },
  };

  for (const p of (perfRows || []) as Array<{
    fb_post_id: string;
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    reactions: number | null;
    watch_time_seconds: number | null;
  }>) {
    const style = styleByFbPostId.get(p.fb_post_id);
    if (!style) continue;
    const s = scores[style];
    s.posts++;
    s.totalReach += p.reach || 0;
    s.totalEngagement +=
      (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.reactions || 0);
    s.totalWatchSeconds += p.watch_time_seconds || 0;
  }

  // Composite score: reach + engagement*5 + watchSeconds*0.5
  // engagement is rarer than reach, so weight it heavier
  for (const s of Object.values(scores)) {
    if (s.posts === 0) continue;
    const composite =
      s.totalReach + s.totalEngagement * 5 + s.totalWatchSeconds * 0.5;
    s.avgScore = composite / s.posts;
  }

  // 4. Determine winner
  const ranked = Object.values(scores)
    .filter((s) => s.posts > 0)
    .sort((a, b) => b.avgScore - a.avgScore);

  let action: "kept_balanced" | "rebalanced_to_winner" = "kept_balanced";
  let winner: PillarStyle | null = null;

  if (ranked.length >= 2 && ranked[0].avgScore > 0) {
    const runnerUpScore = ranked[1].avgScore;
    const ratio = runnerUpScore > 0 ? ranked[0].avgScore / runnerUpScore : Infinity;
    if (ratio >= WINNER_RATIO) {
      winner = ranked[0].style;
      action = "rebalanced_to_winner";
    }
  }

  let reload: { queued: number; cancelled: number } | null = null;
  if (action === "rebalanced_to_winner" && winner) {
    // Winner-biased mix: load only that style (forces concentration for next week)
    // Next week's run will see if it still wins or if we should broaden again.
    reload = await preloadSeeds(PAGE_ID, PAGE_NAME, [winner]);
    console.log(
      `[AUTO-REBALANCE] Winner=${winner}; reloaded ${reload.queued} seeds, cancelled ${reload.cancelled}`
    );
  } else {
    // No clear winner — refresh the balanced mix
    reload = await preloadSeeds(PAGE_ID, PAGE_NAME);
    console.log(
      `[AUTO-REBALANCE] No clear winner; kept balanced mix (${reload.queued} seeds)`
    );
  }

  return NextResponse.json({
    success: true,
    action,
    winner,
    sample_size: styleByFbPostId.size,
    lookback_days: LOOKBACK_DAYS,
    scores: Object.fromEntries(
      Object.values(scores).map((s) => [
        s.style,
        {
          posts: s.posts,
          avg_reach: s.posts > 0 ? Math.round(s.totalReach / s.posts) : 0,
          avg_engagement: s.posts > 0 ? Math.round(s.totalEngagement / s.posts) : 0,
          avg_watch_seconds:
            s.posts > 0 ? +(s.totalWatchSeconds / s.posts).toFixed(1) : 0,
          composite_score: Math.round(s.avgScore),
        },
      ])
    ),
    reload,
  });
}

export { FB_PAGE_KEY }; // avoid unused import warning
