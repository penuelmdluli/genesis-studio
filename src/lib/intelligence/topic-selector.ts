// ============================================================
// GENESIS INTELLIGENCE — Smart Topic Selector
// Selects best trending topics based on page intelligence
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase";

interface ScoredTopic {
  id: string;
  title: string;
  summary: string;
  category: string;
  viral_potential: number;
  content_angle: string;
  suggested_hook: string;
  region: string;
  source: string;
  niches: string[];
  finalScore: number;
}

export async function selectBestTopic(
  pageId: string,
  preferredCategory?: string,
): Promise<ScoredTopic | null> {
  const supabase = createSupabaseAdmin();

  // Load page intelligence
  const { data: insights } = await supabase
    .from("content_intelligence")
    .select("insight_type, insight_key, avg_performance_score")
    .eq("page_id", pageId)
    .eq("is_active", true);

  const bestCategories = (insights || [])
    .filter((i) => i.insight_type === "best_topic_category")
    .map((i) => i.insight_key);

  const worstCategories = (insights || [])
    .filter((i) => i.insight_type === "worst_topic_category")
    .map((i) => i.insight_key);

  // Load available trending topics (unused)
  const { data: topics } = await supabase
    .from("dev_trending_topics")
    .select("*")
    .eq("status", "pending")
    .order("viral_potential", { ascending: false })
    .limit(50);

  if (!topics?.length) return null;

  // Score each topic
  const scored: ScoredTopic[] = topics.map((t) => {
    let score = t.viral_potential || 5;

    // Boost if matches best performing category
    const topicNiches = (t.niches || []) as string[];
    const topicCategory = t.category || "";
    if (bestCategories.includes(topicCategory) || topicNiches.some((n) => bestCategories.includes(n))) {
      score *= 1.8;
    }

    // Penalize if matches worst performing category
    if (worstCategories.includes(topicCategory) || topicNiches.some((n) => worstCategories.includes(n))) {
      score *= 0.4;
    }

    // Boost for preferred category
    if (preferredCategory && topicCategory === preferredCategory) {
      score *= 1.3;
    }

    // Recency boost (last 2 hours)
    const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
    if (ageHours < 2) score *= 1.5;
    else if (ageHours < 6) score *= 1.2;

    // Multi-source boost
    if ((t.sources_count || 1) >= 3) score *= 1.3;
    else if ((t.sources_count || 1) >= 2) score *= 1.1;

    return {
      id: t.id,
      title: t.title,
      summary: t.summary || "",
      category: topicCategory,
      viral_potential: t.viral_potential || 5,
      content_angle: t.content_angle || "",
      suggested_hook: t.suggested_hook || "",
      region: t.region || "global",
      source: t.source || "unknown",
      niches: topicNiches,
      finalScore: score,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored[0] || null;
}
