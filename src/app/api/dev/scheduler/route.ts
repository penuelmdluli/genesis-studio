// POST /api/dev/scheduler -- Automated dev content pipeline
// Query params: ?action=fetch_trends|generate|produce|poll|post|full
// Auth: CRON_SECRET
//
// Pipeline: fetch_trends -> generate -> produce -> poll -> post
//
// Actions:
// - fetch_trends : Aggregate trending topics from all news sources
// - generate     : Smart niche-scored topic assignment across dev pages (no duplicates)
// - produce      : Trigger Brain Studio video production for pending queue items
// - poll         : Poll assembly progress for in-progress productions
// - post         : Post completed videos to Facebook Reels + YouTube Shorts
// - full         : Run all steps in sequence (fetch -> generate -> produce -> post)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { aggregateAllSources, UnifiedNewsItem } from "@/lib/news/aggregator";
import { getAllDevPages, DevPageConfig } from "@/lib/dev-pages";
import { selectEngine, createCostEntry } from "@/lib/dev-engine-router";
import { after } from "next/server";

export const maxDuration = 300;

const DEV_USER_ID = "c1fccbb2-86e9-4d34-ae43-4a7cf4fd4a26";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3099"
  );
}

function getCronSecret(): string {
  return process.env.CRON_SECRET || "";
}

/**
 * Score a topic's relevance to a page using niche overlap.
 * Topics MUST have at least one matching niche to score > 0.
 * Score = nicheOverlap * 3 + viralPotential
 * Optional niche_weights on the page further boost specific niches.
 */
function scoreTopicForPage(
  topic: { niches?: string[] | null; viral_potential: number },
  page: DevPageConfig,
): number {
  const topicNiches = topic.niches || [];
  const nicheWeights = page.niche_weights || {};

  let nicheOverlap = 0;
  let weightBonus = 0;

  for (const pillar of page.content_pillars) {
    if (topicNiches.includes(pillar)) {
      nicheOverlap++;
      weightBonus += nicheWeights[pillar] || 0;
    }
  }

  // Must have at least 1 niche match
  if (nicheOverlap === 0) return 0;

  return nicheOverlap * 3 + (topic.viral_potential || 5) + weightBonus;
}

/**
 * Build a video generation prompt from a trending topic + page config.
 */
function buildVideoPrompt(
  topic: UnifiedNewsItem,
  page: DevPageConfig,
  pillar: string,
): string {
  const basePrompt = `${topic.content_angle}: ${topic.title}. ${topic.suggested_hook}`;

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

// ──────────────────────────────────────────────────────────
// Step 1: FETCH TRENDS
// ──────────────────────────────────────────────────────────

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
    niches: t.niches,
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

// ──────────────────────────────────────────────────────────
// Step 2: GENERATE — Smart niche-scored assignment
// ──────────────────────────────────────────────────────────

async function handleGenerate(): Promise<{
  queued: number;
  entries: Array<{ page: string; topic: string; engine: string; score: number }>;
}> {
  console.log("[DEV SCHEDULER] Generating content with smart niche scoring...");

  const supabase = createSupabaseAdmin();
  const pages = getAllDevPages().filter((p) => p.enabled);

  // 1. Fetch ALL pending topics ordered by viral_potential
  const { data: topics, error: topicsErr } = await supabase
    .from("dev_trending_topics")
    .select("*")
    .eq("status", "pending")
    .order("viral_potential", { ascending: false })
    .limit(100);

  if (topicsErr) {
    throw new Error(`Failed to fetch trending topics: ${topicsErr.message}`);
  }

  if (!topics || topics.length === 0) {
    console.log("[DEV SCHEDULER] No pending trending topics found. Run fetch_trends first.");
    return { queued: 0, entries: [] };
  }

  console.log(`[DEV SCHEDULER] ${topics.length} pending topics, ${pages.length} active pages`);

  // 2. Greedy niche-scored assignment (no cross-page duplicates)
  const assignedTopicIds = new Set<string>();
  const assignments: Array<{
    page: DevPageConfig;
    topic: (typeof topics)[0];
    pillar: string;
    score: number;
  }> = [];

  for (const page of pages) {
    const topicsPerCycle = page.topics_per_cycle || 2;

    // Score all available (unassigned) topics for this page
    const scored = topics
      .filter((t) => !assignedTopicIds.has(t.id))
      .map((t) => {
        const score = scoreTopicForPage(
          { niches: t.niches, viral_potential: t.viral_potential },
          page,
        );
        // Determine which pillar matched best
        const topicNiches: string[] = t.niches || [];
        const matchedPillar =
          page.content_pillars.find((p) => topicNiches.includes(p)) ||
          page.content_pillars[0];
        return { topic: t, score, pillar: matchedPillar };
      })
      .filter((s) => s.score > 0) // Must have niche overlap
      .sort((a, b) => b.score - a.score);

    // Pick top N
    const picks = scored.slice(0, topicsPerCycle);

    if (picks.length === 0) {
      console.log(`[DEV SCHEDULER] No niche-matching topics for page "${page.name}"`);
      continue;
    }

    for (const pick of picks) {
      assignedTopicIds.add(pick.topic.id);
      assignments.push({
        page,
        topic: pick.topic,
        pillar: pick.pillar,
        score: pick.score,
      });
    }

    console.log(
      `[DEV SCHEDULER] Page "${page.name}": assigned ${picks.length} topic(s) (best score: ${picks[0].score})`,
    );
  }

  if (assignments.length === 0) {
    console.log("[DEV SCHEDULER] No topic-page assignments could be made (no niche overlaps)");
    return { queued: 0, entries: [] };
  }

  // 3. Insert into queue and mark topics
  const entries: Array<{ page: string; topic: string; engine: string; score: number }> = [];

  for (const { page, topic, pillar, score } of assignments) {
    const engine = selectEngine(pillar);
    const costEntry = createCostEntry(engine, pillar, page.id);

    const videoPrompt = buildVideoPrompt(
      topic as unknown as UnifiedNewsItem,
      page,
      pillar,
    );

    // Insert queue entry
    const { error: queueErr } = await supabase.from("dev_content_queue").insert({
      page_id: page.id,
      pillar,
      engine: engine.modelId,
      news_topic_id: topic.id,
      input_data: {
        page_name: page.name,
        topic_title: topic.title,
        video_prompt: videoPrompt,
        provider: engine.provider,
        reason: engine.reason,
        niche_score: score,
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
      .eq("id", topic.id);

    // Log cost entry (non-critical)
    const { error: costErr } = await supabase.from("dev_generation_costs").insert({
      engine: costEntry.engine,
      pillar: costEntry.pillar,
      page_id: costEntry.page_id,
      estimated_cost_usd: costEntry.estimated_cost_usd,
    });
    if (costErr) {
      console.warn(`[DEV SCHEDULER] Cost log failed for ${page.name}: ${costErr.message}`);
    }

    entries.push({
      page: page.name,
      topic: topic.title as string,
      engine: engine.modelId,
      score,
    });

    console.log(
      `[DEV SCHEDULER] Queued: ${page.name} | "${(topic.title as string).slice(0, 60)}" | ${engine.modelId} ($${engine.estimatedCostUsd}) | score=${score}`,
    );
  }

  console.log(`[DEV SCHEDULER] Generate complete: ${entries.length} items queued across ${pages.length} pages`);
  return { queued: entries.length, entries };
}

// ──────────────────────────────────────────────────────────
// Step 3: PRODUCE — Trigger Brain Studio production
// ──────────────────────────────────────────────────────────

async function handleProduce(): Promise<{
  triggered: number;
  results: Array<{ queueId: string; status: string }>;
}> {
  console.log("[DEV SCHEDULER] Triggering Brain Studio production...");

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  const res = await fetch(`${appUrl}/api/dev/produce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "no body");
    console.error(`[DEV SCHEDULER] Produce call failed (${res.status}): ${text}`);
    throw new Error(`Produce endpoint returned ${res.status}`);
  }

  const data = await res.json();
  const triggered = data.produced || 0;
  const results = data.results || [];

  console.log(`[DEV SCHEDULER] Produce triggered ${triggered} production(s)`);
  return { triggered, results };
}

// ──────────────────────────────────────────────────────────
// Step 4: POLL ASSEMBLY — Check in-progress productions
// ──────────────────────────────────────────────────────────

async function handlePollAssembly(): Promise<{
  polled: number;
  results: Array<{ id: string; status: string; phase?: string }>;
}> {
  console.log("[DEV SCHEDULER] Polling assembly progress...");

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  const res = await fetch(`${appUrl}/api/dev/poll-assembly`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "no body");
    console.error(`[DEV SCHEDULER] Poll-assembly call failed (${res.status}): ${text}`);
    throw new Error(`Poll-assembly endpoint returned ${res.status}`);
  }

  const data = await res.json();
  const results: Array<{ id: string; status: string; phase?: string }> = data.results || [];

  console.log(`[DEV SCHEDULER] Polled ${results.length} production(s)`);
  return { polled: results.length, results };
}

// ──────────────────────────────────────────────────────────
// Step 5: POST — Publish completed videos to FB + YT
// ──────────────────────────────────────────────────────────

async function handlePost(): Promise<{
  posted: number;
  results: Array<{
    page: string;
    videoId: string;
    platform: string;
    success: boolean;
    error?: string;
  }>;
}> {
  console.log("[DEV SCHEDULER] Posting completed videos...");

  const supabase = createSupabaseAdmin();
  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  // Find queue items that are "ready" (production completed) and not yet posted
  const { data: readyItems, error } = await supabase
    .from("dev_content_queue")
    .select("*")
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[DEV SCHEDULER] Failed to fetch ready items:", error.message);
    throw new Error(`Failed to fetch ready items: ${error.message}`);
  }

  if (!readyItems || readyItems.length === 0) {
    console.log("[DEV SCHEDULER] No completed videos ready for posting");
    return { posted: 0, results: [] };
  }

  console.log(`[DEV SCHEDULER] Found ${readyItems.length} ready item(s) to post`);

  const pages = getAllDevPages();
  const results: Array<{
    page: string;
    videoId: string;
    platform: string;
    success: boolean;
    error?: string;
  }> = [];

  // Build posting batches
  const fbPosts: Array<{
    videoId: string;
    userId: string;
    pageKey: string;
    caption: string;
    queueId: string;
  }> = [];
  const ytPosts: Array<{
    videoId: string;
    userId: string;
    title: string;
    description: string;
    tags: string[];
    queueId: string;
  }> = [];

  for (const item of readyItems) {
    const page = pages.find((p) => p.id === item.page_id);
    if (!page) {
      console.warn(`[DEV SCHEDULER] No page config found for page_id="${item.page_id}"`);
      continue;
    }

    // Look up the production to get the final video
    const productionId = item.input_data?.production_id;
    if (!productionId) {
      console.warn(`[DEV SCHEDULER] Queue item ${item.id} has no production_id`);
      continue;
    }

    const { data: production } = await supabase
      .from("productions")
      .select("id, output_video_urls, status")
      .eq("id", productionId)
      .single();

    // Parse output_video_urls — could be string or object
    let outputUrls: Record<string, string> = {};
    if (production?.output_video_urls) {
      try {
        outputUrls = typeof production.output_video_urls === "string"
          ? JSON.parse(production.output_video_urls)
          : production.output_video_urls;
      } catch { /* ignore */ }
    }

    const hasFinalVideo = production?.status === "completed" && (outputUrls.final || Object.keys(outputUrls).length > 0);

    if (!production || !hasFinalVideo) {
      console.log(
        `[DEV SCHEDULER] Production ${productionId} not ready (status=${production?.status})`,
      );
      continue;
    }

    // The final video is served via /api/videos/{videoId} which reads from R2
    const videoId = outputUrls.final?.replace("/api/videos/", "") || production.id;
    const topicTitle = item.input_data?.topic_title || "Trending Now";

    // Build caption with page hashtags
    const hashtagStr = (page.hashtags || []).join(" ");
    const caption = `${topicTitle}\n\n${hashtagStr}\n\n#Trending #Viral #MadeWithAI`;

    // Queue Facebook post
    if (page.facebook_page_key) {
      fbPosts.push({
        videoId,
        userId: DEV_USER_ID,
        pageKey: page.facebook_page_key,
        caption,
        queueId: item.id,
      });
    }

    // Queue YouTube post
    if (page.youtube_enabled !== false) {
      ytPosts.push({
        videoId,
        userId: DEV_USER_ID,
        title: topicTitle.slice(0, 90),
        description: `${caption}\n\n#Shorts`,
        tags: page.hashtags?.map((h: string) => h.replace("#", "")) || [],
        queueId: item.id,
      });
    }

    // Mark as posting (in progress)
    await supabase
      .from("dev_content_queue")
      .update({ status: "posting" })
      .eq("id", item.id);
  }

  // ---- Post to Facebook ----
  if (fbPosts.length > 0) {
    console.log(`[DEV SCHEDULER] Posting ${fbPosts.length} video(s) to Facebook...`);
    try {
      const fbRes = await fetch(`${appUrl}/api/dev/post-to-facebook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ posts: fbPosts }),
      });

      if (!fbRes.ok) {
        const text = await fbRes.text().catch(() => "");
        console.error(`[DEV SCHEDULER] Facebook post endpoint returned ${fbRes.status}: ${text}`);
      } else {
        const fbData = await fbRes.json();
        for (const r of fbData.results || []) {
          results.push({
            page: r.pageName || r.pageKey,
            videoId: r.videoId,
            platform: "facebook",
            success: r.success,
            error: r.error,
          });
        }
      }
    } catch (e) {
      console.error("[DEV SCHEDULER] Facebook posting failed:", e);
    }
  }

  // ---- Post to YouTube ----
  if (ytPosts.length > 0) {
    console.log(`[DEV SCHEDULER] Posting ${ytPosts.length} video(s) to YouTube Shorts...`);
    try {
      const ytRes = await fetch(`${appUrl}/api/dev/post-to-youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ posts: ytPosts }),
      });

      if (!ytRes.ok) {
        const text = await ytRes.text().catch(() => "");
        console.error(`[DEV SCHEDULER] YouTube post endpoint returned ${ytRes.status}: ${text}`);
      } else {
        const ytData = await ytRes.json();
        for (const r of ytData.results || []) {
          results.push({
            page: "YouTube",
            videoId: r.videoId,
            platform: "youtube",
            success: r.success,
            error: r.error,
          });
        }
      }
    } catch (e) {
      console.error("[DEV SCHEDULER] YouTube posting failed:", e);
    }
  }

  // ---- Update queue status based on results ----
  for (const item of readyItems) {
    const page = pages.find((p) => p.id === item.page_id);
    const pageName = page?.name || "";
    const fbSuccess = results.some(
      (r) => r.success && r.platform === "facebook" && r.page === (page?.facebook_page_key || pageName),
    );
    const ytSuccess = results.some(
      (r) => r.success && r.platform === "youtube",
    );

    if (fbSuccess || ytSuccess) {
      await supabase
        .from("dev_content_queue")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Also mark the trending topic as posted
      if (item.news_topic_id) {
        await supabase
          .from("dev_trending_topics")
          .update({ status: "posted" })
          .eq("id", item.news_topic_id);
      }

      console.log(`[DEV SCHEDULER] Marked queue item ${item.id} as posted`);
    } else {
      // Revert to ready so it can be retried next cycle
      await supabase
        .from("dev_content_queue")
        .update({ status: "ready" })
        .eq("id", item.id);

      console.warn(`[DEV SCHEDULER] Posting failed for queue item ${item.id}, reverted to ready`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[DEV SCHEDULER] Post complete: ${successCount}/${results.length} successful`);
  return { posted: successCount, results };
}

// ──────────────────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!validateCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "full";

    console.log(`[DEV SCHEDULER] ========== Action: ${action} ==========`);

    switch (action) {
      // ---- Fetch Trends ----
      case "fetch_trends": {
        const result = await handleFetchTrends();
        return NextResponse.json({
          action: "fetch_trends",
          success: true,
          ...result,
        });
      }

      // ---- Generate (smart niche-scored assignment) ----
      case "generate": {
        const result = await handleGenerate();
        return NextResponse.json({
          action: "generate",
          success: true,
          ...result,
        });
      }

      // ---- Produce (trigger Brain Studio) ----
      case "produce": {
        const result = await handleProduce();
        return NextResponse.json({
          action: "produce",
          success: true,
          ...result,
        });
      }

      // ---- Poll Assembly ----
      case "poll": {
        const result = await handlePollAssembly();
        return NextResponse.json({
          action: "poll",
          success: true,
          ...result,
        });
      }

      // ---- Post to Facebook + YouTube ----
      case "post": {
        const result = await handlePost();
        return NextResponse.json({
          action: "post",
          success: true,
          ...result,
        });
      }

      // ---- Full Pipeline ----
      case "full": {
        console.log("[DEV SCHEDULER] Running FULL automated pipeline...");
        const stepResults: Record<string, unknown> = {};

        // Step 1: Fetch trends
        const trends = await handleFetchTrends();
        stepResults.fetch_trends = { count: trends.count };
        console.log(`[DEV SCHEDULER] Full pipeline [1/5]: ${trends.count} trends fetched`);

        // Step 2: Smart content rotation
        const generated = await handleGenerate();
        stepResults.generate = { queued: generated.queued, entries: generated.entries };
        console.log(`[DEV SCHEDULER] Full pipeline [2/5]: ${generated.queued} items queued`);

        // Step 3: Trigger Brain Studio production
        const produced = await handleProduce();
        stepResults.produce = produced;
        console.log(`[DEV SCHEDULER] Full pipeline [3/5]: ${produced.triggered} production(s) triggered`);

        // Step 4: Poll assembly for any in-progress work from previous cycles
        const polled = await handlePollAssembly();
        stepResults.poll = polled;
        console.log(`[DEV SCHEDULER] Full pipeline [4/5]: ${polled.polled} production(s) polled`);

        // Step 5: Post any ready videos from previous cycles
        const posted = await handlePost();
        stepResults.post = posted;
        console.log(`[DEV SCHEDULER] Full pipeline [5/5]: ${posted.posted} video(s) posted`);

        console.log("[DEV SCHEDULER] Full pipeline complete.");

        return NextResponse.json({
          action: "full",
          success: true,
          pipeline: "fetch -> generate -> produce -> poll -> post",
          steps: stepResults,
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Invalid action: ${action}. Use: fetch_trends, generate, produce, poll, post, or full`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[DEV SCHEDULER] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal error",
        action: new URL(req.url).searchParams.get("action") || "full",
      },
      { status: 500 },
    );
  }
}
