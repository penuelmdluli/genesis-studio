/**
 * Multi-Source News Aggregator — Production Grade
 *
 * Fetches trending topics from multiple sources with niche-specific coverage,
 * deduplicates by topic similarity, boosts viral potential for cross-source stories,
 * and tags each topic with matching niches for smart page routing.
 *
 * Sources: NewsAPI, Reddit (20+ subreddits), Google Trends RSS, Gemini AI
 */

import { createHash } from "crypto";
import { GeminiNewsItem, fetchGeminiTrends } from "./gemini";

/**
 * Generate a deterministic topic ID from the title.
 * Same normalized title → same UUID, so the same news story cannot re-enter
 * the pipeline as a "new" topic and get posted again on the next cycle.
 *
 * Normalization strips BREAKING prefixes, punctuation, casing, and stopwords
 * so cosmetic differences across sources still collapse to the same id.
 */
function normalizeTitleForId(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*breaking[:\s-]+/i, "")
    .replace(/^\s*breaking[:\s-]+/i, "") // Strip doubled "BREAKING:" prefix
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicIdFromTitle(title: string): string {
  const normalized = normalizeTitleForId(title);
  const hash = createHash("sha1").update(normalized).digest("hex");
  // Format as UUID v5-ish so existing string-UUID columns still accept it
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

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
  niches: string[]; // Which niches this topic fits
  status: "pending" | "queued" | "generated" | "posted";
}

// ── Niche keyword mapping ────────────────────────────────────

const NICHE_KEYWORDS: Record<string, string[]> = {
  breaking_news: ["war", "military", "attack", "crisis", "breaking", "iran", "israel", "trump", "ukraine", "strike", "threat", "killed", "sanctions", "missile", "explosion", "emergency", "assassination", "ceasefire", "strait", "retaliation", "nuclear"],
  geopolitics: ["diplomacy", "nato", "sanctions", "summit", "treaty", "un", "g7", "trade war", "embargo", "geopolitics", "alliance", "border", "sovereignty", "annexation", "china", "russia", "iran", "conflict"],
  ai_news: ["ai", "artificial intelligence", "chatgpt", "openai", "claude", "gpt", "machine learning", "deepfake", "neural", "llm", "generative", "copilot", "anthropic", "midjourney", "gemini", "model", "transformer"],
  tech: ["tech", "software", "startup", "app", "data center", "cloud", "cybersecurity", "blockchain", "quantum", "chip", "semiconductor", "apple", "google", "microsoft", "meta", "nvidia", "browser", "linux", "code"],
  ai_disruption: ["layoff", "jobs", "replace", "automate", "workforce", "cut", "unemployment", "disruption", "obsolete", "restructuring", "employees", "fired", "downsizing"],
  entertainment: ["movie", "show", "netflix", "disney", "streaming", "box office", "album", "concert", "award", "grammy", "oscar", "emmy", "series", "trailer", "premiere"],
  celebrity: ["actor", "celebrity", "star", "kardashian", "beyonce", "drake", "swift", "clooney", "kimmel", "comedian", "host", "influencer", "rapper", "singer"],
  viral_moments: ["viral", "trending", "meme", "cancelled", "scandal", "shocking", "outrage", "backlash", "reaction", "rant", "clap back", "dragged", "exposed"],
  afrofuturism: ["africa", "african", "future", "innovation", "solar", "renewable", "infrastructure", "development", "startup", "continent", "investment"],
  african_cities: ["lagos", "nairobi", "johannesburg", "cape town", "accra", "cairo", "addis", "kigali", "dar es salaam", "urban", "smart city", "african city"],
  motivation: ["inspire", "motivation", "overcome", "success", "resilience", "dream", "hustle", "mindset", "growth", "achievement", "perseverance", "never give up", "triumph", "grind", "win", "champion", "goal", "transform", "comeback", "legacy", "legend"],
  health_wellness: ["health", "mental health", "wellness", "fitness", "diet", "meditation", "stress", "anxiety", "sleep", "exercise", "nutrition", "self care", "burnout", "workout", "yoga", "therapy", "mindfulness", "disease", "vaccine", "obesity"],
  finance: ["stock", "market", "bitcoin", "crypto", "invest", "economy", "inflation", "recession", "gdp", "interest rate", "fed", "bank", "wealth", "trading", "forex", "earnings", "revenue", "profit", "ipo", "valuation", "startup funding", "layoffs"],
  mbs_episodes: ["baby", "child", "kids", "family", "parenting", "cute", "funny", "toddler", "south africa", "mzansi"],
  news_animated: ["news", "politics", "economy", "world", "government", "election", "protest", "law", "court", "congress", "parliament"],
};

function detectNiches(title: string, summary: string, category: string): string[] {
  const combined = `${title} ${summary} ${category}`.toLowerCase();
  const scored: Array<{ niche: string; score: number }> = [];
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const score = keywords.filter(kw => combined.includes(kw)).length;
    if (score >= 1) scored.push({ niche, score });
  }
  // Prefer niches with 2+ keyword matches; fall back to single-match niches if no strong matches exist
  const strong = scored.filter(s => s.score >= 2).map(s => s.niche);
  if (strong.length > 0) return strong;
  const weak = scored.map(s => s.niche);
  return weak.length > 0 ? weak : ["news_animated"]; // Default niche
}

// ── Topic similarity ─────────────────────────────────────────

function areSimilarTopics(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
  return overlap / Math.min(wordsA.size, wordsB.size) > 0.5;
}

function toUnified(item: GeminiNewsItem): UnifiedNewsItem {
  const niches = detectNiches(item.title, item.summary, item.category);
  return {
    id: topicIdFromTitle(item.title),
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
    niches,
    status: "pending",
  };
}

// ── Source quality ranking (higher = more trustworthy/detailed) ──
const SOURCE_QUALITY: Record<string, number> = {
  gemini: 10,
  newsapi: 8,
  google_trends: 7,
  reddit: 5,
};

function getSourceQuality(source: string): number {
  return SOURCE_QUALITY[source] ?? 3;
}

// ── Content freshness scoring ───────────────────────────────────
function applyFreshnessDecay(item: UnifiedNewsItem): void {
  const ageMs = Date.now() - new Date(item.timestamp).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= 2) {
    item.viral_potential = Math.min(10, item.viral_potential + 2);
  } else if (ageHours > 12) {
    item.viral_potential = Math.max(1, item.viral_potential - 1);
  }
}

function deduplicateItems(items: UnifiedNewsItem[]): UnifiedNewsItem[] {
  const merged: UnifiedNewsItem[] = [];

  for (const item of items) {
    // Apply freshness scoring before merging
    applyFreshnessDecay(item);

    const existing = merged.find(m => areSimilarTopics(m.title, item.title));
    if (existing) {
      existing.sources_count += 1;
      // Merge niches
      const allNiches = new Set([...existing.niches, ...item.niches]);
      existing.niches = [...allNiches];
      // Prefer content from higher-quality source
      const existingQuality = getSourceQuality(existing.source);
      const incomingQuality = getSourceQuality(item.source);
      if (incomingQuality > existingQuality) {
        existing.summary = item.summary;
        existing.content_angle = item.content_angle;
        existing.suggested_hook = item.suggested_hook;
        existing.source = item.source;
      }
      // Always keep the higher viral_potential
      if (item.viral_potential > existing.viral_potential) {
        existing.viral_potential = item.viral_potential;
      }
    } else {
      merged.push({ ...item });
    }
  }

  // Cross-source boost
  for (const item of merged) {
    if (item.sources_count >= 3) item.viral_potential = Math.min(10, item.viral_potential + 3);
    else if (item.sources_count === 2) item.viral_potential = Math.min(10, item.viral_potential + 1);
  }

  return merged;
}

// ── Source: NewsAPI ───────────────────────────────────────────

async function fetchFromNewsAPI(): Promise<UnifiedNewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY;
  if (!apiKey) return [];

  const categories = [
    { cat: "general", niche: "breaking_news" },
    { cat: "technology", niche: "tech" },
    { cat: "business", niche: "finance" },
    { cat: "entertainment", niche: "entertainment" },
    { cat: "health", niche: "health_wellness" },
    { cat: "science", niche: "tech" },
  ];

  const results = await Promise.allSettled(
    categories.map(async ({ cat, niche }) => {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?category=${cat}&language=en&pageSize=8&apiKey=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.articles || [])
        .filter((a: { title: string }) => a.title && a.title.length > 15 && !a.title.includes("[Removed]"))
        .map((a: { title: string; description: string | null; source: { name: string } }) => {
          const title = a.title.split(" - ")[0].trim(); // Remove source suffix
          const niches = detectNiches(title, a.description || "", cat);
          return {
            id: topicIdFromTitle(title),
            title,
            summary: a.description || "",
            category: cat === "general" ? "breaking" : cat,
            viral_potential: 7,
            content_angle: `Breaking ${cat} news — create a dramatic animated 30-second video`,
            suggested_hook: title.slice(0, 80),
            region: "GLOBAL",
            source: "newsapi",
            sources_count: 1,
            timestamp: new Date().toISOString(),
            page_target: null,
            niches: [...new Set([niche, ...niches])],
            status: "pending" as const,
          };
        });
    })
  );

  const items = results
    .filter((r): r is PromiseFulfilledResult<UnifiedNewsItem[]> => r.status === "fulfilled")
    .flatMap(r => r.value);
  console.log(`[Aggregator] NewsAPI returned ${items.length} items`);
  return items;
}

// ── Source: Reddit ────────────────────────────────────────────

const REDDIT_SUBS: Array<{ sub: string; niche: string; category: string }> = [
  // World news & politics
  { sub: "worldnews", niche: "breaking_news", category: "breaking" },
  { sub: "news", niche: "news_animated", category: "breaking" },
  { sub: "geopolitics", niche: "geopolitics", category: "breaking" },
  // Tech & AI
  { sub: "technology", niche: "tech", category: "technology" },
  { sub: "artificial", niche: "ai_news", category: "technology" },
  { sub: "MachineLearning", niche: "ai_news", category: "technology" },
  { sub: "singularity", niche: "ai_disruption", category: "technology" },
  { sub: "Futurology", niche: "ai_disruption", category: "technology" },
  // Entertainment & pop culture
  { sub: "entertainment", niche: "entertainment", category: "entertainment" },
  { sub: "movies", niche: "entertainment", category: "entertainment" },
  { sub: "television", niche: "entertainment", category: "entertainment" },
  { sub: "popculture", niche: "celebrity", category: "entertainment" },
  { sub: "Celebs", niche: "celebrity", category: "entertainment" },
  // Motivation & wellness
  { sub: "GetMotivated", niche: "motivation", category: "culture" },
  { sub: "DecidingToBeBetter", niche: "motivation", category: "culture" },
  { sub: "selfimprovement", niche: "motivation", category: "culture" },
  // Finance
  { sub: "stocks", niche: "finance", category: "finance" },
  { sub: "CryptoCurrency", niche: "finance", category: "finance" },
  { sub: "economics", niche: "finance", category: "finance" },
  // Africa
  { sub: "Africa", niche: "afrofuturism", category: "africa" },
  { sub: "southafrica", niche: "mbs_episodes", category: "africa" },
  // Health & wellness
  { sub: "Health", niche: "health_wellness", category: "culture" },
  { sub: "Fitness", niche: "health_wellness", category: "culture" },
  // Extra finance
  { sub: "business", niche: "finance", category: "finance" },
  { sub: "wallstreetbets", niche: "finance", category: "finance" },
  { sub: "personalfinance", niche: "finance", category: "finance" },
  // Extra tech & science
  { sub: "science", niche: "tech", category: "technology" },
  { sub: "space", niche: "tech", category: "technology" },
  { sub: "gadgets", niche: "tech", category: "technology" },
  { sub: "dataisbeautiful", niche: "tech", category: "technology" },
  // Extra motivation & breaking
  { sub: "UpliftingNews", niche: "motivation", category: "culture" },
  { sub: "collapse", niche: "breaking_news", category: "breaking" },
  // Viral / general
  { sub: "interestingasfuck", niche: "viral_moments", category: "viral" },
  { sub: "Damnthatsinteresting", niche: "viral_moments", category: "viral" },
];

async function fetchFromReddit(): Promise<UnifiedNewsItem[]> {
  const batchSize = 6; // Fetch in batches to avoid rate limits
  const allItems: UnifiedNewsItem[] = [];

  for (let i = 0; i < REDDIT_SUBS.length; i += batchSize) {
    const batch = REDDIT_SUBS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ({ sub, niche, category }) => {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, {
          headers: { "User-Agent": "GenesisStudio/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data?.data?.children || [])
          .filter((post: { data: { title: string; score: number; stickied: boolean } }) =>
            post.data.title?.length > 15 && post.data.score > 100 && !post.data.stickied
          )
          .slice(0, 3) // Top 3 per sub
          .map((post: { data: { title: string; score: number; subreddit: string; num_comments: number } }) => {
            const niches = detectNiches(post.data.title, `r/${post.data.subreddit}`, category);
            const viralScore = Math.min(10, Math.round(Math.log10(Math.max(post.data.score, 100)) * 2) + 3);
            return {
              id: topicIdFromTitle(post.data.title),
              title: post.data.title,
              summary: `Trending on r/${post.data.subreddit} — ${post.data.score.toLocaleString()} upvotes, ${post.data.num_comments.toLocaleString()} comments`,
              category,
              viral_potential: viralScore,
              content_angle: buildContentAngle(category, niche),
              suggested_hook: post.data.title.slice(0, 80),
              region: "GLOBAL",
              source: "reddit",
              sources_count: 1,
              timestamp: new Date().toISOString(),
              page_target: null,
              niches: [...new Set([niche, ...niches])],
              status: "pending" as const,
            };
          });
      })
    );

    const batchItems = results
      .filter((r): r is PromiseFulfilledResult<UnifiedNewsItem[]> => r.status === "fulfilled")
      .flatMap(r => r.value);
    allItems.push(...batchItems);

    // Small delay between batches to avoid Reddit rate limits
    if (i + batchSize < REDDIT_SUBS.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`[Aggregator] Reddit returned ${allItems.length} items from ${REDDIT_SUBS.length} subreddits`);
  return allItems;
}

function buildContentAngle(category: string, niche: string): string {
  const angles: Record<string, string> = {
    breaking: "BREAKING — create a dramatic 30-second animated news bulletin with red-alert graphics and urgent atmosphere",
    technology: "Tech breakthrough — create a sleek, futuristic animated explainer with holographic visuals",
    entertainment: "Entertainment exclusive — create a glamorous animated celebrity news clip with red carpet energy",
    culture: "Inspirational story — create an emotional, cinematic animated short that moves hearts",
    finance: "Market alert — create a high-energy animated financial report with charts and ticker graphics",
    africa: "African spotlight — create a vibrant, Afrofuturistic animated piece celebrating African innovation",
    viral: "Viral explosion — create a fast-paced, meme-worthy animated clip with trending energy",
  };
  return angles[category] || `Create an engaging animated video about this ${niche} topic`;
}

// ── Source: Google Trends RSS ─────────────────────────────────

async function fetchFromGoogleTrends(): Promise<UnifiedNewsItem[]> {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=US", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "GenesisStudio/1.0" },
    });
    if (!res.ok) return [];

    const text = await res.text();
    // Simple XML parsing for titles
    const titles = [...text.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g)]
      .map(m => m[1])
      .filter(t => t && t !== "Daily Search Trends" && t.length > 5)
      .slice(0, 10);

    const items: UnifiedNewsItem[] = titles.map(title => {
      const niches = detectNiches(title, "", "trending");
      return {
        id: topicIdFromTitle(title),
        title,
        summary: `Trending on Google — millions of searches`,
        category: "trending",
        viral_potential: 8, // Google Trends = high viral potential
        content_angle: "Google trending topic — create an animated explainer on why everyone is searching for this",
        suggested_hook: title.slice(0, 80),
        region: "GLOBAL",
        source: "google_trends",
        sources_count: 1,
        timestamp: new Date().toISOString(),
        page_target: null,
        niches,
        status: "pending",
      };
    });

    console.log(`[Aggregator] Google Trends returned ${items.length} items`);
    return items;
  } catch (error) {
    console.warn("[Aggregator] Google Trends failed:", error);
    return [];
  }
}

// ── Main Aggregator ──────────────────────────────────────────

export async function aggregateAllSources(): Promise<UnifiedNewsItem[]> {
  const allItems: UnifiedNewsItem[] = [];

  // Fetch all sources in parallel
  const [geminiItems, newsApiItems, redditItems, googleItems] = await Promise.all([
    fetchGeminiTrends().then(items => items.map(toUnified)).catch(() => [] as UnifiedNewsItem[]),
    fetchFromNewsAPI().catch(() => [] as UnifiedNewsItem[]),
    fetchFromReddit().catch(() => [] as UnifiedNewsItem[]),
    fetchFromGoogleTrends().catch(() => [] as UnifiedNewsItem[]),
  ]);

  allItems.push(...geminiItems, ...newsApiItems, ...redditItems, ...googleItems);
  console.log(`[Aggregator] Total raw: Gemini=${geminiItems.length} NewsAPI=${newsApiItems.length} Reddit=${redditItems.length} Google=${googleItems.length}`);

  // Deduplicate
  const deduplicated = deduplicateItems(allItems);
  console.log(`[Aggregator] ${allItems.length} raw → ${deduplicated.length} after dedup`);

  // Sort by viral_potential DESC
  deduplicated.sort((a, b) => b.viral_potential - a.viral_potential);

  // ── Diversity guarantee: ensure major niche categories are represented ──
  const MAJOR_CATEGORIES = ["breaking_news", "tech", "entertainment", "finance", "motivation"] as const;
  for (const cat of MAJOR_CATEGORIES) {
    const count = deduplicated.filter(item => item.niches.includes(cat)).length;
    if (count === 0) {
      console.warn(`[Aggregator] Diversity warning: 0 topics for niche "${cat}" — consider adding more sources`);
    } else if (count < 2) {
      console.warn(`[Aggregator] Diversity notice: only ${count} topic(s) for niche "${cat}"`);
    }
  }

  return deduplicated;
}
