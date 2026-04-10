/**
 * Dev Pull Metrics API — the "learn" half of learn-and-adapt.
 *
 * POST /api/dev/pull-metrics
 * Auth: CRON_SECRET
 *
 * Walks dev_content_queue for items with status='posted' and stored post_ids,
 * queries Facebook Graph API video insights + YouTube Data API video stats,
 * and stores a snapshot into input_data.metrics_history + input_data.latest_metrics.
 *
 * Rate-limited and idempotent — runs daily via the scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const maxDuration = 300;

// FB page keys → token env var (keep in sync with post-to-facebook route)
const FB_TOKEN_ENV: Record<string, string> = {
  tech_news: "FB_PAGE_TOKEN_tech_news",
  ai_money: "FB_PAGE_TOKEN_ai_money",
  motivation: "FB_PAGE_TOKEN_motivation",
  health_wellness: "FB_PAGE_TOKEN_health_wellness",
  blissful_moments: "FB_PAGE_TOKEN_blissful_moments",
  limitless_you: "FB_PAGE_TOKEN_limitless_you",
  pop_culture_buzz: "FB_PAGE_TOKEN_pop_culture_buzz",
};

interface PlatformSnapshot {
  platform: "facebook" | "youtube";
  snapshot_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach?: number;
  impressions?: number;
  watch_time_sec?: number;
  engagement_rate: number; // (likes + comments + shares) / max(views, 1)
  raw?: Record<string, unknown>;
  error?: string;
}

async function fetchFacebookInsights(
  fbPostOrVideoId: string,
  pageKey: string,
): Promise<PlatformSnapshot | null> {
  const envName = FB_TOKEN_ENV[pageKey];
  if (!envName) {
    return {
      platform: "facebook",
      snapshot_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
      error: `No token env registered for page key "${pageKey}"`,
    };
  }
  const token = (process.env[envName] || "").replace(/'/g, "");
  if (!token) {
    return {
      platform: "facebook",
      snapshot_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
      error: `${envName} is empty — cannot fetch insights`,
    };
  }

  // FB reels return a video id. Query video insights + engagement counts on the
  // underlying video node. The id we stored came from publishData.id which for
  // reels is the video id.
  try {
    // 1. Get like + comment counts on the video node itself
    const countsRes = await fetch(
      `https://graph.facebook.com/v19.0/${fbPostOrVideoId}?fields=likes.summary(true),comments.summary(true),views&access_token=${token}`,
    );
    const countsData: Record<string, unknown> = await countsRes.json();
    const likes =
      ((countsData.likes as Record<string, unknown> | undefined)?.summary as
        | Record<string, number>
        | undefined)?.total_count ?? 0;
    const comments =
      ((countsData.comments as Record<string, unknown> | undefined)?.summary as
        | Record<string, number>
        | undefined)?.total_count ?? 0;
    const basicViews = (countsData.views as number | undefined) ?? 0;

    // 2. Pull video insights (reach, impressions, total plays, shares)
    let impressions = 0;
    let reach = 0;
    let shares = 0;
    let views = basicViews;
    let watchTimeSec = 0;
    try {
      const metrics = [
        "total_video_views",
        "total_video_impressions",
        "total_video_impressions_unique",
        "total_video_avg_time_watched",
        "post_video_social_actions",
      ].join(",");
      const insRes = await fetch(
        `https://graph.facebook.com/v19.0/${fbPostOrVideoId}/video_insights?metric=${metrics}&access_token=${token}`,
      );
      const insData: Record<string, unknown> = await insRes.json();
      const rows = (insData.data as Array<Record<string, unknown>>) || [];
      for (const row of rows) {
        const name = row.name as string;
        const values = (row.values as Array<Record<string, unknown>>) || [];
        const val = (values[0]?.value as number | undefined) ?? 0;
        if (name === "total_video_views") views = val || views;
        if (name === "total_video_impressions") impressions = val;
        if (name === "total_video_impressions_unique") reach = val;
        if (name === "total_video_avg_time_watched") watchTimeSec = val / 1000;
        if (name === "post_video_social_actions") shares = val;
      }
    } catch {
      /* insights may be unavailable for reels — fall through with basic counts */
    }

    const denom = Math.max(views, 1);
    const engagement_rate = (likes + comments + shares) / denom;

    return {
      platform: "facebook",
      snapshot_at: new Date().toISOString(),
      views,
      likes,
      comments,
      shares,
      reach,
      impressions,
      watch_time_sec: watchTimeSec,
      engagement_rate,
      raw: countsData,
    };
  } catch (err) {
    return {
      platform: "facebook",
      snapshot_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchYouTubeStats(
  ytVideoId: string,
): Promise<PlatformSnapshot | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      platform: "youtube",
      snapshot_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
      error: "YOUTUBE_API_KEY not set",
    };
  }
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ytVideoId}&key=${apiKey}`,
    );
    const data: Record<string, unknown> = await res.json();
    const items = (data.items as Array<Record<string, unknown>>) || [];
    const stats = (items[0]?.statistics as Record<string, string>) || {};
    const views = Number(stats.viewCount || 0);
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const shares = 0; // YT public API does not expose shares
    const denom = Math.max(views, 1);
    const engagement_rate = (likes + comments) / denom;

    return {
      platform: "youtube",
      snapshot_at: new Date().toISOString(),
      views,
      likes,
      comments,
      shares,
      engagement_rate,
      raw: stats as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return {
      platform: "youtube",
      snapshot_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
    // Pull posts from the last 30 days that have at least one platform post_id.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: items, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, posted_at, input_data")
      .eq("status", "posted")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: `Failed to load posted items: ${error.message}` },
        { status: 500 },
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        pulled: 0,
        items: 0,
        note: "No posted items found in the last 30 days",
      });
    }

    const perItemResults: Array<{
      id: string;
      page: string;
      pillar: string;
      platforms: string[];
      engagement_rate: number;
      views: number;
      error?: string;
    }> = [];
    let pulled = 0;

    for (const item of items) {
      const input = (item.input_data as Record<string, unknown>) || {};
      const postIds = (input.post_ids as Record<string, string> | undefined) || {};
      const fbId = postIds.facebook;
      const fbPageKey = postIds.facebook_page_key || "";
      const ytId = postIds.youtube;

      if (!fbId && !ytId) {
        continue; // legacy posts without stored ids — skip
      }

      const snapshots: PlatformSnapshot[] = [];
      const platforms: string[] = [];

      if (fbId && fbPageKey) {
        const fb = await fetchFacebookInsights(fbId, fbPageKey);
        if (fb) {
          snapshots.push(fb);
          platforms.push("fb");
        }
      }
      if (ytId) {
        const yt = await fetchYouTubeStats(ytId);
        if (yt) {
          snapshots.push(yt);
          platforms.push("yt");
        }
      }

      if (snapshots.length === 0) continue;

      // Compute combined latest metrics
      const combinedViews = snapshots.reduce((a, s) => a + s.views, 0);
      const combinedLikes = snapshots.reduce((a, s) => a + s.likes, 0);
      const combinedComments = snapshots.reduce((a, s) => a + s.comments, 0);
      const combinedShares = snapshots.reduce((a, s) => a + s.shares, 0);
      const combinedEngagement =
        (combinedLikes + combinedComments + combinedShares) /
        Math.max(combinedViews, 1);

      const existingHistory =
        (input.metrics_history as PlatformSnapshot[] | undefined) || [];
      // Cap history to last 20 snapshots per queue item to stay bounded
      const trimmedHistory = [...existingHistory, ...snapshots].slice(-20);

      const mergedInput = {
        ...input,
        metrics_history: trimmedHistory,
        latest_metrics: {
          updated_at: new Date().toISOString(),
          facebook: snapshots.find((s) => s.platform === "facebook") || null,
          youtube: snapshots.find((s) => s.platform === "youtube") || null,
          combined: {
            views: combinedViews,
            likes: combinedLikes,
            comments: combinedComments,
            shares: combinedShares,
            engagement_rate: combinedEngagement,
          },
        },
      };

      await supabase
        .from("dev_content_queue")
        .update({ input_data: mergedInput })
        .eq("id", item.id);

      pulled++;
      perItemResults.push({
        id: item.id,
        page: item.page_id,
        pillar: item.pillar,
        platforms,
        engagement_rate: Number(combinedEngagement.toFixed(4)),
        views: combinedViews,
        error: snapshots.find((s) => s.error)?.error,
      });
    }

    return NextResponse.json({
      success: true,
      pulled,
      items: items.length,
      results: perItemResults,
    });
  } catch (err) {
    console.error("[PULL METRICS] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
