import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a world-class advertising creative director and copywriter. Your job is to generate compelling ad copy and a scene-by-scene breakdown for product video ads.

RULES:
1. Return ONLY valid JSON — no markdown, no backticks, no explanation.
2. Each scene should have a clear visual motion prompt suitable for AI video generation (image-to-video).
3. Motion prompts should describe camera movement, product interaction, and visual effects — NOT text overlays.
4. Headlines should be punchy, short (max 6 words), and attention-grabbing.
5. Subtexts should be optional supporting details (max 12 words).
6. Scene durations should add up to approximately the requested total duration.
7. Use the tone and platform to inform style (e.g., TikTok = fast cuts, YouTube = more cinematic).
8. imageIndex refers to which product image (0-indexed) to use for that scene's video generation.

OUTPUT FORMAT (strict JSON):
{
  "scenes": [
    {
      "label": "Scene 1 - Hook",
      "duration": 5,
      "textOverlay": {
        "headline": "Short Punchy Text",
        "subtext": "Optional supporting line"
      },
      "motionPrompt": "Cinematic slow-motion camera orbit around the product, dramatic studio lighting, shallow depth of field, premium feel",
      "imageIndex": 0
    }
  ]
}

SCENE STRUCTURE GUIDELINES:
- Scene 1: Hook/attention grabber (use most striking product image)
- Middle scenes: Feature highlights, benefits, use cases
- Final scene: CTA with urgency

PLATFORM STYLES:
- tiktok/reels: Fast cuts (3-5s scenes), trendy, bold text, vertical energy
- youtube: Cinematic (5-10s scenes), polished, story-driven
- twitter/x: Punchy (3-5s scenes), minimal text, impactful visuals
- linkedin: Professional (5-7s scenes), clean, authoritative
- general: Balanced (5s scenes), versatile`;

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting
    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      productName,
      productDescription,
      features,
      price,
      cta,
      template,
      platform,
      tone,
      duration,
    } = body as {
      productName: string;
      productDescription?: string;
      features?: string[];
      price?: string;
      cta?: string;
      template: string;
      platform: string;
      tone: string;
      duration: number;
    };

    // Validate required fields
    if (!productName) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }
    if (!template || !platform || !tone || !duration) {
      return NextResponse.json({ error: "Template, platform, tone, and duration are required" }, { status: 400 });
    }

    // Credit cost: 2 credits for AI copy generation
    const creditsCost = 2;
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Product Ad Copy: ${productName}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // Budget check
    const budgetCheck = checkBudget("claude:chat");
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: "AI service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    // Build the user prompt
    const userPrompt = [
      `Generate a ${duration}-second video ad scene breakdown for:`,
      ``,
      `Product: ${productName}`,
      productDescription ? `Description: ${productDescription}` : null,
      features && features.length > 0 ? `Key Features: ${features.join(", ")}` : null,
      price ? `Price: ${price}` : null,
      cta ? `CTA: ${cta}` : null,
      ``,
      `Template style: ${template}`,
      `Platform: ${platform}`,
      `Tone: ${tone}`,
      `Total duration: ${duration} seconds`,
      ``,
      `Create scenes that add up to ~${duration}s total. Each scene duration should be either 5 or 10 seconds.`,
      `Use imageIndex 0 for the primary product image. If you want variety, you can reference imageIndex 1 or 2 (if available).`,
    ]
      .filter(Boolean)
      .join("\n");

    console.log(`[PRODUCT-ADS] Generating ad copy for: ${productName} (${platform}, ${tone}, ${duration}s)`);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    recordApiCall("claude:chat");

    if (!res.ok) {
      console.error(`[PRODUCT-ADS] Anthropic API error: ${res.status}`);
      return NextResponse.json(
        { error: "AI generation failed. Please try again." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text || "";

    console.log(`[PRODUCT-ADS] Raw AI response length: ${rawText.length}`);

    // Parse JSON from Claude's response (handle potential markdown wrapping)
    let scenes;
    try {
      // Try direct parse first
      const parsed = JSON.parse(rawText);
      scenes = parsed.scenes;
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        scenes = parsed.scenes;
      } else {
        console.error("[PRODUCT-ADS] Failed to parse AI response as JSON:", rawText.slice(0, 200));
        return NextResponse.json(
          { error: "AI returned invalid format. Please try again." },
          { status: 502 }
        );
      }
    }

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "AI generated empty scene list. Please try again." },
        { status: 502 }
      );
    }

    console.log(`[PRODUCT-ADS] Generated ${scenes.length} scenes for "${productName}"`);

    return NextResponse.json({ scenes, creditsCost });
  } catch (error) {
    console.error("[PRODUCT-ADS] Generate copy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
