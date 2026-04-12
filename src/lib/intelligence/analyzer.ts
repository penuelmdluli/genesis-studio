// ============================================================
// GENESIS INTELLIGENCE — Analysis Engine
// Reads performance data and extracts actionable intelligence
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase";
import { logFeedbackEvent } from "./fb-insights-fetcher";

// Classify hook text into pattern
function classifyHook(hook: string): string {
  if (!hook) return "unknown";
  const lower = hook.toLowerCase();
  if (/\?/.test(hook)) return "question";
  if (/\d/.test(hook)) return "number";
  if (/breaking|just in|urgent/i.test(lower)) return "breaking";
  if (/shock|unbelievable|insane|wild/i.test(lower)) return "shock";
  if (/africa|south africa|mzansi|naija|kenya/i.test(lower)) return "local";
  if (/you won't|nobody|secret|hidden/i.test(lower)) return "curiosity";
  return "statement";
}

// Duration bucket
function durationBucket(secs: number): string {
  if (secs <= 15) return "0-15s";
  if (secs <= 30) return "15-30s";
  if (secs <= 45) return "30-45s";
  if (secs <= 60) return "45-60s";
  return "60s+";
}

async function upsertInsight(
  pageId: string,
  insightType: string,
  insightKey: string,
  value: Record<string, unknown>,
  confidence: number,
  sampleSize: number,
  avgScore: number,
  avgViews: number,
  avgEngRate: number,
  topPostId?: string,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Delete old insight of same type+key for this page
  await supabase
    .from("content_intelligence")
    .delete()
    .eq("page_id", pageId)
    .eq("insight_type", insightType)
    .eq("insight_key", insightKey);

  await supabase.from("content_intelligence").insert({
    page_id: pageId,
    insight_type: insightType,
    insight_key: insightKey,
    insight_value: value,
    confidence_score: confidence,
    sample_size: sampleSize,
    avg_performance_score: avgScore,
    avg_views: avgViews,
    avg_engagement_rate: avgEngRate,
    top_example_post_id: topPostId || null,
    is_active: true,
    generated_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
}

// ── Analysis Functions ──

export async function analyzeTopicPerformance(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, topic_category, performance_score, views, engagement_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("topic_category", "is", null);

  if (!posts?.length) return;

  // Group by category
  const groups: Record<string, typeof posts> = {};
  for (const p of posts) {
    const cat = p.topic_category || "unknown";
    (groups[cat] ||= []).push(p);
  }

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 3)
    .map(([cat, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      const best = g.sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))[0];
      return { cat, count: g.length, avgScore, avgViews, avgEng, bestId: best.id };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  // Store top 3 as best
  for (const r of ranked.slice(0, 3)) {
    const confidence = Math.min(1, r.count / 20);
    await upsertInsight(pageId, "best_topic_category", r.cat, {
      avg_score: r.avgScore, sample_size: r.count, avg_views: r.avgViews,
    }, confidence, r.count, r.avgScore, r.avgViews, r.avgEng, r.bestId);
  }

  // Store bottom 2 as worst
  for (const r of ranked.slice(-2)) {
    const confidence = Math.min(1, r.count / 20);
    await upsertInsight(pageId, "worst_topic_category", r.cat, {
      avg_score: r.avgScore, sample_size: r.count, avg_views: r.avgViews,
    }, confidence, r.count, r.avgScore, r.avgViews, r.avgEng);
  }
}

export async function analyzeBestPostingTime(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, hour_of_day, performance_score, views, engagement_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("hour_of_day", "is", null);

  if (!posts?.length) return;

  const groups: Record<number, typeof posts> = {};
  for (const p of posts) {
    const h = p.hour_of_day ?? 0;
    (groups[h] ||= []).push(p);
  }

  const overallAvg = posts.reduce((s, p) => s + (p.views || 0), 0) / posts.length;

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([hour, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      return { hour: parseInt(hour), count: g.length, avgScore, avgViews, avgEng };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const r of ranked.slice(0, 3)) {
    const confidence = Math.min(1, r.count / 10);
    await upsertInsight(pageId, "best_posting_hour", String(r.hour), {
      avg_score: r.avgScore, overall_avg: overallAvg, sample_size: r.count,
    }, confidence, r.count, r.avgScore, r.avgViews, r.avgEng);
  }
}

export async function analyzeBestDay(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, day_of_week, performance_score, views, engagement_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("day_of_week", "is", null);

  if (!posts?.length) return;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const groups: Record<number, typeof posts> = {};
  for (const p of posts) {
    const d = p.day_of_week ?? 0;
    (groups[d] ||= []).push(p);
  }

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([day, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      return { day: parseInt(day), name: dayNames[parseInt(day)], count: g.length, avgScore, avgViews, avgEng };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const r of ranked.slice(0, 2)) {
    await upsertInsight(pageId, "best_day", r.name, {
      day_number: r.day, avg_score: r.avgScore,
    }, Math.min(1, r.count / 8), r.count, r.avgScore, r.avgViews, r.avgEng);
  }
}

export async function analyzeVideoLength(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, video_duration_seconds, performance_score, views, engagement_rate, completion_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("video_duration_seconds", "is", null);

  if (!posts?.length) return;

  const groups: Record<string, typeof posts> = {};
  for (const p of posts) {
    const bucket = durationBucket(p.video_duration_seconds || 0);
    (groups[bucket] ||= []).push(p);
  }

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([bucket, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      const avgCompletion = g.reduce((s, p) => s + (p.completion_rate || 0), 0) / g.length;
      const avgDuration = g.reduce((s, p) => s + (p.video_duration_seconds || 0), 0) / g.length;
      return { bucket, count: g.length, avgScore, avgViews, avgEng, avgCompletion, avgDuration };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  if (ranked.length > 0) {
    const best = ranked[0];
    await upsertInsight(pageId, "best_video_length", best.bucket, {
      optimal_seconds: Math.round(best.avgDuration),
      completion_rate: Math.round(best.avgCompletion * 100),
      avg_score: best.avgScore,
    }, Math.min(1, best.count / 10), best.count, best.avgScore, best.avgViews, best.avgEng);
  }
}

export async function analyzeMusicPerformance(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, music_style, performance_score, views, engagement_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("music_style", "is", null);

  if (!posts?.length) return;

  const groups: Record<string, typeof posts> = {};
  for (const p of posts) {
    const style = p.music_style || "unknown";
    (groups[style] ||= []).push(p);
  }

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([style, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      return { style, count: g.length, avgScore, avgViews, avgEng };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  if (ranked.length > 0) {
    await upsertInsight(pageId, "best_music_style", ranked[0].style, {
      avg_score: ranked[0].avgScore,
    }, Math.min(1, ranked[0].count / 10), ranked[0].count,
    ranked[0].avgScore, ranked[0].avgViews, ranked[0].avgEng);
  }
}

export async function analyzeHookPerformance(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: posts } = await supabase
    .from("post_performance")
    .select("id, hook_text, performance_score, views, avg_watch_time_seconds, engagement_rate")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .not("hook_text", "is", null);

  if (!posts?.length) return;

  const groups: Record<string, typeof posts> = {};
  for (const p of posts) {
    const pattern = classifyHook(p.hook_text || "");
    (groups[pattern] ||= []).push(p);
  }

  const overallAvgWatch = posts.reduce((s, p) => s + (p.avg_watch_time_seconds || 0), 0) / posts.length;

  const ranked = Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([pattern, g]) => {
      const avgScore = g.reduce((s, p) => s + (p.performance_score || 0), 0) / g.length;
      const avgViews = g.reduce((s, p) => s + (p.views || 0), 0) / g.length;
      const avgEng = g.reduce((s, p) => s + (p.engagement_rate || 0), 0) / g.length;
      const avgWatch = g.reduce((s, p) => s + (p.avg_watch_time_seconds || 0), 0) / g.length;
      return { pattern, count: g.length, avgScore, avgViews, avgEng, avgWatch };
    })
    .sort((a, b) => b.avgWatch - a.avgWatch);

  if (ranked.length > 0) {
    const best = ranked[0];
    await upsertInsight(pageId, "best_hook_style", best.pattern, {
      avg_watch_time: Math.round(best.avgWatch * 10) / 10,
      overall_avg: Math.round(overallAvgWatch * 10) / 10,
      avg_score: best.avgScore,
    }, Math.min(1, best.count / 10), best.count, best.avgScore, best.avgViews, best.avgEng);
  }
}

export async function extractViralFormula(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();

  // Get top 10% performers
  const { data: allPosts } = await supabase
    .from("post_performance")
    .select("*")
    .eq("page_id", pageId)
    .eq("metrics_locked", true)
    .order("performance_score", { ascending: false });

  if (!allPosts?.length || allPosts.length < 10) return;

  const top10Pct = allPosts.slice(0, Math.max(3, Math.ceil(allPosts.length * 0.1)));

  // Find most common patterns among top performers
  const categoryCounts: Record<string, number> = {};
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  const durationSum: number[] = [];
  const musicCounts: Record<string, number> = {};
  const hookCounts: Record<string, number> = {};

  for (const p of top10Pct) {
    if (p.topic_category) categoryCounts[p.topic_category] = (categoryCounts[p.topic_category] || 0) + 1;
    if (p.hour_of_day != null) hourCounts[p.hour_of_day] = (hourCounts[p.hour_of_day] || 0) + 1;
    if (p.day_of_week != null) dayCounts[p.day_of_week] = (dayCounts[p.day_of_week] || 0) + 1;
    if (p.video_duration_seconds) durationSum.push(p.video_duration_seconds);
    if (p.music_style) musicCounts[p.music_style] = (musicCounts[p.music_style] || 0) + 1;
    if (p.hook_text) hookCounts[classifyHook(p.hook_text)] = (hookCounts[classifyHook(p.hook_text)] || 0) + 1;
  }

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const avgDuration = durationSum.length > 0 ? Math.round(durationSum.reduce((a, b) => a + b, 0) / durationSum.length) : 45;
  const topMusic = Object.entries(musicCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const avgViralScore = top10Pct.reduce((s, p) => s + (p.viral_score || 0), 0) / top10Pct.length;
  const avgViews = Math.round(top10Pct.reduce((s, p) => s + (p.views || 0), 0) / top10Pct.length);

  const formulaName = `${topCategory || "mixed"}_${topHour || "any"}h_${avgDuration}s`;

  // Upsert formula
  await supabase
    .from("viral_formulas")
    .delete()
    .eq("page_id", pageId);

  await supabase.from("viral_formulas").insert({
    page_id: pageId,
    formula_name: formulaName,
    topic_category: topCategory || null,
    hook_pattern: topHook || null,
    optimal_duration: avgDuration,
    optimal_hour: topHour ? parseInt(topHour) : null,
    optimal_day: topDay ? parseInt(topDay) : null,
    music_style: topMusic || null,
    avg_viral_score: avgViralScore,
    avg_views: avgViews,
    success_rate: top10Pct.length / allPosts.length,
  });
}

export async function detectTrendingPatterns(pageId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Recent 7 days
  const { data: recent } = await supabase
    .from("post_performance")
    .select("topic_category, performance_score")
    .eq("page_id", pageId)
    .gte("posted_at", sevenDaysAgo.toISOString())
    .not("topic_category", "is", null);

  // Previous 7 days
  const { data: previous } = await supabase
    .from("post_performance")
    .select("topic_category, performance_score")
    .eq("page_id", pageId)
    .gte("posted_at", fourteenDaysAgo.toISOString())
    .lt("posted_at", sevenDaysAgo.toISOString())
    .not("topic_category", "is", null);

  if (!recent?.length || !previous?.length) return;

  const recentAvg: Record<string, { sum: number; count: number }> = {};
  for (const p of recent) {
    const cat = p.topic_category!;
    recentAvg[cat] ||= { sum: 0, count: 0 };
    recentAvg[cat].sum += p.performance_score || 0;
    recentAvg[cat].count++;
  }

  const prevAvg: Record<string, { sum: number; count: number }> = {};
  for (const p of previous) {
    const cat = p.topic_category!;
    prevAvg[cat] ||= { sum: 0, count: 0 };
    prevAvg[cat].sum += p.performance_score || 0;
    prevAvg[cat].count++;
  }

  for (const [cat, r] of Object.entries(recentAvg)) {
    const prev = prevAvg[cat];
    if (!prev || prev.count < 2 || r.count < 2) continue;

    const recentScore = r.sum / r.count;
    const prevScore = prev.sum / prev.count;
    const delta = recentScore - prevScore;

    if (Math.abs(delta) > 5) {
      const direction = delta > 0 ? "trending_up" : "trending_down";
      await upsertInsight(pageId, "trending_pattern", cat, {
        direction,
        recent_avg: Math.round(recentScore * 10) / 10,
        previous_avg: Math.round(prevScore * 10) / 10,
        delta: Math.round(delta * 10) / 10,
      }, Math.min(1, (r.count + prev.count) / 20), r.count + prev.count,
      recentScore, 0, 0);
    }
  }
}

// Master analysis runner
export async function runFullAnalysis(pageId: string): Promise<{ insightsGenerated: number }> {
  const supabase = createSupabaseAdmin();

  // Check minimum post count
  const { count } = await supabase
    .from("post_performance")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("metrics_locked", true);

  if (!count || count < 5) {
    return { insightsGenerated: 0 };
  }

  // Clear expired insights
  await supabase
    .from("content_intelligence")
    .delete()
    .eq("page_id", pageId)
    .lt("expires_at", new Date().toISOString());

  // Run all analyses in parallel
  await Promise.all([
    analyzeTopicPerformance(pageId),
    analyzeBestPostingTime(pageId),
    analyzeBestDay(pageId),
    analyzeVideoLength(pageId),
    analyzeMusicPerformance(pageId),
    analyzeHookPerformance(pageId),
    extractViralFormula(pageId),
    detectTrendingPatterns(pageId),
  ]);

  // Count new insights
  const { count: insightCount } = await supabase
    .from("content_intelligence")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("is_active", true);

  await logFeedbackEvent("analysis_complete", pageId, {
    postCount: count,
    insightsGenerated: insightCount || 0,
    timestamp: new Date().toISOString(),
  });

  return { insightsGenerated: insightCount || 0 };
}

// Get all active page IDs from existing posts
export async function getAllActivePageIds(): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("post_performance")
    .select("page_id")
    .limit(1000);

  if (!data) return [];
  return [...new Set(data.map((d) => d.page_id))];
}
