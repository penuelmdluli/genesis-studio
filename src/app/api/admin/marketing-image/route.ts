/**
 * Owner Marketing Image Generator
 *
 * POST /api/admin/marketing-image
 * Body: { characterPresetId, scenarioPresetId, customPrompt? }
 *
 * GET /api/admin/marketing-image
 * Returns: presets list + image history
 *
 * Uses FLUX Pro to generate the best SA-culture branded images.
 * Owner-only, no credit cost.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { envString } from "@/lib/env";
import {
  SA_CHARACTER_PRESETS,
  SCENARIO_PRESETS,
  buildOwnerImagePrompt,
  saveMarketingImage,
  getMarketingImageHistory,
} from "@/lib/owner-marketing";

const WS_API_BASE = "https://api.wavespeed.ai/api/v3";
const WS_IMAGE_MODEL = "wavespeed-ai/flux-schnell";

/**
 * Apply branding overlay to a generated image.
 * Sends to the scraper service which uses ffmpeg to stamp:
 * - "ivideostudio.ai" website URL (bottom right)
 * - "GENESIS STUDIO" logo text (top left, subtle)
 * - "Create AI Videos FREE" tagline (bottom center)
 * - Semi-transparent dark gradient bar at bottom for readability
 */
async function applyImageBranding(imageBuffer: Buffer): Promise<Buffer> {
  const scraperUrl = envString("SCRAPER_SERVICE_URL");
  const scraperSecret = envString("SCRAPER_SERVICE_SECRET");

  if (!scraperUrl || !scraperSecret) {
    // No scraper configured — return unbrandd
    return imageBuffer;
  }

  try {
    const res = await fetch(`${scraperUrl}/brand-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scraper-secret": scraperSecret,
      },
      body: JSON.stringify({
        imageBase64: imageBuffer.toString("base64"),
        website: "ivideostudio.ai",
        logoText: "GENESIS STUDIO",
        tagline: "Create AI Videos FREE",
      }),
    });

    if (!res.ok) {
      console.warn("[MARKETING-IMG] Branding overlay failed, returning unbranded");
      return imageBuffer;
    }

    const data = await res.json();
    if (data.imageBase64) {
      return Buffer.from(data.imageBase64, "base64");
    }
    return imageBuffer;
  } catch (err) {
    console.warn("[MARKETING-IMG] Branding error:", err);
    return imageBuffer;
  }
}

// ── Quality boosters appended to every prompt ──
const QUALITY_SUFFIX =
  "masterpiece, award-winning photography, ultra sharp focus, " +
  "8K UHD, hyperrealistic, photorealistic skin texture, " +
  "full body visible from head to feet, full length shot, entire body in frame, " +
  "main character in sharp focus center frame, blurred crowd of people celebrating in background, " +
  "vibrant atmosphere, bokeh background figures, ray tracing, volumetric lighting, cinematic color grading";

// Branding overlay config — applied AFTER AI generation via canvas
const BRANDING = {
  website: "ivideostudio.ai",
  tagline: "Create AI Videos FREE",
  logoText: "GENESIS STUDIO",
};

export async function GET(req: NextRequest) {
  const authResult = await requireStudioOwner();
  if (authResult instanceof NextResponse) return authResult;

  const history = await getMarketingImageHistory(30);

  return NextResponse.json({
    characters: SA_CHARACTER_PRESETS,
    scenarios: SCENARIO_PRESETS,
    history,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireStudioOwner();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { characterPresetId, scenarioPresetId, customPrompt } = await req.json();

    const character = SA_CHARACTER_PRESETS.find((c) => c.id === characterPresetId);
    const scenario = SCENARIO_PRESETS.find((s) => s.id === scenarioPresetId);

    if (!character && !customPrompt) {
      return NextResponse.json(
        { error: "Select a character preset or provide a custom prompt" },
        { status: 400 }
      );
    }

    // Build the prompt
    let prompt: string;
    if (customPrompt) {
      prompt = `${customPrompt}. ${QUALITY_SUFFIX}`;
    } else if (character && scenario) {
      prompt = `${buildOwnerImagePrompt(character, scenario)}. ${QUALITY_SUFFIX}`;
    } else if (character) {
      prompt = `${character.prompt}. ${QUALITY_SUFFIX}`;
    } else {
      prompt = `${customPrompt}. ${QUALITY_SUFFIX}`;
    }

    console.log(`[MARKETING-IMG] Generating: ${prompt.slice(0, 120)}...`);

    // Generate with WaveSpeed — 4 parallel requests (1 image each)
    const wsKey = envString("WAVESPEED_API_KEY");
    if (!wsKey) {
      return NextResponse.json({ error: "WAVESPEED_API_KEY not configured" }, { status: 503 });
    }

    console.log(`[MARKETING-IMG] Generating 4 images via WaveSpeed...`);

    const submitPromises = Array.from({ length: 4 }, () =>
      fetch(`${WS_API_BASE}/${WS_IMAGE_MODEL}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${wsKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_size: { width: 768, height: 1360 }, num_images: 1 }),
      })
    );
    const submitResults = await Promise.all(submitPromises);
    const jobs: string[] = [];
    for (const r of submitResults) {
      if (!r.ok) continue;
      const d = await r.json();
      const pollUrl = d.data?.urls?.get || `${WS_API_BASE}/predictions/${d.data?.id}/result`;
      if (d.data?.id) jobs.push(pollUrl);
    }

    // Poll until all complete (max 60s)
    const imageUrls: string[] = [];
    const start = Date.now();
    while (imageUrls.length < jobs.length && Date.now() - start < 60_000) {
      await new Promise((r) => setTimeout(r, 2000));
      for (const pollUrl of jobs) {
        if (imageUrls.length >= 4) break;
        try {
          const pr = await fetch(pollUrl, { headers: { Authorization: `Bearer ${wsKey}` } });
          if (!pr.ok) continue;
          const pd = await pr.json();
          const pred = pd.data || pd;
          if (pred.status === "completed" && pred.outputs?.length > 0) {
            for (const o of pred.outputs) {
              if (!imageUrls.includes(o)) imageUrls.push(o);
            }
          }
        } catch {}
      }
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "No images generated" }, { status: 503 });
    }

    // Convert to base64 and apply branding overlay via SVG
    const base64Images = await Promise.all(
      imageUrls.map(async (url: string) => {
        try {
          const imgRes = await fetch(url);
          if (!imgRes.ok) return url;
          const buffer = Buffer.from(await imgRes.arrayBuffer());

          // Apply branding overlay using the scraper service (ffmpeg)
          const brandedBuffer = await applyImageBranding(buffer);

          const contentType = "image/jpeg";
          return `data:${contentType};base64,${brandedBuffer.toString("base64")}`;
        } catch {
          // Fallback: return without branding
          try {
            const imgRes = await fetch(url);
            if (!imgRes.ok) return url;
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            return `data:image/jpeg;base64,${buffer.toString("base64")}`;
          } catch {
            return url;
          }
        }
      })
    );

    // Save to history (first image as preview)
    if (character && scenario) {
      saveMarketingImage({
        characterPresetId: character.id,
        scenarioPresetId: scenario.id,
        prompt,
        imageUrl: imageUrls[0],
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return NextResponse.json({
      images: base64Images,
      prompt,
      character: character?.name || "Custom",
      scenario: scenario?.name || "Custom",
      caption: scenario
        ? `${scenario.captionHook}\n\n${character?.name || "MBS Star"} ${scenario.emoji}\n\nMade with AI → ivideostudio.ai\n\n🔗 https://ivideostudio.ai\n\n${scenario.hashtags.join(" ")} #MzansiBabyStars #MBS #GenesisStudio #AIVideo #MadeWithAI`
        : undefined,
    });
  } catch (error) {
    console.error("[MARKETING-IMG] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
