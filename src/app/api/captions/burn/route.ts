import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// Map caption styles to auto-subtitle settings
const STYLE_PRESETS: Record<string, Record<string, unknown>> = {
  tiktok: {
    font: "Montserrat/Montserrat-ExtraBold.ttf",
    font_size: 90,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 4,
    highlight_color: "yellow",
    caption_position: "center",
    bounce: true,
    bg_color: null,
  },
  youtube: {
    font: "Roboto/Roboto-Bold.ttf",
    font_size: 60,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 2,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: "black",
    bg_opacity: 0.6,
  },
  cinematic: {
    font: "Playfair_Display/PlayfairDisplay-Italic-VariableFont_wght.ttf",
    font_size: 54,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 1,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: null,
  },
};

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

    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const { videoUrl, style, language } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    // Burning captions costs 5 credits (GPU-intensive video re-encoding)
    const creditCost = 5;
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditCost,
        "",
        `Burn captions: ${style || "tiktok"}`
      );

      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    try {
      const preset = STYLE_PRESETS[style] || STYLE_PRESETS.tiktok;

      const input: Record<string, unknown> = {
        video_url: videoUrl,
        font: preset.font,
        font_size: preset.font_size,
        font_color: preset.font_color,
        stroke_color: preset.stroke_color,
        stroke_width: preset.stroke_width,
        caption_position: preset.caption_position,
      };

      // Optional fields
      if (preset.highlight_color) input.highlight_color = preset.highlight_color;
      if (preset.bounce) input.bounce = true;
      if (preset.bg_color) {
        input.bg_color = preset.bg_color;
        if (preset.bg_opacity) input.bg_opacity = preset.bg_opacity;
      }
      if (language && language !== "auto") input.language = language;

      const result = await fal.queue.submit("fal-ai/workflow-utilities/auto-subtitle", {
        input: input as Record<string, unknown> & { video_url: string },
      });

      return NextResponse.json({
        jobId: result.request_id,
        status: "processing",
        estimatedTime: 60,
        creditsCost: creditCost,
      });
    } catch (gpuError) {
      console.error("Caption burn submission error:", gpuError);

      if (!ownerAccount) {
        await refundCredits(user.id, creditCost, "", "Caption burn failed — automatic refund");
      }

      const errorMsg = gpuError instanceof Error ? gpuError.message : "Unknown error";
      return NextResponse.json(
        { error: `Caption burn failed: ${errorMsg}. Credits refunded.` },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Caption burn API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
