// POST /api/dev/scheduler -- Automated dev content pipeline
// Query params: ?action=fetch_trends|generate|produce|poll|post|pull_metrics|analyze|reconcile|full
// Auth: CRON_SECRET
//
// Pipeline: reconcile -> pull_metrics -> analyze -> fetch_trends -> generate -> produce -> poll -> post
//
// Actions:
// - reconcile    : Detect + recover stuck productions (no scenes / no progress)
// - fetch_trends : Aggregate trending topics from all news sources
// - generate     : Smart niche-scored topic assignment with adaptive learning weights
// - produce      : Trigger Brain Studio video production for pending queue items
// - poll         : Poll assembly progress for in-progress productions
// - post         : Post completed videos to Facebook Reels + YouTube Shorts
// - pull_metrics : Pull engagement insights from FB + YT for posted videos
// - analyze      : Aggregate engagement and compute adaptive niche weights
// - full         : Run the full learn-and-adapt loop end-to-end

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { aggregateAllSources, UnifiedNewsItem } from "@/lib/news/aggregator";
import { getAllDevPages, DevPageConfig } from "@/lib/dev-pages";
import { selectEngine, createCostEntry } from "@/lib/dev-engine-router";
import {
  computeAdaptiveHints,
  preferredEngineFor,
} from "@/lib/dev-adaptive-hints";

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
 * Score = nicheOverlap * 3 + viralPotential + static + learned + source weights
 * Learned weights come from recent engagement metrics (learn-and-adapt).
 */
function scoreTopicForPage(
  topic: { niches?: string[] | null; viral_potential: number; source?: string | null },
  page: DevPageConfig,
  learnedBoost: Record<string, number> = {},
  sourceBoosts: Record<string, number> = {},
): number {
  const topicNiches = topic.niches || [];
  const nicheWeights = page.niche_weights || {};

  let nicheOverlap = 0;
  let weightBonus = 0;
  let learnedBonus = 0;

  for (const pillar of page.content_pillars) {
    if (topicNiches.includes(pillar)) {
      nicheOverlap++;
      weightBonus += nicheWeights[pillar] || 0;
      learnedBonus += learnedBoost[pillar] || 0;
    }
  }

  // Must have at least 1 niche match
  if (nicheOverlap === 0) return 0;

  const sourceBonus = topic.source ? sourceBoosts[topic.source] || 0 : 0;

  return (
    nicheOverlap * 3 +
    (topic.viral_potential || 5) +
    weightBonus +
    learnedBonus +
    sourceBonus
  );
}

/**
 * Learn-and-adapt: compute per-pillar engagement boosts from the last 30 days
 * of posted content. Pillars with above-average engagement get positive boosts;
 * pillars with below-average engagement get negative boosts. Returns {} until
 * at least one posted item has metrics in input_data.latest_metrics.
 */
async function computeLearnedPillarBoost(): Promise<Record<string, number>> {
  try {
    const supabase = createSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: items } = await supabase
      .from("dev_content_queue")
      .select("pillar, input_data")
      .eq("status", "posted")
      .gte("posted_at", since)
      .limit(500);

    if (!items || items.length === 0) return {};

    const buckets: Record<string, number[]> = {};
    for (const item of items) {
      const input = (item.input_data as Record<string, unknown>) || {};
      const latest = input.latest_metrics as
        | { combined?: { engagement_rate?: number } }
        | undefined;
      const engagement = Number(latest?.combined?.engagement_rate || 0);
      if (!latest?.combined) continue;
      const pillar = (item.pillar as string) || "unknown";
      (buckets[pillar] ||= []).push(engagement);
    }

    const means = Object.entries(buckets)
      .filter(([, v]) => v.length >= 1)
      .map(([k, v]) => ({
        pillar: k,
        mean: v.reduce((a, b) => a + b, 0) / v.length,
      }));

    if (means.length === 0) return {};

    const globalMean =
      means.reduce((a, r) => a + r.mean, 0) / Math.max(means.length, 1);

    const boost: Record<string, number> = {};
    for (const row of means) {
      // Each +0.05 above global mean -> +10 score units
      const delta = Math.round((row.mean - globalMean) * 200);
      if (Math.abs(delta) >= 1) boost[row.pillar] = delta;
    }

    if (Object.keys(boost).length > 0) {
      console.log(
        `[DEV SCHEDULER] Learned pillar boost applied:`,
        JSON.stringify(boost),
      );
    }
    return boost;
  } catch (err) {
    console.warn("[DEV SCHEDULER] computeLearnedPillarBoost failed:", err);
    return {};
  }
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

  // 1a. TITLE-LEVEL DEDUP: Exclude topics whose normalized title matches ANY
  //     queue item from the last 7 days (queued / generating / ready / posted).
  //     This is a belt-and-braces check on top of deterministic topic IDs —
  //     it catches cases where two aggregator runs produce slightly different
  //     strings for the same story (e.g. "BREAKING:" prefix variations).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentQueueRows } = await supabase
    .from("dev_content_queue")
    .select("input_data, created_at")
    .gte("created_at", sevenDaysAgo)
    .in("status", ["pending", "generating", "ready", "posted", "posting"]);

  const normalizeTitle = (t: string): string =>
    t
      .toLowerCase()
      .replace(/^\s*breaking[:\s-]+/i, "")
      .replace(/^\s*breaking[:\s-]+/i, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const recentNormalizedTitles = new Set<string>();
  for (const row of (recentQueueRows || []) as Array<{
    input_data: Record<string, unknown> | null;
  }>) {
    const t = (row.input_data || {}).topic_title as string | undefined;
    if (t) recentNormalizedTitles.add(normalizeTitle(t));
  }

  const topicsBefore = topics.length;
  const filteredTopics = topics.filter((t) => {
    const norm = normalizeTitle(String(t.title || ""));
    if (recentNormalizedTitles.has(norm)) {
      console.log(
        `[DEV SCHEDULER] TITLE DEDUP: skipping "${String(t.title).slice(0, 60)}" — already in queue within 7d`,
      );
      return false;
    }
    return true;
  });
  // Mutate the pending topic set so scoring loops below see only fresh ones
  topics.length = 0;
  topics.push(...filteredTopics);
  if (topicsBefore !== topics.length) {
    console.log(
      `[DEV SCHEDULER] Title-dedup: ${topicsBefore} → ${topics.length} topics (${topicsBefore - topics.length} suppressed)`,
    );
  }

  // 1b. Load adaptive pillar boosts from recent engagement metrics
  const learnedBoost = await computeLearnedPillarBoost();

  // 1c. Load full adaptive hints (engine per pillar, source boosts, etc.)
  const hints = await computeAdaptiveHints();
  if (Object.keys(hints.engineByPillar).length > 0) {
    console.log(
      `[DEV SCHEDULER] Learned engine overrides:`,
      JSON.stringify(hints.engineByPillar),
    );
  }
  if (Object.keys(hints.sourceBoosts).length > 0) {
    console.log(
      `[DEV SCHEDULER] Learned source boosts:`,
      JSON.stringify(hints.sourceBoosts),
    );
  }

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
          {
            niches: t.niches,
            viral_potential: t.viral_potential,
            source: t.source,
          },
          page,
          learnedBoost,
          hints.sourceBoosts,
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
    const learnedEngineOverride = preferredEngineFor(hints, pillar);
    const engine = selectEngine(pillar, undefined, undefined, learnedEngineOverride);
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
        topic_source: topic.source || "unknown",
        topic_category: topic.category || null,
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
  console.log(
    "[DEV SCHEDULER] Triggering Brain Studio productions (round-robin best-per-page)...",
  );

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();
  const supabase = createSupabaseAdmin();

  // Pull every fresh pending item across all pages and rank within each page
  // by niche_score. We then take the BEST item per page so every active page
  // gets one production this cycle (round-robin), prioritised by quality.
  const fortyEightHoursAgo = new Date(
    Date.now() - 48 * 60 * 60 * 1000,
  ).toISOString();

  const { data: freshPending, error: freshErr } = await supabase
    .from("dev_content_queue")
    .select("id, page_id, input_data, created_at")
    .eq("status", "pending")
    .gte("created_at", fortyEightHoursAgo)
    .order("created_at", { ascending: false })
    .limit(200);

  if (freshErr) {
    console.error("[DEV SCHEDULER] Failed to fetch fresh pending items:", freshErr.message);
  }

  // Group by page, rank by niche_score (then newest)
  const bestPerPage = new Map<
    string,
    { id: string; page_id: string; score: number; createdAt: string; title: string }
  >();
  for (const row of (freshPending || []) as Array<{
    id: string;
    page_id: string;
    input_data: Record<string, unknown> | null;
    created_at: string;
  }>) {
    const score = Number((row.input_data || {}).niche_score || 0);
    const title = String((row.input_data || {}).topic_title || "");
    const current = bestPerPage.get(row.page_id);
    if (
      !current ||
      score > current.score ||
      (score === current.score && row.created_at > current.createdAt)
    ) {
      bestPerPage.set(row.page_id, {
        id: row.id,
        page_id: row.page_id,
        score,
        createdAt: row.created_at,
        title,
      });
    }
  }

  // Order pages by best item's score so the strongest get produced first
  const orderedPicks = [...bestPerPage.values()].sort((a, b) => b.score - a.score);

  if (orderedPicks.length === 0) {
    console.log(
      "[DEV SCHEDULER] No fresh pending items in the last 48h — nothing to produce",
    );
    return { triggered: 0, results: [] };
  }

  console.log(
    `[DEV SCHEDULER] Will produce ${orderedPicks.length} item(s), one per page (best-scored each)`,
  );

  let totalTriggered = 0;
  const allResults: Array<{ queueId: string; status: string }> = [];

  for (const pick of orderedPicks) {
    try {
      console.log(
        `[DEV SCHEDULER] Produce → page=${pick.page_id} score=${pick.score} title="${pick.title.slice(0, 50)}"`,
      );

      const res = await fetch(`${appUrl}/api/dev/produce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ queueItemId: pick.id }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "no body");
        console.error(
          `[DEV SCHEDULER] Produce for ${pick.page_id} failed (${res.status}): ${text}`,
        );
        continue;
      }

      const data = await res.json();
      totalTriggered += data.produced || 0;
      if (data.productionId) {
        allResults.push({ queueId: data.productionId, status: "started" });
      }
    } catch (err) {
      console.error(
        `[DEV SCHEDULER] Produce for ${pick.page_id} error:`,
        err,
      );
      continue;
    }
  }

  console.log(
    `[DEV SCHEDULER] Produce triggered ${totalTriggered} production(s) total across ${orderedPicks.length} page(s)`,
  );
  return { triggered: totalTriggered, results: allResults };
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
    postId?: string;
    error?: string;
  }>;
}> {
  console.log("[DEV SCHEDULER] Posting completed videos...");

  const supabase = createSupabaseAdmin();
  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  // ── Safety reset: recover items wedged in 'posting' state from a crashed
  //    previous cycle. Without this, a dead Vercel after() can leave rows
  //    in 'posting' forever and block dedup / re-posting logic.
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: wedged } = await supabase
      .from("dev_content_queue")
      .select("id, generated_at")
      .eq("status", "posting")
      .lt("generated_at", fiveMinAgo);
    if (wedged && wedged.length > 0) {
      await supabase
        .from("dev_content_queue")
        .update({ status: "ready" })
        .in("id", wedged.map((w) => w.id));
      console.log(
        `[DEV SCHEDULER] Recovered ${wedged.length} items wedged in 'posting' state`,
      );
    }
  } catch (resetErr) {
    console.warn(`[DEV SCHEDULER] posting-reset error:`, resetErr);
  }

  // Find queue items that are "ready" (production completed) and not yet posted
  // Use ASCENDING order (oldest first) so content is posted in FIFO order and
  // never re-posted randomly from the same batch.
  const { data: allReady, error } = await supabase
    .from("dev_content_queue")
    .select("*")
    .eq("status", "ready")
    .order("generated_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[DEV SCHEDULER] Failed to fetch ready items:", error.message);
    throw new Error(`Failed to fetch ready items: ${error.message}`);
  }

  if (!allReady || allReady.length === 0) {
    console.log("[DEV SCHEDULER] No completed videos ready for posting");
    return { posted: 0, results: [] };
  }

  // Pre-filter: only consider ready items whose underlying production is
  // actually `completed` with an output URL. Queue items get marked `ready`
  // eagerly by executeProduction, but the production itself may still be
  // rendering — posting before the video is final would break.
  const candidateProductionIds = Array.from(
    new Set(
      (allReady as Array<Record<string, unknown>>)
        .map(
          (row) =>
            ((row.input_data as Record<string, unknown> | null) || {}).production_id as
              | string
              | undefined,
        )
        .filter((x): x is string => !!x),
    ),
  );

  const completedProductionIds = new Set<string>();
  if (candidateProductionIds.length > 0) {
    const { data: prodRows } = await supabase
      .from("productions")
      .select("id, status, output_video_urls")
      .in("id", candidateProductionIds)
      .eq("status", "completed");

    for (const p of (prodRows || []) as Array<{
      id: string;
      output_video_urls: unknown;
    }>) {
      let urls: Record<string, string> = {};
      try {
        urls =
          typeof p.output_video_urls === "string"
            ? JSON.parse(p.output_video_urls)
            : (p.output_video_urls as Record<string, string>) || {};
      } catch {
        /* ignore */
      }
      if (urls.final || Object.keys(urls).length > 0) {
        completedProductionIds.add(p.id);
      }
    }
  }

  const postable = (allReady as Array<Record<string, unknown>>).filter((row) => {
    const pid = ((row.input_data as Record<string, unknown> | null) || {})
      .production_id as string | undefined;
    return pid ? completedProductionIds.has(pid) : false;
  });

  // ── DEDUP: build set of (page_id, production_id) pairs that have ALREADY
  //    been posted. We NEVER post the same production twice to the same page.
  const postableProductionIds = Array.from(
    new Set(
      postable
        .map((row) => (row.input_data as Record<string, unknown> | null)?.production_id as string | undefined)
        .filter((x): x is string => !!x),
    ),
  );
  const alreadyPostedPairs = new Set<string>(); // key = `${page_id}|${production_id}`
  if (postableProductionIds.length > 0) {
    const { data: postedRows } = await supabase
      .from("dev_content_queue")
      .select("page_id, input_data")
      .eq("status", "posted")
      .in("input_data->>production_id", postableProductionIds);
    for (const p of (postedRows || []) as Array<{ page_id: string; input_data: Record<string, unknown> | null }>) {
      const pid = (p.input_data || {}).production_id as string | undefined;
      if (pid) alreadyPostedPairs.add(`${p.page_id}|${pid}`);
    }
  }

  // Filter out duplicates AND auto-mark them posted so they exit the ready queue.
  const dedupedPostable: typeof postable = [];
  for (const row of postable) {
    const pid = (row.input_data as Record<string, unknown> | null)?.production_id as string | undefined;
    const key = `${row.page_id}|${pid}`;
    if (pid && alreadyPostedPairs.has(key)) {
      console.log(
        `[DEV SCHEDULER] DEDUP: production ${pid} already posted to ${row.page_id} — marking duplicate queue row ${row.id} as posted`,
      );
      await supabase
        .from("dev_content_queue")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          error_message: "Duplicate of earlier post (auto-dedup)",
        })
        .eq("id", row.id);
      continue;
    }
    dedupedPostable.push(row);
  }

  // Round-robin OLDEST-per-page selection. FIFO ordering means every page
  // with a completed production gets a post, and content rolls through in
  // a predictable order — never random, never repeated.
  const bestPerPage = new Map<string, (typeof allReady)[number]>();
  for (const row of dedupedPostable as unknown as typeof allReady) {
    const current = bestPerPage.get(row.page_id);
    const currentGen = (current?.generated_at as string) || "9999";
    const rowGen = (row.generated_at as string) || "9999";
    if (!current || rowGen < currentGen) {
      bestPerPage.set(row.page_id, row);
    }
  }

  // Process pages in a stable order (alphabetical by page_id) so the
  // posting log is reproducible and we fairly touch every page every cycle.
  const readyItems = [...bestPerPage.values()].sort((a, b) =>
    String(a.page_id).localeCompare(String(b.page_id)),
  );

  console.log(
    `[DEV SCHEDULER] Posting ${readyItems.length} item(s) (best-per-page from ${postable.length} postable / ${allReady.length} total ready)`,
  );

  const pages = getAllDevPages();
  const results: Array<{
    page: string;
    videoId: string;
    platform: string;
    success: boolean;
    postId?: string;
    error?: string;
  }> = [];

  // Build posting batches
  const fbPosts: Array<{
    videoId: string;
    userId: string;
    pageKey: string;
    caption: string;
    queueId: string;
    directVideoUrl?: string;
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

    // Resolve the final video URL. Three cases:
    //   1) outputUrls.final = "/api/videos/{uuid}" → extract uuid as videoId
    //   2) outputUrls.final = "https://..." (R2 signed URL / CDN) → pass as directVideoUrl
    //   3) No final key → use first scene URL from outputUrls, or production.id for R2 lookup
    let videoId = production.id;
    let directVideoUrl: string | undefined;

    const finalEntry = (outputUrls.final as string) || "";
    if (finalEntry.startsWith("/api/videos/")) {
      videoId = finalEntry.replace("/api/videos/", "");
    } else if (finalEntry.startsWith("http")) {
      directVideoUrl = finalEntry;
    } else {
      // No usable "final" — try first scene URL
      const firstSceneUrl = Object.entries(outputUrls)
        .filter(([k]) => k.startsWith("scene_"))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v as string)
        .find((u) => u?.startsWith("http"));
      if (firstSceneUrl) {
        directVideoUrl = firstSceneUrl;
      }
    }

    const topicTitle = item.input_data?.topic_title || "Trending Now";

    // Build caption with page hashtags
    const hashtagStr = (page.hashtags || []).join(" ");
    const caption = `${topicTitle}\n\n${hashtagStr}\n\n#Trending #Viral #ForYou`;

    // Queue Facebook post
    if (page.facebook_page_key) {
      fbPosts.push({
        videoId,
        userId: DEV_USER_ID,
        pageKey: page.facebook_page_key,
        caption,
        queueId: item.id,
        directVideoUrl,
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
            postId: r.postId,
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
            postId: r.youtubeVideoId,
            error: r.error,
          });
        }
      }
    } catch (e) {
      console.error("[DEV SCHEDULER] YouTube posting failed:", e);
    }
  }

  // ---- Update queue status based on results ----
  // Index successful post IDs by queue item for quick lookup
  const fbResultByVideoId = new Map<string, typeof results[number]>();
  const ytResultByVideoId = new Map<string, typeof results[number]>();
  for (const r of results) {
    if (!r.success) continue;
    if (r.platform === "facebook") fbResultByVideoId.set(r.videoId, r);
    if (r.platform === "youtube") ytResultByVideoId.set(r.videoId, r);
  }

  for (const item of readyItems) {
    const productionId = item.input_data?.production_id;
    // Check if any of this item's videos were successfully posted
    const fbPost = fbPosts.find((p) => p.queueId === item.id);
    const ytPost = ytPosts.find((p) => p.queueId === item.id);
    const fbResult = fbPost ? fbResultByVideoId.get(fbPost.videoId) : undefined;
    const ytResult = ytPost ? ytResultByVideoId.get(ytPost.videoId) : undefined;
    const fbSuccess = !!fbResult;
    const ytSuccess = !!ytResult;

    if (fbSuccess || ytSuccess) {
      // Persist FB + YT post IDs so the learn-and-adapt loop can pull insights later.
      const existingInput = (item.input_data as Record<string, unknown>) || {};
      const postIds: Record<string, string> = {};
      if (fbResult?.postId) postIds.facebook = fbResult.postId;
      if (ytResult?.postId) postIds.youtube = ytResult.postId;
      // Also remember which page_key the FB post went to (for token lookup on pull)
      if (fbPost) postIds.facebook_page_key = fbPost.pageKey;

      const mergedInput = {
        ...existingInput,
        post_ids: {
          ...(existingInput.post_ids as Record<string, string> | undefined),
          ...postIds,
        },
      };

      await supabase
        .from("dev_content_queue")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          input_data: mergedInput,
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
// Step 6: PULL METRICS — learn half of learn-and-adapt
// ──────────────────────────────────────────────────────────

async function handlePullMetrics(): Promise<{ pulled: number; items: number }> {
  console.log("[DEV SCHEDULER] Pulling engagement metrics for posted videos...");

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  try {
    const res = await fetch(`${appUrl}/api/dev/pull-metrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[DEV SCHEDULER] Pull-metrics endpoint returned ${res.status}: ${text}`,
      );
      return { pulled: 0, items: 0 };
    }

    const data = await res.json();
    console.log(
      `[DEV SCHEDULER] Metrics pulled for ${data.pulled}/${data.items} posted items`,
    );
    return { pulled: data.pulled || 0, items: data.items || 0 };
  } catch (err) {
    console.error("[DEV SCHEDULER] Pull-metrics call failed:", err);
    return { pulled: 0, items: 0 };
  }
}

// ──────────────────────────────────────────────────────────
// Step 7: ANALYZE — adapt half of learn-and-adapt
// ──────────────────────────────────────────────────────────

async function handleAnalyze(): Promise<{
  analyzed: number;
  winners: unknown[];
  learned_pillar_boost: Record<string, number>;
}> {
  console.log("[DEV SCHEDULER] Analyzing engagement performance...");

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  try {
    const res = await fetch(`${appUrl}/api/dev/analyze-performance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[DEV SCHEDULER] Analyze endpoint returned ${res.status}: ${text}`,
      );
      return { analyzed: 0, winners: [], learned_pillar_boost: {} };
    }

    const data = await res.json();
    console.log(
      `[DEV SCHEDULER] Analyzed ${data.analyzed} items; learned boosts:`,
      JSON.stringify(data.learned_pillar_boost || {}),
    );
    return {
      analyzed: data.analyzed || 0,
      winners: data.winners || [],
      learned_pillar_boost: data.learned_pillar_boost || {},
    };
  } catch (err) {
    console.error("[DEV SCHEDULER] Analyze call failed:", err);
    return { analyzed: 0, winners: [], learned_pillar_boost: {} };
  }
}

// ──────────────────────────────────────────────────────────
// Step 0: RECONCILE — unstick productions stalled by silent failures
// ──────────────────────────────────────────────────────────

async function handleReconcile(): Promise<{
  actions_taken: number;
  stuck_items_checked: number;
  orphan_assemblies: number;
}> {
  console.log("[DEV SCHEDULER] Reconciling stuck productions...");

  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  try {
    const res = await fetch(`${appUrl}/api/dev/reconcile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[DEV SCHEDULER] Reconcile endpoint returned ${res.status}: ${text}`,
      );
      return { actions_taken: 0, stuck_items_checked: 0, orphan_assemblies: 0 };
    }

    const data = await res.json();
    if ((data.actions_taken || 0) > 0) {
      console.warn(
        `[DEV SCHEDULER] Reconciler recovered ${data.actions_taken} stuck item(s):`,
        JSON.stringify(data.actions || []),
      );
    } else {
      console.log(
        `[DEV SCHEDULER] Reconcile clean — no stuck items (checked ${data.stuck_items_checked || 0})`,
      );
    }
    return {
      actions_taken: data.actions_taken || 0,
      stuck_items_checked: data.stuck_items_checked || 0,
      orphan_assemblies: data.orphan_assemblies || 0,
    };
  } catch (err) {
    console.error("[DEV SCHEDULER] Reconcile call failed:", err);
    return { actions_taken: 0, stuck_items_checked: 0, orphan_assemblies: 0 };
  }
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

      // ---- Pull metrics (learn) ----
      case "pull_metrics": {
        const result = await handlePullMetrics();
        return NextResponse.json({
          action: "pull_metrics",
          success: true,
          ...result,
        });
      }

      // ---- Analyze (adapt) ----
      case "analyze": {
        const result = await handleAnalyze();
        return NextResponse.json({
          action: "analyze",
          success: true,
          ...result,
        });
      }

      // ---- Reconcile (unstick stuck productions) ----
      case "reconcile": {
        const result = await handleReconcile();
        return NextResponse.json({
          action: "reconcile",
          success: true,
          ...result,
        });
      }

      // ---- Full Pipeline ----
      case "full": {
        console.log("[DEV SCHEDULER] Running FULL learn-and-adapt pipeline...");
        const stepResults: Record<string, unknown> = {};

        // Step 0: Reconcile — recover anything stuck from the previous cycle
        //          BEFORE we try to produce new content.
        const reconciled = await handleReconcile();
        stepResults.reconcile = reconciled;
        console.log(
          `[DEV SCHEDULER] Full pipeline [1/8]: reconciler recovered ${reconciled.actions_taken} stuck item(s)`,
        );

        // Step 1: Pull metrics from previously-posted videos (learn)
        //          — must run BEFORE generate so adaptive weights are fresh.
        const pulled = await handlePullMetrics();
        stepResults.pull_metrics = pulled;
        console.log(
          `[DEV SCHEDULER] Full pipeline [2/8]: metrics pulled for ${pulled.pulled}/${pulled.items} items`,
        );

        // Step 2: Analyze performance, write back tiers, compute boosts
        const analyzed = await handleAnalyze();
        stepResults.analyze = analyzed;
        console.log(
          `[DEV SCHEDULER] Full pipeline [3/8]: analyzed ${analyzed.analyzed} items`,
        );

        // Step 3: Fetch trends
        const trends = await handleFetchTrends();
        stepResults.fetch_trends = { count: trends.count };
        console.log(`[DEV SCHEDULER] Full pipeline [4/8]: ${trends.count} trends fetched`);

        // Step 4: Smart content rotation (now uses learned boosts)
        const generated = await handleGenerate();
        stepResults.generate = { queued: generated.queued, entries: generated.entries };
        console.log(`[DEV SCHEDULER] Full pipeline [5/8]: ${generated.queued} items queued`);

        // Step 5: Trigger Brain Studio production
        const produced = await handleProduce();
        stepResults.produce = produced;
        console.log(`[DEV SCHEDULER] Full pipeline [6/8]: ${produced.triggered} production(s) triggered`);

        // Step 6: Poll assembly for any in-progress work from previous cycles
        const polled = await handlePollAssembly();
        stepResults.poll = polled;
        console.log(`[DEV SCHEDULER] Full pipeline [7/8]: ${polled.polled} production(s) polled`);

        // Step 7: Post any ready videos from previous cycles
        const posted = await handlePost();
        stepResults.post = posted;
        console.log(`[DEV SCHEDULER] Full pipeline [8/8]: ${posted.posted} video(s) posted`);

        console.log("[DEV SCHEDULER] Full learn-and-adapt pipeline complete.");

        return NextResponse.json({
          action: "full",
          success: true,
          pipeline:
            "reconcile -> pull_metrics -> analyze -> fetch -> generate -> produce -> poll -> post",
          steps: stepResults,
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Invalid action: ${action}. Use: fetch_trends, generate, produce, poll, post, pull_metrics, analyze, reconcile, or full`,
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
