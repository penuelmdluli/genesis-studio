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
import { createSupabaseAdmin } from "@/lib/supabase";
import { planProduction } from "@/lib/genesis-brain/planner";
import { createProduction, executeProduction, updateProduction } from "@/lib/genesis-brain/orchestrator";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import { BrainInput, ScenePlan } from "@/types";
import { after } from "next/server";

const FAL_API_KEY = process.env.FAL_KEY || "";

export const maxDuration = 300;

// The owner user ID — dev productions are created under this account
const DEV_USER_ID = "c1fccbb2-86e9-4d34-ae43-4a7cf4fd4a26";
const DEV_CLERK_ID = process.env.OWNER_CLERK_IDS?.split(",")[0]?.trim() || "";

// Best voice for all content — cinematic male narrator
const DEFAULT_VOICE = "en-US-GuyNeural"; // Maps to Kokoro "am_adam"
const DEFAULT_LANGUAGE = "en-US";

/**
 * Generate a reference image for a scene using FLUX Pro.
 * This image is then used for i2v (image-to-video) to get character consistency.
 * Returns the image URL or null on failure.
 */
async function generateReferenceImage(scenePrompt: string): Promise<string | null> {
  if (!FAL_API_KEY) {
    console.warn("[DEV PRODUCE] No FAL_KEY — skipping reference image generation");
    return null;
  }

  try {
    // Build an image-optimized prompt from the video prompt
    // Strip camera movement/duration language, keep visual description
    const imagePrompt = scenePrompt
      .replace(/slow dolly|push-in|tracking shot|crane|steadicam|handheld|orbit|drone|jib|whip pan|parallax|locked-off|dutch angle/gi, "")
      .replace(/\d+mm|f\/[\d.]+/gi, "") // remove lens specs
      .replace(/cinematic,?\s*/gi, "")
      .replace(/4K,?\s*/gi, "")
      .replace(/film grain,?\s*/gi, "")
      .trim();

    const falRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `${imagePrompt}, highly detailed, sharp focus, studio quality, photorealistic`,
        image_size: { width: 720, height: 1280 }, // Portrait for Reels
        num_images: 1,
        enable_safety_checker: false,
        output_format: "jpeg",
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!falRes.ok) {
      console.error("[DEV PRODUCE] FLUX Pro error:", await falRes.text().catch(() => "unknown"));
      return null;
    }

    const result = await falRes.json();
    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) {
      console.error("[DEV PRODUCE] FLUX Pro returned no images");
      return null;
    }

    console.log(`[DEV PRODUCE] Reference image generated: ${imageUrl.slice(0, 80)}...`);
    return imageUrl;
  } catch (err) {
    console.error("[DEV PRODUCE] Reference image generation failed:", err);
    return null;
  }
}

/**
 * For each scene in the plan, generate a reference image and set referenceImageUrl.
 * Uses scene 1's image as the hero reference for all scenes (character consistency).
 */
async function injectReferenceImages(plan: ScenePlan): Promise<ScenePlan> {
  if (!FAL_API_KEY || plan.scenes.length === 0) return plan;

  console.log(`[DEV PRODUCE] Generating hero reference image for i2v character consistency...`);

  // Generate ONE hero reference from scene 1 — used for ALL scenes
  // This ensures the same character/style appears consistently throughout
  const heroPrompt = plan.scenes[0].prompt;
  const heroImageUrl = await generateReferenceImage(heroPrompt);

  if (!heroImageUrl) {
    console.warn("[DEV PRODUCE] Hero reference image failed — falling back to t2v");
    return plan;
  }

  // Apply hero reference to ALL scenes for maximum consistency
  for (const scene of plan.scenes) {
    scene.referenceImageUrl = heroImageUrl;
  }

  console.log(`[DEV PRODUCE] All ${plan.scenes.length} scenes set to i2v with hero reference image`);
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

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { queueItemId } = body as { queueItemId?: string };

    const supabase = createSupabaseAdmin();

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
      // Fetch pending items
      const { data: pending } = await supabase
        .from("dev_content_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(6);

      // Also recover stuck "generating" items (no production_id and older than 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from("dev_content_queue")
        .select("*")
        .eq("status", "generating")
        .lt("created_at", fiveMinAgo)
        .order("created_at", { ascending: true })
        .limit(6);

      queueItems = [...((pending || []) as QueueItem[]), ...((stuck || []) as QueueItem[])];
    }

    if (queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
        produced: 0,
      });
    }

    // Limit to 3 per call — each gets its own after() for reliability
    const itemsToProcess = queueItems.slice(0, 3);

    console.log(`[DEV PRODUCE] Launching ${itemsToProcess.length} Hollywood productions (each in separate after())`);

    // Mark all as "generating" immediately
    for (const item of itemsToProcess) {
      await supabase
        .from("dev_content_queue")
        .update({ status: "generating" })
        .eq("id", item.id);
    }

    // Spawn a SEPARATE after() for EACH item — so if one dies, others still run
    for (const item of itemsToProcess) {
      after(async () => {
        const itemSupabase = createSupabaseAdmin();
        try {
          const concept = item.input_data?.topic_title || "Dev content";
          const videoPrompt = item.input_data?.video_prompt || concept;
          const pageName = item.input_data?.page_name || item.page_id;

          console.log(`[DEV PRODUCE] Planning production for ${pageName}: "${concept.slice(0, 60)}..."`);

          // Build Brain Studio input with FULL audio pipeline
          const brainInput: BrainInput = {
            concept: videoPrompt,
            targetDuration: 20,
            style: "cinematic",
            aspectRatio: "portrait",
            voiceover: true,
            voiceoverVoice: DEFAULT_VOICE,
            voiceoverLanguage: DEFAULT_LANGUAGE,
            music: true,
            captions: true,
            soundEffects: true,
          };

          // Step 1: Plan with Hollywood cinematography prompt
          let plan = await planProduction(brainInput);
          plan = consistencyEngine.applyAll(plan);
          (plan as unknown as Record<string, unknown>).voiceoverVoice = DEFAULT_VOICE;
          (plan as unknown as Record<string, unknown>).voiceoverLanguage = DEFAULT_LANGUAGE;

          // Step 1b: Generate hero reference image for i2v character consistency
          plan = await injectReferenceImages(plan);

          // Step 2: Create production record
          brainInput.concept = concept;
          const production = await createProduction(DEV_USER_ID, brainInput, plan);
          console.log(`[DEV PRODUCE] Production ${production.id} created for ${pageName}`);

          // Link queue item to production
          await itemSupabase
            .from("dev_content_queue")
            .update({
              status: "generating",
              input_data: { ...item.input_data, production_id: production.id },
            })
            .eq("id", item.id);

          // Step 3: Execute (scenes + audio + assembly)
          await executeProduction(production.id, DEV_USER_ID, DEV_CLERK_ID, plan, brainInput);

          console.log(`[DEV PRODUCE] Production ${production.id} DONE for ${pageName}`);
          await itemSupabase
            .from("dev_content_queue")
            .update({ status: "ready", generated_at: new Date().toISOString() })
            .eq("id", item.id);
        } catch (err) {
          console.error(`[DEV PRODUCE] FAILED for queue item ${item.id}:`, err);
          await itemSupabase
            .from("dev_content_queue")
            .update({
              status: "failed",
              error_message: err instanceof Error ? err.message : "Production failed",
            })
            .eq("id", item.id);
        }
      });
    }

    return NextResponse.json({
      success: true,
      produced: itemsToProcess.length,
      remaining: queueItems.length - itemsToProcess.length,
      total: queueItems.length,
      pipeline: "Brain Studio Hollywood (Claude plan + FLUX Pro i2v + RunPod + FAL audio)",
      voice: `${DEFAULT_VOICE} (Kokoro am_adam)`,
      note: "Each item runs in its own background worker — call again for remaining items",
      results: itemsToProcess.map((item) => ({
        queueId: item.id,
        pageName: item.input_data?.page_name || item.page_id,
        status: "queued_for_production",
      })),
    });
  } catch (error) {
    console.error("[DEV PRODUCE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
