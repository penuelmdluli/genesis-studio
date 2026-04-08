/**
 * Multi-Source News Aggregator
 *
 * Fetches trending topics from all configured sources, deduplicates by
 * topic similarity, boosts viral potential for cross-source stories,
 * and returns a unified sorted list.
 */

import { v4 as uuidv4 } from "uuid";
import { GeminiNewsItem, fetchGeminiTrends } from "./gemini";

export interface UnifiedNewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  viral_potential: number;
  content_angle: string;
  suggested_hook: string;
  region: string;
  source: string;
  sources_count: number;
  timestamp: string;
  page_target: string | null;
  status: "pending" | "queued" | "generated" | "posted";
}

/**
 * Check if two topic titles are similar using word overlap.
 * Returns true if >50% of words (length > 3) overlap.
 */
function areSimilarTopics(a: string, b: string): boolean {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length;
  return overlap / Math.min(wordsA.size, wordsB.size) > 0.5;
}

function toUnified(item: GeminiNewsItem): UnifiedNewsItem {
  return {
    id: uuidv4(),
    title: item.title,
    summary: item.summary,
    category: item.category,
    viral_potential: item.viral_potential,
    content_angle: item.content_angle,
    suggested_hook: item.suggested_hook,
    region: item.region,
    source: item.source,
    sources_count: 1,
    timestamp: item.timestamp,
    page_target: null,
    status: "pending",
  };
}

/**
 * Deduplicate items by topic similarity.
 * When duplicates are found, merge them: keep the highest viral_potential,
 * increment sources_count, and boost viral_potential based on cross-source count.
 */
function deduplicateItems(items: UnifiedNewsItem[]): UnifiedNewsItem[] {
  const merged: UnifiedNewsItem[] = [];

  for (const item of items) {
    const existing = merged.find((m) => areSimilarTopics(m.title, item.title));
    if (existing) {
      existing.sources_count += 1;
      // Keep the better data
      if (item.viral_potential > existing.viral_potential) {
        existing.viral_potential = item.viral_potential;
        existing.summary = item.summary;
        existing.content_angle = item.content_angle;
        existing.suggested_hook = item.suggested_hook;
      }
    } else {
      merged.push({ ...item });
    }
  }

  // Apply cross-source boost
  for (const item of merged) {
    if (item.sources_count >= 3) {
      item.viral_potential = Math.min(10, item.viral_potential + 3);
    } else if (item.sources_count === 2) {
      item.viral_potential = Math.min(10, item.viral_potential + 1);
    }
  }

  return merged;
}

/**
 * Aggregate trending topics from all configured sources.
 * Currently supports: Gemini.
 * Future: NewsAPI, Reddit, Twitter/X, etc.
 */
export async function aggregateAllSources(): Promise<UnifiedNewsItem[]> {
  const allItems: UnifiedNewsItem[] = [];

  // 1. Fetch from Gemini
  try {
    const geminiItems = await fetchGeminiTrends();
    allItems.push(...geminiItems.map(toUnified));
    console.log(`[Aggregator] Gemini returned ${geminiItems.length} items`);
  } catch (error) {
    console.error("[Aggregator] Gemini source failed:", error);
  }

  // 2. Fetch from NewsAPI (existing source — no Gemini key needed)
  try {
    const newsApiKey = process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY;
    if (newsApiKey) {
      const categories = ["general", "technology", "business", "entertainment"];
      const newsResults = await Promise.allSettled(
        categories.map(async (category) => {
          const res = await fetch(
            `https://newsapi.org/v2/top-headlines?category=${category}&language=en&pageSize=5&apiKey=${newsApiKey}`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (!res.ok) return [];
          const data = await res.json();
          return (data.articles || []).map((a: { title: string; description: string | null; source: { name: string } }) => ({
            title: a.title || "",
            summary: a.description || "",
            category: category === "general" ? "breaking" : category as "technology" | "entertainment" | "breaking",
            viral_potential: 6,
            content_angle: `Cover this ${category} story as a 30-second animated news clip`,
            suggested_hook: a.title?.split(" - ")[0] || a.title || "",
            region: "GLOBAL",
            source: "newsapi",
            timestamp: new Date().toISOString(),
          }));
        })
      );
      const newsItems = newsResults
        .filter((r): r is PromiseFulfilledResult<GeminiNewsItem[]> => r.status === "fulfilled")
        .flatMap((r) => r.value)
        .filter((item) => item.title && item.title.length > 10);
      allItems.push(...newsItems.map(toUnified));
      console.log(`[Aggregator] NewsAPI returned ${newsItems.length} items`);
    }
  } catch (error) {
    console.error("[Aggregator] NewsAPI source failed:", error);
  }

  // 3. Fetch from Reddit (free, no API key needed)
  try {
    const subreddits = ["worldnews", "technology", "entertainment", "GetMotivated"];
    const redditResults = await Promise.allSettled(
      subreddits.map(async (sub) => {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
          headers: { "User-Agent": "GenesisStudio/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data?.data?.children || []).map((post: { data: { title: string; score: number; subreddit: string } }) => ({
          title: post.data.title || "",
          summary: `Trending on r/${post.data.subreddit} with ${post.data.score} upvotes`,
          category: sub === "technology" ? "technology" : sub === "GetMotivated" ? "culture" : "breaking" as "technology" | "culture" | "breaking",
          viral_potential: Math.min(10, Math.round(post.data.score / 5000) + 5),
          content_angle: `Viral Reddit story — great for animated news or commentary`,
          suggested_hook: post.data.title?.slice(0, 80) || "",
          region: "GLOBAL",
          source: "reddit",
          timestamp: new Date().toISOString(),
        }));
      })
    );
    const redditItems = redditResults
      .filter((r): r is PromiseFulfilledResult<GeminiNewsItem[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .filter((item) => item.title && item.title.length > 10);
    allItems.push(...redditItems.map(toUnified));
    console.log(`[Aggregator] Reddit returned ${redditItems.length} items`);
  } catch (error) {
    console.error("[Aggregator] Reddit source failed:", error);
  }

  // Future: Twitter/X, TikTok Creative Center, Google Trends RSS

  // 3. Deduplicate
  const deduplicated = deduplicateItems(allItems);
  console.log(
    `[Aggregator] ${allItems.length} raw → ${deduplicated.length} after dedup`,
  );

  // 4. Sort by viral_potential DESC, then timestamp DESC
  deduplicated.sort((a, b) => {
    if (b.viral_potential !== a.viral_potential) {
      return b.viral_potential - a.viral_potential;
    }
    return b.timestamp.localeCompare(a.timestamp);
  });

  return deduplicated;
}
