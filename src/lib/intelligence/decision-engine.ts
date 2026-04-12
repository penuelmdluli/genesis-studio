// ============================================================
// GENESIS INTELLIGENCE — Decision Engine
// Reads insights and makes real decisions that change
// how future content is generated
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase";

interface ProductionConfig {
  category?: string;
  scheduledHour?: number;
  targetDuration?: number;
  musicStyle?: string;
  hookStyle?: string;
  [key: string]: unknown;
}

interface AIDecision {
  type: string;
  before: string;
  after: string;
  reason: string;
  insightId?: string;
  confidence: number;
}

interface Insight {
  id: string;
  insight_type: string;
  insight_key: string;
  insight_value: Record<string, unknown>;
  confidence_score: number;
  avg_performance_score: number;
  avg_views: number;
  avg_engagement_rate: number;
}

// Apply all intelligence insights to a production config
export async function applyIntelligenceToProduction(
  pageId: string,
  productionConfig: ProductionConfig,
): Promise<{ config: ProductionConfig; decisions: AIDecision[] }> {
  const supabase = createSupabaseAdmin();
  const decisions: AIDecision[] = [];
  const improved = { ...productionConfig };

  // Load active insights
  const { data: insights } = await supabase
    .from("content_intelligence")
    .select("*")
    .eq("page_id", pageId)
    .eq("is_active", true);

  if (!insights?.length) return { config: improved, decisions };

  const insightMap = new Map<string, Insight>();
  for (const i of insights) {
    insightMap.set(`${i.insight_type}:${i.insight_key}`, i as Insight);
  }

  const byType = (type: string) =>
    (insights as Insight[]).filter((i) => i.insight_type === type);

  // DECISION 1: Topic Category
  const worstCategories = byType("worst_topic_category").map((i) => i.insight_key);
  const bestCategories = byType("best_topic_category").map((i) => i.insight_key);

  if (improved.category && worstCategories.includes(improved.category) && bestCategories.length > 0) {
    const before = improved.category;
    improved.category = bestCategories[0];
    decisions.push({
      type: "category_boosted",
      before,
      after: improved.category,
      reason: `${before} historically underperforms on this page. ${improved.category} scores highest.`,
      confidence: 0.7,
    });
  }

  // DECISION 2: Posting Time
  const bestHours = byType("best_posting_hour");
  if (bestHours.length > 0 && bestHours[0].confidence_score > 0.5) {
    const best = bestHours[0];
    const before = String(improved.scheduledHour ?? "default");
    improved.scheduledHour = parseInt(best.insight_key);
    decisions.push({
      type: "hour_changed",
      before,
      after: best.insight_key,
      reason: `Posts at ${best.insight_key}:00 get ${Math.round(best.avg_views)} avg views.`,
      insightId: best.id,
      confidence: best.confidence_score,
    });
  }

  // DECISION 3: Video Duration
  const bestLength = byType("best_video_length")[0];
  if (bestLength && bestLength.confidence_score > 0.4) {
    const optSecs = (bestLength.insight_value as Record<string, unknown>)?.optimal_seconds;
    if (typeof optSecs === "number" && optSecs > 0) {
      const before = String(improved.targetDuration ?? "default");
      improved.targetDuration = optSecs;
      decisions.push({
        type: "duration_adjusted",
        before,
        after: String(optSecs),
        reason: `${optSecs}s videos get ${(bestLength.insight_value as Record<string, unknown>)?.completion_rate || "?"}% completion rate.`,
        insightId: bestLength.id,
        confidence: bestLength.confidence_score,
      });
    }
  }

  // DECISION 4: Music Style
  const bestMusic = byType("best_music_style")[0];
  if (bestMusic && bestMusic.confidence_score > 0.4) {
    const before = improved.musicStyle || "default";
    improved.musicStyle = bestMusic.insight_key;
    decisions.push({
      type: "music_changed",
      before,
      after: improved.musicStyle,
      reason: `${bestMusic.insight_key} music drives ${Math.round(bestMusic.avg_engagement_rate * 100)}% engagement rate.`,
      insightId: bestMusic.id,
      confidence: bestMusic.confidence_score,
    });
  }

  // DECISION 5: Hook Style
  const bestHook = byType("best_hook_style")[0];
  if (bestHook && bestHook.confidence_score > 0.4) {
    const before = improved.hookStyle || "default";
    improved.hookStyle = bestHook.insight_key;
    decisions.push({
      type: "hook_improved",
      before,
      after: improved.hookStyle,
      reason: `${bestHook.insight_key} hooks get best watch time on this page.`,
      insightId: bestHook.id,
      confidence: bestHook.confidence_score,
    });
  }

  // DECISION 6: Apply Viral Formula
  const { data: formulas } = await supabase
    .from("viral_formulas")
    .select("*")
    .eq("page_id", pageId)
    .order("avg_viral_score", { ascending: false })
    .limit(1);

  if (formulas?.[0] && formulas[0].success_rate > 0.5) {
    const formula = formulas[0];
    if (formula.topic_category) improved.category = formula.topic_category;
    if (formula.optimal_duration) improved.targetDuration = formula.optimal_duration;
    if (formula.music_style) improved.musicStyle = formula.music_style;
    if (formula.optimal_hour != null) improved.scheduledHour = formula.optimal_hour;
    decisions.push({
      type: "viral_formula_applied",
      before: "default_config",
      after: formula.formula_name || "formula",
      reason: `Viral formula has ${Math.round(formula.success_rate * 100)}% success rate based on top performers.`,
      confidence: formula.success_rate,
    });
  }

  // Save all decisions
  for (const d of decisions) {
    await supabase.from("ai_decisions").insert({
      page_id: pageId,
      decision_type: d.type,
      before_value: d.before,
      after_value: d.after,
      reason: d.reason,
      based_on_insight_id: d.insightId || null,
      confidence_score: d.confidence,
    });
  }

  return { config: improved, decisions };
}

// Get intelligence summary for a page
export async function getPageIntelligenceSummary(pageId: string): Promise<{
  totalPosts: number;
  lockedPosts: number;
  totalDecisions: number;
  correctDecisions: number;
  avgPerformanceScore: number;
  insightCount: number;
  lastAnalysis: string | null;
  hasViralFormula: boolean;
}> {
  const supabase = createSupabaseAdmin();

  const [postsResult, lockedResult, decisionsResult, correctResult, insightsResult, formulaResult] = await Promise.all([
    supabase.from("post_performance").select("id", { count: "exact", head: true }).eq("page_id", pageId),
    supabase.from("post_performance").select("performance_score", { count: "exact" }).eq("page_id", pageId).eq("metrics_locked", true),
    supabase.from("ai_decisions").select("id", { count: "exact", head: true }).eq("page_id", pageId),
    supabase.from("ai_decisions").select("id", { count: "exact", head: true }).eq("page_id", pageId).eq("was_correct", true),
    supabase.from("content_intelligence").select("id, generated_at", { count: "exact" }).eq("page_id", pageId).eq("is_active", true).order("generated_at", { ascending: false }).limit(1),
    supabase.from("viral_formulas").select("id", { count: "exact", head: true }).eq("page_id", pageId),
  ]);

  const lockedPosts = lockedResult.data || [];
  const avgScore = lockedPosts.length > 0
    ? lockedPosts.reduce((s, p) => s + ((p as Record<string, number>).performance_score || 0), 0) / lockedPosts.length
    : 0;

  return {
    totalPosts: postsResult.count || 0,
    lockedPosts: lockedPosts.length,
    totalDecisions: decisionsResult.count || 0,
    correctDecisions: correctResult.count || 0,
    avgPerformanceScore: Math.round(avgScore * 10) / 10,
    insightCount: insightsResult.count || 0,
    lastAnalysis: insightsResult.data?.[0]?.generated_at || null,
    hasViralFormula: (formulaResult.count || 0) > 0,
  };
}
