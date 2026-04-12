// ============================================================
// GENESIS INTELLIGENCE — Facebook Insights Fetcher
// Fetches real performance metrics from FB Graph API
// and stores them in post_performance table
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase";

const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

// Page tokens map — loaded from env
function getPageTokens(): Record<string, string> {
  return {
    tech_news: process.env.FB_PAGE_TOKEN_tech_news || "",
    ai_money: process.env.FB_PAGE_TOKEN_ai_money || "",
    motivation: process.env.FB_PAGE_TOKEN_motivation || "",
    health_wellness: process.env.FB_PAGE_TOKEN_health_wellness || "",
    blissful_moments: process.env.FB_PAGE_TOKEN_blissful_moments || "",
    limitless_you: process.env.FB_PAGE_TOKEN_limitless_you || "",
    pop_culture_buzz: process.env.FB_PAGE_TOKEN_pop_culture_buzz || "",
  };
}

// Map page_id (dev_pages id) to fb_page_key
const PAGE_ID_TO_FB_KEY: Record<string, string> = {
  tech_pulse_africa_dev: "tech_news",
  ai_revolution_dev: "ai_money",
  afrika_toons_dev: "motivation",
  world_news_animated_dev: "health_wellness",
  mzansi_baby_stars: "blissful_moments",
  africa_2050_dev: "limitless_you",
  pop_culture_buzz_dev: "pop_culture_buzz",
};

export function getTokenForPage(pageId: string): string {
  const tokens = getPageTokens();
  const fbKey = PAGE_ID_TO_FB_KEY[pageId];
  return fbKey ? tokens[fbKey] || "" : "";
}

interface FBMetrics {
  views: number;
  uniqueViewers: number;
  watchTimeSeconds: number;
  avgWatchTimeSeconds: number;
  completionRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  negativeFeedback: number;
  clicks: number;
}

// Fetch insights for a single post/video from Facebook
export async function fetchPostInsights(
  fbPostId: string,
  pageToken: string,
): Promise<FBMetrics | null> {
  if (!pageToken || !fbPostId) return null;

  const metrics: FBMetrics = {
    views: 0, uniqueViewers: 0, watchTimeSeconds: 0,
    avgWatchTimeSeconds: 0, completionRate: 0,
    likes: 0, comments: 0, shares: 0, saves: 0,
    reach: 0, impressions: 0, negativeFeedback: 0, clicks: 0,
  };

  try {
    // Step 1: Basic counts
    const basicRes = await fetch(
      `${FB_GRAPH_BASE}/${fbPostId}?fields=likes.summary(true),comments.summary(true),shares,views&access_token=${pageToken}`
    );
    if (basicRes.ok) {
      const data = await basicRes.json();
      metrics.views = data.views || 0;
      metrics.likes = data.likes?.summary?.total_count || 0;
      metrics.comments = data.comments?.summary?.total_count || 0;
      metrics.shares = data.shares?.count || 0;
    } else if (basicRes.status === 429) {
      console.warn(`[FB-INSIGHTS] Rate limited on ${fbPostId}`);
      return null;
    }

    // Step 2: Video insights
    const insightMetrics = [
      "total_video_views",
      "total_video_impressions",
      "total_video_impressions_unique",
      "total_video_avg_time_watched",
      "total_video_complete_views_auto_played",
      "total_video_complete_views_clicked_to_play",
    ].join(",");

    const insightRes = await fetch(
      `${FB_GRAPH_BASE}/${fbPostId}/video_insights?metric=${insightMetrics}&access_token=${pageToken}`
    );
    if (insightRes.ok) {
      const insightData = await insightRes.json();
      const insightMap: Record<string, number> = {};
      for (const item of insightData.data || []) {
        const val = item.values?.[0]?.value;
        if (typeof val === "number") {
          insightMap[item.name] = val;
        }
      }
      metrics.views = Math.max(metrics.views, insightMap["total_video_views"] || 0);
      metrics.impressions = insightMap["total_video_impressions"] || 0;
      metrics.reach = insightMap["total_video_impressions_unique"] || 0;
      metrics.avgWatchTimeSeconds = (insightMap["total_video_avg_time_watched"] || 0) / 1000;
      const autoComplete = insightMap["total_video_complete_views_auto_played"] || 0;
      const clickComplete = insightMap["total_video_complete_views_clicked_to_play"] || 0;
      const totalComplete = autoComplete + clickComplete;
      metrics.completionRate = metrics.views > 0 ? totalComplete / metrics.views : 0;
    }

    // Step 3: Try reel metrics as fallback
    if (metrics.views === 0) {
      const reelMetrics = "fb_reels_total_plays,fb_reels_reach,fb_reels_avg_watch_time";
      const reelRes = await fetch(
        `${FB_GRAPH_BASE}/${fbPostId}/video_insights?metric=${reelMetrics}&access_token=${pageToken}`
      );
      if (reelRes.ok) {
        const reelData = await reelRes.json();
        for (const item of reelData.data || []) {
          const val = item.values?.[0]?.value;
          if (typeof val === "number") {
            if (item.name === "fb_reels_total_plays") metrics.views = val;
            if (item.name === "fb_reels_reach") metrics.reach = val;
            if (item.name === "fb_reels_avg_watch_time") metrics.avgWatchTimeSeconds = val / 1000;
          }
        }
      }
    }

    return metrics;
  } catch (err) {
    console.error(`[FB-INSIGHTS] Error fetching ${fbPostId}:`, err);
    return null;
  }
}

// Performance scoring algorithm
export function calculatePerformanceScore(m: {
  views: number; reach: number; likes: number;
  comments: number; shares: number; completionRate: number;
  negativeFeedback: number; engagementRate: number;
}): number {
  const viewScore = Math.min(25, Math.log10(Math.max(m.views, 1) + 1) * 6.25);
  const engagementScore = Math.min(30, m.engagementRate * 600);
  const watchScore = Math.min(25, m.completionRate * 27.8);
  const viral = m.shares / Math.max(m.reach, 1);
  const viralScore = Math.min(15, viral * 300);
  const negPenalty = Math.min(5, m.negativeFeedback * 0.5);
  return Math.max(0, Math.min(100, viewScore + engagementScore + watchScore + viralScore - negPenalty));
}

export function getPerformanceTier(score: number): string {
  if (score >= 80) return "viral";
  if (score >= 60) return "great";
  if (score >= 40) return "good";
  if (score >= 20) return "poor";
  return "dead";
}

// Fetch insights for all unlocked posts on a page
export async function fetchAllPageInsights(pageId: string): Promise<{
  fetched: number; updated: number; locked: number; errors: number;
}> {
  const supabase = createSupabaseAdmin();
  const stats = { fetched: 0, updated: 0, locked: 0, errors: 0 };

  const token = getTokenForPage(pageId);
  if (!token) {
    console.warn(`[FB-INSIGHTS] No token for page ${pageId}`);
    return stats;
  }

  // Get all unlocked posts for this page
  const { data: posts, error } = await supabase
    .from("post_performance")
    .select("id, fb_post_id, fb_video_id, posted_at, views")
    .eq("page_id", pageId)
    .eq("metrics_locked", false)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (error || !posts?.length) return stats;

  // Process in batches of 10
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 500;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    for (const post of batch) {
      const fbId = post.fb_post_id || post.fb_video_id;
      if (!fbId) continue;

      stats.fetched++;
      const metrics = await fetchPostInsights(fbId, token);
      if (!metrics) {
        stats.errors++;
        continue;
      }

      const engagementRate = metrics.reach > 0
        ? (metrics.likes + metrics.comments + metrics.shares) / metrics.reach
        : 0;
      const viralScore = metrics.reach > 0
        ? metrics.shares / metrics.reach
        : 0;
      const perfScore = calculatePerformanceScore({
        views: metrics.views, reach: metrics.reach,
        likes: metrics.likes, comments: metrics.comments,
        shares: metrics.shares, completionRate: metrics.completionRate,
        negativeFeedback: metrics.negativeFeedback,
        engagementRate,
      });
      const tier = getPerformanceTier(perfScore);

      // Check if post is older than 7 days → lock metrics
      const postedAt = new Date(post.posted_at);
      const ageMs = Date.now() - postedAt.getTime();
      const shouldLock = ageMs > 7 * 24 * 60 * 60 * 1000;

      const { error: updateErr } = await supabase
        .from("post_performance")
        .update({
          views: metrics.views,
          unique_viewers: metrics.uniqueViewers,
          watch_time_seconds: Math.round(metrics.avgWatchTimeSeconds * metrics.views),
          avg_watch_time_seconds: metrics.avgWatchTimeSeconds,
          completion_rate: metrics.completionRate,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          reach: metrics.reach,
          impressions: metrics.impressions,
          negative_feedback: metrics.negativeFeedback,
          engagement_rate: engagementRate,
          viral_score: viralScore,
          performance_score: perfScore,
          performance_tier: tier,
          last_fetched_at: new Date().toISOString(),
          fetch_count: (post as Record<string, unknown>).fetch_count
            ? ((post as Record<string, unknown>).fetch_count as number) + 1
            : 1,
          metrics_locked: shouldLock,
        })
        .eq("id", post.id);

      if (updateErr) {
        stats.errors++;
      } else {
        stats.updated++;
        if (shouldLock) stats.locked++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  // Mark best/worst performers
  await markExtremePerformers(pageId);

  return stats;
}

async function markExtremePerformers(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();

  // Reset flags
  await supabase
    .from("post_performance")
    .update({ is_best_performer: false, is_worst_performer: false })
    .eq("page_id", pageId);

  // Mark top 10% as best
  const { data: allPosts } = await supabase
    .from("post_performance")
    .select("id, performance_score")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .order("performance_score", { ascending: false });

  if (!allPosts?.length) return;

  const top10Pct = Math.max(1, Math.ceil(allPosts.length * 0.1));
  const bottom10Pct = Math.max(1, Math.ceil(allPosts.length * 0.1));

  const bestIds = allPosts.slice(0, top10Pct).map((p) => p.id);
  const worstIds = allPosts.slice(-bottom10Pct).map((p) => p.id);

  if (bestIds.length) {
    await supabase
      .from("post_performance")
      .update({ is_best_performer: true })
      .in("id", bestIds);
  }
  if (worstIds.length) {
    await supabase
      .from("post_performance")
      .update({ is_worst_performer: true })
      .in("id", worstIds);
  }
}

// Record a new post for learning immediately after posting
export async function recordPostForLearning(params: {
  productionId?: string;
  queueItemId?: string;
  pageId: string;
  fbPostId?: string;
  fbVideoId?: string;
  topic?: string;
  topicCategory?: string;
  headline?: string;
  hookText?: string;
  musicStyle?: string;
  videoDurationSeconds?: number;
  sceneCount?: number;
  voiceStyle?: string;
  pillar?: string;
  engine?: string;
}): Promise<void> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  await supabase.from("post_performance").insert({
    production_id: params.productionId || null,
    queue_item_id: params.queueItemId || null,
    page_id: params.pageId,
    fb_post_id: params.fbPostId || null,
    fb_video_id: params.fbVideoId || null,
    topic: params.topic || null,
    topic_category: params.topicCategory || null,
    headline: params.headline || null,
    hook_text: params.hookText || null,
    music_style: params.musicStyle || null,
    video_duration_seconds: params.videoDurationSeconds || null,
    scene_count: params.sceneCount || null,
    voice_style: params.voiceStyle || null,
    pillar: params.pillar || null,
    engine: params.engine || null,
    posted_at: now.toISOString(),
    day_of_week: now.getDay(),
    hour_of_day: now.getHours(),
  });
}

// Log events for the feedback system
export async function logFeedbackEvent(
  eventType: string,
  pageId: string | null,
  details: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("feedback_system_logs").insert({
    event_type: eventType,
    page_id: pageId,
    details,
    error: error || null,
  }).then(() => {});
}
