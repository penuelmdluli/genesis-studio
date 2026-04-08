// POST /api/dev/scheduler -- Trigger dev content pipeline
// Query params: ?action=fetch_trends|generate|post|full
// Auth: CRON_SECRET
//
// Actions:
// - fetch_trends: Fetch from all news sources, save to dev_trending_topics
// - generate: Pick top trending topic per page, create video prompt, add to queue
// - post: (future) Post ready videos to dev Facebook pages
// - full: Run all steps in sequence

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { aggregateAllSources, UnifiedNewsItem } from "@/lib/news/aggregator";
import { getAllDevPages, DevPageConfig } from "@/lib/dev-pages";
import { selectEngine, createCostEntry } from "@/lib/dev-engine-router";

export const maxDuration = 120;

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

// ---------- FETCH TRENDS ----------

async function handleFetchTrends(): Promise<{
  count: number;
  topics: UnifiedNewsItem[];
}> {
  console.log("[DEV SCHEDULER] Fetching trends from all sources...");

  const topics = await aggregateAllSources();
  console.log(`[DEV SCHEDULER] Aggregated ${topics.length} trending topics`);

  if (topics.length === 0) {
    return { count: 0, topics: [] };
  }

  // Save to dev_trending_topics table
  const supabase = createSupabaseAdmin();

  const rows = topics.map((t) => ({
    id: t.id,
    title: t.title,
    summary: t.summary,
    category: t.category,
    viral_potential: t.viral_potential,
    content_angle: t.content_angle,
    suggested_hook: t.suggested_hook,
    region: t.region,
    source: t.source,
    sources_count: t.sources_count,
    page_target: t.page_target,
    status: "pending",
  }));

  const { error } = await supabase.from("dev_trending_topics").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    console.error("[DEV SCHEDULER] Failed to save trending topics:", error.message);
    throw new Error(`Failed to save trends: ${error.message}`);
  }

  console.log(`[DEV SCHEDULER] Saved ${rows.length} trending topics to dev_trending_topics`);
  return { count: rows.length, topics };
}

// ---------- GENERATE ----------

/**
 * Match a trending topic to a page's content pillars.
 * Simple keyword/category matching.
 */
function topicMatchesPillar(topic: UnifiedNewsItem, pillar: string): boolean {
  const category = topic.category.toLowerCase();
  const title = topic.title.toLowerCase();
  const summary = topic.summary.toLowerCase();

  const pillarKeywords: Record<string, string[]> = {
    mbs_episodes: ["baby", "child", "kids", "family", "parenting"],
    baby_scenarios: ["baby", "child", "kids", "cute", "funny"],
    afrofuturism: ["future", "technology", "innovation", "space", "ai", "robot", "city"],
    african_cities: ["city", "urban", "infrastructure", "development", "smart", "africa"],
    news_animated: ["news", "breaking", "politics", "economy", "world", "war", "iran", "trump", "ukraine", "military", "strikes"],
    breaking_news: ["breaking", "war", "military", "attack", "crisis", "iran", "israel", "ukraine", "trump", "threat", "strait", "retaliation"],
    geopolitics: ["war", "iran", "israel", "ukraine", "russia", "china", "sanctions", "military", "ceasefire", "strait", "hormuz", "nato"],
    african_folklore: ["folklore", "legend", "myth", "story", "tradition", "culture"],
    genesis_demo: ["ai", "video", "generation", "genesis", "demo", "technology"],
    ai_news: ["ai", "artificial intelligence", "machine learning", "chatgpt", "openai", "claude", "amd", "layoff", "jobs"],
    tech: ["tech", "software", "startup", "app", "digital", "data center", "linkedin", "browser", "tax"],
    ai_disruption: ["ai", "layoff", "jobs", "replace", "automate", "employees", "workforce", "cut", "industry"],
    entertainment: ["celebrity", "actor", "movie", "show", "kimmel", "clooney", "hollywood", "netflix", "disney"],
    celebrity: ["actor", "celebrity", "star", "kimmel", "clooney", "comedian", "host", "show"],
    viral_moments: ["viral", "trending", "video", "cancelled", "monologue", "maga", "harsh", "condemns"],
  };

  const keywords = pillarKeywords[pillar] || [];
  const combined = `${category} ${title} ${summary}`;
  return keywords.some((kw) => combined.includes(kw));
}

async function handleGenerate(): Promise<{
  queued: number;
  entries: Array<{ page: string; topic: string; engine: string }>;
}> {
  console.log("[DEV SCHEDULER] Generating content for dev pages...");

  const pages = getAllDevPages();
  const supabase = createSupabaseAdmin();

  // Fetch unused trending topics
  const { data: topics, error: topicsErr } = await supabase
    .from("dev_trending_topics")
    .select("*")
    .eq("status", "pending")
    .order("viral_potential", { ascending: false })
    .limit(50);

  if (topicsErr) {
    throw new Error(`Failed to fetch trending topics: ${topicsErr.message}`);
  }

  if (!topics || topics.length === 0) {
    console.log("[DEV SCHEDULER] No pending trending topics found. Run fetch_trends first.");
    return { queued: 0, entries: [] };
  }

  const entries: Array<{ page: string; topic: string; engine: string }> = [];

  for (const page of pages) {
    // Find the top unused topic matching this page's content pillars
    let matchedTopic: (typeof topics)[0] | null = null;
    let matchedPillar = page.content_pillars[0]; // Default to first pillar

    for (const pillar of page.content_pillars) {
      const match = topics.find(
        (t) =>
          t.status === "pending" &&
          topicMatchesPillar(t as unknown as UnifiedNewsItem, pillar)
      );
      if (match) {
        matchedTopic = match;
        matchedPillar = pillar;
        break;
      }
    }

    // If no pillar-specific match, use the highest viral_potential topic
    if (!matchedTopic) {
      matchedTopic = topics.find((t) => t.status === "pending") || null;
    }

    if (!matchedTopic) {
      console.log(`[DEV SCHEDULER] No topics left for page ${page.name}`);
      continue;
    }

    // Select engine
    const engine = selectEngine(matchedPillar);
    const costEntry = createCostEntry(engine, matchedPillar, page.id);

    // Create a video prompt from the topic
    const videoPrompt = buildVideoPrompt(matchedTopic as unknown as UnifiedNewsItem, page, matchedPillar);

    // Add to dev_content_queue
    const { error: queueErr } = await supabase.from("dev_content_queue").insert({
      page_id: page.id,
      pillar: matchedPillar,
      engine: engine.modelId,
      news_topic_id: matchedTopic.id,
      input_data: {
        page_name: page.name,
        topic_title: matchedTopic.title,
        video_prompt: videoPrompt,
        provider: engine.provider,
        reason: engine.reason,
      },
      cost_usd: engine.estimatedCostUsd,
      status: "pending",
    });

    if (queueErr) {
      console.error(`[DEV SCHEDULER] Failed to queue for ${page.name}:`, queueErr.message);
      continue;
    }

    // Mark topic as queued
    await supabase
      .from("dev_trending_topics")
      .update({ status: "queued", page_target: page.id })
      .eq("id", matchedTopic.id);

    // Mark in-memory so it's not reused for next page
    matchedTopic.status = "queued";

    // Log cost entry (non-critical)
    const { error: costErr } = await supabase.from("dev_generation_costs").insert({
      engine: costEntry.engine,
      pillar: costEntry.pillar,
      page_id: costEntry.page_id,
      estimated_cost_usd: costEntry.estimated_cost_usd,
    });
    if (costErr) {
      console.warn(`[DEV SCHEDULER] Cost log insert failed for ${page.name}: ${costErr.message}`);
    }

    entries.push({
      page: page.name,
      topic: matchedTopic.title as string,
      engine: engine.modelId,
    });

    console.log(
      `[DEV SCHEDULER] Queued: ${page.name} | "${(matchedTopic.title as string).slice(0, 50)}" | ${engine.modelId} ($${engine.estimatedCostUsd})`
    );
  }

  console.log(`[DEV SCHEDULER] Generate complete: ${entries.length} items queued`);
  return { queued: entries.length, entries };
}

/**
 * Build a video generation prompt from a trending topic + page config.
 */
function buildVideoPrompt(
  topic: UnifiedNewsItem,
  page: DevPageConfig,
  pillar: string
): string {
  const basePrompt = `${topic.content_angle}: ${topic.title}. ${topic.suggested_hook}`;

  // Add pillar-specific style cues
  const styleCues: Record<string, string> = {
    mbs_episodes:
      "Animated African babies in colorful outfits, playful expressions, vibrant South African setting.",
    baby_scenarios:
      "Cute animated African babies in fun scenarios, bright colors, joyful atmosphere.",
    afrofuturism:
      "Afrofuturistic cityscape, advanced technology, African aesthetic, vibrant neon colors, cinematic.",
    african_cities:
      "Modern African city skyline, futuristic architecture, bustling streets, golden hour lighting.",
    news_animated:
      "Animated news scene, dynamic text overlays, newsroom setting, bold colors, dramatic urgency.",
    breaking_news:
      "Breaking news animation, red alert graphics, globe spinning, dramatic lighting, urgent atmosphere.",
    geopolitics:
      "World map with highlighted regions, military and diplomatic imagery, dramatic documentary style, cinematic tension.",
    african_folklore:
      "African folklore animation, traditional art style, mystical atmosphere, rich earth tones.",
    genesis_demo:
      "AI-generated cinematic footage, sleek technology showcase, professional quality, 4K detail.",
    ai_news:
      "Tech news visualization, AI and robots, digital neural networks, blue and white futuristic color scheme.",
    tech:
      "Technology showcase, sleek devices, data centers, digital innovation, modern tech aesthetic.",
    ai_disruption:
      "Dramatic visualization of AI replacing workers, robots in offices, before/after tech transformation, cinematic.",
    entertainment:
      "Hollywood glamour, red carpet, celebrity lifestyle, vibrant entertainment industry, cinematic close-ups.",
    celebrity:
      "Celebrity portrait style, dramatic lighting, paparazzi flashes, red carpet atmosphere, bold colors.",
    viral_moments:
      "Dynamic social media style, trending graphics, reaction shots, bold text overlays, viral energy.",
  };

  const style = styleCues[pillar] || "Cinematic, high quality, dramatic lighting.";
  return `${basePrompt} Style: ${style}`;
}

// ---------- POST (future) ----------

async function handlePost(): Promise<{ message: string }> {
  console.log("[DEV SCHEDULER] Post action is not yet implemented.");
  return { message: "Post action coming soon -- videos will be posted to dev Facebook pages" };
}

// ---------- MAIN HANDLER ----------

export async function POST(req: NextRequest) {
  try {
    if (!validateCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "full";

    console.log(`[DEV SCHEDULER] Action: ${action}`);

    switch (action) {
      case "fetch_trends": {
        const result = await handleFetchTrends();
        return NextResponse.json({
          action: "fetch_trends",
          success: true,
          ...result,
        });
      }

      case "generate": {
        const result = await handleGenerate();
        return NextResponse.json({
          action: "generate",
          success: true,
          ...result,
        });
      }

      case "post": {
        const result = await handlePost();
        return NextResponse.json({
          action: "post",
          success: true,
          ...result,
        });
      }

      case "full": {
        console.log("[DEV SCHEDULER] Running full pipeline...");

        // Step 1: Fetch trends
        const trends = await handleFetchTrends();
        console.log(`[DEV SCHEDULER] Full pipeline step 1/3: ${trends.count} trends fetched`);

        // Step 2: Generate content queue
        const generated = await handleGenerate();
        console.log(`[DEV SCHEDULER] Full pipeline step 2/3: ${generated.queued} items queued`);

        // Step 3: Post (future)
        const posted = await handlePost();
        console.log(`[DEV SCHEDULER] Full pipeline step 3/3: post step (not yet active)`);

        return NextResponse.json({
          action: "full",
          success: true,
          steps: {
            fetch_trends: { count: trends.count },
            generate: { queued: generated.queued, entries: generated.entries },
            post: posted,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Use: fetch_trends, generate, post, or full` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[DEV SCHEDULER] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal error",
        action: new URL(req.url).searchParams.get("action") || "full",
      },
      { status: 500 }
    );
  }
}
