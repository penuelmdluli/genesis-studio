import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { createStudioTrend } from "@/lib/studio/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoredHeadline {
  topic: string;
  headline: string;
  score: number;
  source: string;
}

interface NewsAPIArticle {
  title: string;
  description: string | null;
  source: { name: string };
  url: string;
}

interface RedditPost {
  data: {
    title: string;
    score: number;
    permalink: string;
    subreddit: string;
  };
}

// ---------------------------------------------------------------------------
// Auth: owner OR cron secret
// ---------------------------------------------------------------------------

async function checkAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  // Check for cron secret first
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null; // Authorized via cron secret
  }

  // Fall back to owner auth
  const authResult = await requireStudioOwner();
  if (authResult instanceof NextResponse) return authResult;

  return null; // Authorized via owner
}

// ---------------------------------------------------------------------------
// Keyword scoring
// ---------------------------------------------------------------------------

const NICHE_KEYWORDS: Record<string, string[]> = {
  news: [
    "breaking",
    "exclusive",
    "urgent",
    "crisis",
    "major",
    "shocking",
    "update",
    "alert",
    "developing",
    "confirmed",
  ],
  finance: [
    "market",
    "stocks",
    "crypto",
    "bitcoin",
    "economy",
    "inflation",
    "fed",
    "recession",
    "earnings",
    "rally",
    "crash",
    "surge",
  ],
  motivation: [
    "success",
    "mindset",
    "discipline",
    "goals",
    "hustle",
    "growth",
    "overcome",
    "powerful",
    "inspiring",
    "transform",
  ],
  entertainment: [
    "viral",
    "trending",
    "celebrity",
    "drama",
    "shocking",
    "exclusive",
    "reveal",
    "comeback",
    "epic",
    "iconic",
  ],
};

function scoreHeadline(headline: string, niche: string): number {
  const lower = headline.toLowerCase();
  const keywords = NICHE_KEYWORDS[niche] || [];
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += 10;
    }
  }

  // Bonus for headline length (prefer medium-length, engaging headlines)
  if (headline.length > 30 && headline.length < 120) {
    score += 5;
  }

  // Bonus for question marks or exclamation (engagement signals)
  if (headline.includes("?") || headline.includes("!")) {
    score += 3;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchNewsAPI(
  category: string,
  niche: string
): Promise<ScoredHeadline[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.warn("[Studio] NEWSAPI_KEY not set, skipping NewsAPI fetch");
    return [];
  }

  try {
    const url =
      `https://newsapi.org/v2/top-headlines?` +
      `country=us&category=${category}&pageSize=10&apiKey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (data.status !== "ok" || !data.articles) {
      console.error("[Studio] NewsAPI error:", data);
      return [];
    }

    return data.articles
      .filter((a: NewsAPIArticle) => a.title && a.title !== "[Removed]")
      .map((a: NewsAPIArticle) => ({
        topic: a.title.split(" - ")[0] || a.title,
        headline: a.title,
        score: scoreHeadline(a.title, niche),
        source: `newsapi:${a.source?.name || "unknown"}`,
      }));
  } catch (error) {
    console.error(`[Studio] NewsAPI fetch error (${category}):`, error);
    return [];
  }
}

async function fetchRedditMotivation(): Promise<ScoredHeadline[]> {
  try {
    const url =
      "https://www.reddit.com/r/GetMotivated/hot.json?limit=10";

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "GenesiStudio/1.0",
      },
    });

    const data = await res.json();

    if (!data?.data?.children) {
      console.error("[Studio] Reddit fetch error: unexpected response");
      return [];
    }

    return data.data.children
      .filter(
        (child: RedditPost) =>
          child.data.title && !child.data.title.startsWith("[")
      )
      .map((child: RedditPost) => ({
        topic: child.data.title.substring(0, 100),
        headline: child.data.title,
        score:
          scoreHeadline(child.data.title, "motivation") +
          Math.min(Math.floor(child.data.score / 100), 20),
        source: `reddit:r/${child.data.subreddit}`,
      }));
  } catch (error) {
    console.error("[Studio] Reddit fetch error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authError = await checkAuth(request);
    if (authError) return authError;

    const today = new Date().toISOString().split("T")[0];

    const nicheConfigs: {
      niche: string;
      fetcher: () => Promise<ScoredHeadline[]>;
    }[] = [
      { niche: "news", fetcher: () => fetchNewsAPI("general", "news") },
      {
        niche: "finance",
        fetcher: () => fetchNewsAPI("business", "finance"),
      },
      { niche: "motivation", fetcher: fetchRedditMotivation },
      {
        niche: "entertainment",
        fetcher: () => fetchNewsAPI("entertainment", "entertainment"),
      },
    ];

    const results: Record<string, ScoredHeadline> = {};

    for (const config of nicheConfigs) {
      const headlines = await config.fetcher();

      if (headlines.length === 0) {
        console.warn(`[Studio] No headlines found for niche: ${config.niche}`);
        continue;
      }

      // Sort by score descending and pick top 1
      headlines.sort((a, b) => b.score - a.score);
      const top = headlines[0];

      // Insert into database
      await createStudioTrend({
        date: today,
        niche: config.niche,
        topic: top.topic,
        headline: top.headline,
        score: top.score,
        source: top.source,
      });

      results[config.niche] = top;
    }

    return NextResponse.json({
      date: today,
      trends: results,
      count: Object.keys(results).length,
    });
  } catch (error) {
    console.error("[Studio] Trend fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
