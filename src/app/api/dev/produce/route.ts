/**
 * Dev Produce API — Trigger full Brain Studio production for dev content queue items
 *
 * POST /api/dev/produce
 * Body: { queueItemId?: string } — process specific item, or process all pending
 * Auth: CRON_SECRET
 *
 * Uses the FULL Brain Studio pipeline:
 * - RunPod for video generation (wan-2.2, ltx-video)
 * - FAL Kokoro TTS for voiceover (premium quality)
 * - FAL for music, subtitles, audio composition
 * - FAL auto-subtitle for caption burning
 *
 * Voice: en-US-GuyNeural (am_adam) — the best cinematic narrator voice
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { planProduction } from "@/lib/genesis-brain/planner";
import { createProduction, executeProduction } from "@/lib/genesis-brain/orchestrator";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import { BrainInput, ScenePlan } from "@/types";
import { after } from "next/server";
import { applyIntelligenceToProduction } from "@/lib/intelligence/decision-engine";
import {
  computeAdaptiveHints,
  preferredCtaPatternFor,
} from "@/lib/dev-adaptive-hints";
import { getDevPage } from "@/lib/dev-pages";
import { getAfricanVoiceConfig, isAfricanLanguage } from "@/lib/africa/voice-config";
import { blockInProduction } from "@/lib/dev-only";

const FAL_API_KEY = process.env.FAL_KEY || "";

export const maxDuration = 300;

// The owner user ID — dev productions are created under this account
const DEV_USER_ID = "c1fccbb2-86e9-4d34-ae43-4a7cf4fd4a26";
const DEV_CLERK_ID = process.env.OWNER_CLERK_IDS?.split(",")[0]?.trim() || "";

// Fallback voice for non-African content
const DEFAULT_VOICE = "en-US-GuyNeural";
const DEFAULT_LANGUAGE = "en-US";

/**
 * Generate a reference image for a scene using FLUX Pro.
 * This image is then used for i2v (image-to-video) to get character consistency.
 * Returns the image URL or null on failure.
 */
async function generateReferenceImage(
  scenePrompt: string,
  sceneNum?: number,
): Promise<string | null> {
  if (!FAL_API_KEY) {
    console.warn("[DEV PRODUCE] No FAL_KEY — skipping reference image generation");
    return null;
  }

  // Build an image-optimized prompt from the video prompt
  const imagePrompt = scenePrompt
    .replace(/slow dolly|push-in|tracking shot|crane|steadicam|handheld|orbit|drone|jib|whip pan|parallax|locked-off|dutch angle/gi, "")
    .replace(/\d+mm|f\/[\d.]+/gi, "")
    .replace(/cinematic,?\s*/gi, "")
    .replace(/4K,?\s*/gi, "")
    .replace(/film grain,?\s*/gi, "")
    .replace(/No human face.*$/i, "")
    .trim();

  const finalPrompt = `${imagePrompt}, empty landscape, no people, no person, no human, no face, no figure, environment only, photorealistic, highly detailed, sharp focus, studio quality`;

  // Retry up to 3 times with exponential backoff for rate limit resilience
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const falRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image_size: { width: 720, height: 1280 },
          num_images: 1,
          enable_safety_checker: false,
          output_format: "jpeg",
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }),
      });

      // Rate limited — back off and retry
      if (falRes.status === 429 || falRes.status === 503) {
        const waitMs = 2000 * attempt; // 2s, 4s, 6s
        console.warn(`[DEV PRODUCE] FLUX rate-limited (${falRes.status}), attempt ${attempt}/${MAX_RETRIES}, waiting ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!falRes.ok) {
        const errText = await falRes.text().catch(() => "unknown");
        console.error(`[DEV PRODUCE] FLUX Pro error (${falRes.status}) scene ${sceneNum ?? "?"}: ${errText.slice(0, 200)}`);
        // Non-rate-limit errors: retry once then give up
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return null;
      }

      const result = await falRes.json();
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) {
        console.error(`[DEV PRODUCE] FLUX Pro returned no images scene ${sceneNum ?? "?"} attempt ${attempt}`);
        if (attempt < MAX_RETRIES) continue;
        return null;
      }

      console.log(`[DEV PRODUCE] Scene ${sceneNum ?? "?"} ref image (attempt ${attempt}): ${imageUrl.slice(0, 60)}...`);
      return imageUrl;
    } catch (err) {
      console.error(`[DEV PRODUCE] FLUX attempt ${attempt} scene ${sceneNum ?? "?"} error:`, err instanceof Error ? err.message : err);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Generate a PER-SCENE reference image for each scene in the plan.
 * Runs in parallel. Used for i2v mode to force wan-2.2 to start from our
 * environment image instead of its default-person frame.
 */
async function injectReferenceImages(plan: ScenePlan): Promise<ScenePlan> {
  if (!FAL_API_KEY || plan.scenes.length === 0) return plan;

  console.log(`[DEV PRODUCE] Generating ${plan.scenes.length} per-scene reference images (FLUX Pro, SEQUENTIAL to avoid rate limits)...`);

  // Sequential to avoid FAL rate limits. FLUX Pro takes ~5s per image,
  // so 4 scenes ~20s total. Worth it to guarantee every scene has a ref.
  for (const scene of plan.scenes) {
    const imageUrl = await generateReferenceImage(scene.prompt, scene.sceneNumber);
    if (imageUrl) {
      scene.referenceImageUrl = imageUrl;
    } else {
      console.warn(`[DEV PRODUCE] Scene ${scene.sceneNumber} reference image FAILED after 3 retries — will fall back to t2v (may show default face)`);
    }
    // Brief pause between requests to be kind to FAL
    await new Promise((r) => setTimeout(r, 500));
  }

  const withRef = plan.scenes.filter((s) => s.referenceImageUrl).length;
  console.log(`[DEV PRODUCE] ${withRef}/${plan.scenes.length} scenes have reference images (i2v mode)`);

  // CRITICAL: if we didn't get at least one reference image, the whole video
  // will show the default wan-2.2 face. Log loudly so we notice in Vercel logs.
  if (withRef === 0) {
    console.error(`[DEV PRODUCE] ⚠️⚠️⚠️ ALL REFERENCE IMAGES FAILED — video will show default face avatar!`);
  }

  return plan;
}


function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

interface QueueItem {
  id: string;
  page_id: string;
  pillar: string;
  engine: string;
  input_data: {
    page_name?: string;
    topic_title?: string;
    video_prompt?: string;
    provider?: string;
    reason?: string;
  };
  caption?: string;
  status: string;
  news_topic_id?: string;
}

/**
 * Quick FAL health check — detects balance exhaustion early so we don't
 * trigger a full production flow that will fail halfway through.
 */
async function checkFalHealth(): Promise<{ ok: boolean; reason?: string }> {
  if (!FAL_API_KEY) return { ok: false, reason: "FAL_KEY not set" };
  try {
    const r = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "x", image_size: { width: 256, height: 256 }, num_images: 1 }),
    });
    if (r.status === 403) {
      const txt = await r.text().catch(() => "");
      if (txt.includes("Exhausted balance") || txt.includes("locked")) {
        return { ok: false, reason: "FAL balance exhausted — top up at fal.ai/dashboard/billing" };
      }
      return { ok: false, reason: "FAL returned 403: " + txt.substring(0, 100) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "FAL unreachable: " + (err instanceof Error ? err.message : "unknown") };
  }
}

export async function POST(req: NextRequest) {
  const blocked = blockInProduction(req);
  if (blocked) return blocked;

  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Video: wan-2.2 (RunPod, only endpoint with active workers)
    // Audio/voiceover/subtitles: local FFmpeg + Edge TTS (free, no FAL needed)

    const body = await req.json().catch(() => ({}));
    const { queueItemId } = body as { queueItemId?: string };

    const supabase = getDb();

    // Get pending items — also recover items stuck at "generating" for >5 min
    let queueItems: QueueItem[] = [];

    if (queueItemId) {
      const { data, error: fetchErr } = await supabase
        .from("dev_content_queue")
        .select("*")
        .eq("id", queueItemId)
        .limit(1);
      if (fetchErr) throw new Error(`Failed to fetch queue: ${fetchErr.message}`);
      queueItems = (data || []) as QueueItem[];
    } else {
      // "Best trending" selection: prefer the freshest queue items first
      // (last 48 hours) and within those, pick the highest niche_score.
      // This guarantees we always produce the BEST currently-trending topic
      // instead of draining stale items in FIFO order.
      const fortyEightHoursAgo = new Date(
        Date.now() - 48 * 60 * 60 * 1000,
      ).toISOString();

      const { data: freshPending } = await supabase
        .from("dev_content_queue")
        .select("*")
        .eq("status", "pending")
        .gte("created_at", fortyEightHoursAgo)
        .order("created_at", { ascending: false })
        .limit(50);

      // Sort the fresh pool by niche_score (highest first), tiebreak newest
      const sortedFresh = ((freshPending || []) as QueueItem[]).sort((a, b) => {
        const scoreA = Number(
          (a.input_data as Record<string, unknown> | undefined)?.niche_score || 0,
        );
        const scoreB = Number(
          (b.input_data as Record<string, unknown> | undefined)?.niche_score || 0,
        );
        return scoreB - scoreA;
      });

      // Also recover stuck "generating" items as a SECONDARY source —
      // only used if no fresh pending items remain
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from("dev_content_queue")
        .select("*")
        .eq("status", "generating")
        .lt("created_at", fiveMinAgo)
        .order("created_at", { ascending: true })
        .limit(6);

      queueItems = [...sortedFresh, ...((stuck || []) as QueueItem[])];
    }

    if (queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
        produced: 0,
      });
    }

    // Process ONE item per call — planning is done synchronously (within the function timeout),
    // only scene execution goes into after() (which is lightweight — just API calls + audio gen)
    const item = queueItems[0];
    const concept = item.input_data?.topic_title || "Dev content";
    const videoPrompt = item.input_data?.video_prompt || concept;
    const pageName = item.input_data?.page_name || item.page_id;

    console.log(`[DEV PRODUCE] Processing ${pageName}: "${concept.slice(0, 60)}..."`);

    // Mark as generating
    await supabase
      .from("dev_content_queue")
      .update({ status: "generating" })
      .eq("id", item.id);

    // ── SYNCHRONOUS: Plan + i2v image (within function timeout) ──

    // Learn-and-adapt: compute hints before planning so the planner can
    // use the winning CTA pattern for this page (if we have enough data).
    const adaptiveHints = await computeAdaptiveHints();
    const ctaPatternHint = preferredCtaPatternFor(adaptiveHints, item.page_id);
    if (ctaPatternHint) {
      console.log(
        `[DEV PRODUCE] Adaptive CTA hint for ${pageName}: "${ctaPatternHint}" (samples=${adaptiveHints.samples})`,
      );
    }

    // Apply intelligence decisions to optimize production
    let smartDuration = 20;
    try {
      const fbKey = (item.input_data as Record<string, unknown>)?.facebook_page_key as string || item.page_id;
      const { config: smartConfig, decisions } = await applyIntelligenceToProduction(fbKey, {
        category: item.pillar || "",
        targetDuration: 20,
      });
      if (smartConfig.targetDuration && typeof smartConfig.targetDuration === "number") {
        smartDuration = smartConfig.targetDuration;
      }
      if (decisions.length > 0) {
        console.log(`[DEV PRODUCE] Intelligence applied ${decisions.length} decisions for ${pageName}`);
      }
    } catch (err) {
      console.warn("[DEV PRODUCE] Intelligence engine failed (using defaults):", err);
    }

    // Look up page config for language — African pages get optimized voice
    const pageConfig = getDevPage(item.page_id);
    const pageLanguage = pageConfig?.voiceoverLanguage || DEFAULT_LANGUAGE;
    const africanVoice = getAfricanVoiceConfig(pageLanguage);
    const voiceForPage = africanVoice ? DEFAULT_VOICE : DEFAULT_VOICE; // Voice is resolved in audio.ts via language
    console.log(`[DEV PRODUCE] Language: ${pageLanguage}${isAfricanLanguage(pageLanguage) ? " (African optimized)" : ""}`);

    const brainInput: BrainInput = {
      concept: videoPrompt,
      targetDuration: smartDuration,
      style: "cinematic",
      aspectRatio: "portrait",
      voiceover: true,
      voiceoverVoice: voiceForPage,
      voiceoverLanguage: pageLanguage,
      music: true,
      captions: true,
      soundEffects: true,
      engagementCTA: true, // Narrator always closes with like/comment/share
      ctaPatternHint, // Learn-and-adapt: prefer the winning pattern for this page
      pillar: item.pillar || (item.input_data as Record<string, unknown>)?.topic_category as string | undefined, // Drives stock footage fallback query
    };

    // Step 1: Plan with Hollywood cinematography prompt (~10-15s)
    let plan = await planProduction(brainInput);
    plan = consistencyEngine.applyAll(plan);
    (plan as unknown as Record<string, unknown>).voiceoverVoice = voiceForPage;
    (plan as unknown as Record<string, unknown>).voiceoverLanguage = pageLanguage;

    console.log(`[DEV PRODUCE] Plan ready: ${plan.scenes.length} scenes for ${pageName}`);

    // Step 1b: i2v disabled. Anti-avatar prompts enforced in planner.
    // plan = await injectReferenceImages(plan);

    // Step 2: Create production record
    brainInput.concept = concept;
    const production = await createProduction(DEV_USER_ID, brainInput, plan);
    console.log(`[DEV PRODUCE] Production ${production.id} created for ${pageName}`);

    // Link queue item to production and persist the CTA pattern (for learn-and-adapt)
    await supabase
      .from("dev_content_queue")
      .update({
        status: "generating",
        input_data: {
          ...item.input_data,
          production_id: production.id,
          engagement_cta: true,
          cta_pattern: plan.ctaPattern || null,
          cta_pattern_hint_used: ctaPatternHint || null,
        },
      })
      .eq("id", item.id);

    // ── ASYNC: Scene execution + audio in after() ──
    // executeProduction submits scenes to RunPod (fast API calls) then generates audio.
    // This is the lightweight part — the heavy Claude+FLUX work is already done above.
    after(async () => {
      const bgSupabase = getDb();
      try {
        await executeProduction(production.id, DEV_USER_ID, DEV_CLERK_ID, plan, brainInput);
        console.log(`[DEV PRODUCE] Production ${production.id} DONE for ${pageName}`);
        await bgSupabase
          .from("dev_content_queue")
          .update({ status: "ready", generated_at: new Date().toISOString() })
          .eq("id", item.id);
      } catch (err) {
        console.error(`[DEV PRODUCE] Production ${production.id} FAILED:`, err);
        await bgSupabase
          .from("dev_content_queue")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Production failed",
          })
          .eq("id", item.id);
      }
    });

    return NextResponse.json({
      success: true,
      produced: 1,
      remaining: queueItems.length - 1,
      total: queueItems.length,
      productionId: production.id,
      concept,
      scenes: plan.scenes.length,
      i2v: !!plan.scenes[0]?.referenceImageUrl,
      pipeline: "Brain Studio (Claude plan + wan-2.2 RunPod video + local FFmpeg/Edge TTS audio/subtitles)",
      voice: `${voiceForPage} (${pageLanguage}${africanVoice ? `, Kokoro ${africanVoice.voice} @${africanVoice.speed}x` : ""})`,
      note: "Scenes submitted to RunPod in background. Call again for next item.",
    });
  } catch (error) {
    console.error("[DEV PRODUCE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
