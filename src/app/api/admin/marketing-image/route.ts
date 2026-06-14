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
import {
  SA_CHARACTER_PRESETS,
  SCENARIO_PRESETS,
  buildOwnerImagePrompt,
  saveMarketingImage,
  getMarketingImageHistory,
} from "@/lib/owner-marketing";

const FAL_API_KEY = process.env.FAL_KEY || "";

// ── Quality boosters appended to every prompt ──
const QUALITY_SUFFIX =
  "masterpiece, award-winning photography, ultra sharp focus, professional studio lighting, " +
  "8K UHD, hyperrealistic, photorealistic skin texture, natural subsurface scattering, " +
  "ray tracing, volumetric lighting, cinematic color grading, shallow depth of field, " +
  "shot on Sony A7R V with 85mm f/1.4 GM lens";

const NEGATIVE_PROMPT =
  "cartoon, anime, illustration, painting, drawing, sketch, blurry, low quality, " +
  "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, disfigured, " +
  "watermark, text overlay, logo overlay, stock photo watermark";

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

    // Generate with FLUX Pro — portrait format, 4 options
    const falRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: { width: 768, height: 1360 },
        num_images: 4,
        enable_safety_checker: true,
        output_format: "jpeg",
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("[MARKETING-IMG] FAL error:", errText.slice(0, 300));
      return NextResponse.json({ error: "Image generation failed" }, { status: 503 });
    }

    const result = await falRes.json();
    const imageUrls: string[] =
      result.images?.map((img: { url: string }) => img.url) || [];

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "No images generated" }, { status: 503 });
    }

    // Convert to base64 to avoid CORS issues
    const base64Images = await Promise.all(
      imageUrls.map(async (url: string) => {
        try {
          const imgRes = await fetch(url);
          if (!imgRes.ok) return url;
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          return `data:${contentType};base64,${buffer.toString("base64")}`;
        } catch {
          return url;
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
