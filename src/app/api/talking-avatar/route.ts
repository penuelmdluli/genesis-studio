import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

const FAL_AVATAR_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

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
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const { imageUrl, text, audioUrl, voiceId, duration, language } = body as {
      imageUrl: string;
      text?: string;
      audioUrl?: string;
      voiceId?: string;
      duration?: number;
      language?: string;
    };

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Face image is required" },
        { status: 400 }
      );
    }

    if (!text && !audioUrl) {
      return NextResponse.json(
        { error: "Either text script or audio file is required" },
        { status: 400 }
      );
    }

    // Plan check: must be creator+, or owner
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedPlans = ["creator", "pro", "studio"];
      if (!allowedPlans.includes(user.plan)) {
        return NextResponse.json(
          { error: "Talking Avatar requires a Creator or higher plan" },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost: 15 credits per 10 seconds
    const effectiveDuration = duration || 10;
    const creditsCost = Math.ceil(effectiveDuration / 10) * 15;

    // Deduct credits (owners skip)
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Talking Avatar: ${effectiveDuration}s ${language || "en"}`
      );

      if (!success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditsCost,
            balance: newBalance,
          },
          { status: 402 }
        );
      }
    }

    // Check FAL key
    if (!process.env.FAL_KEY) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Talking Avatar service not configured — automatic refund");
      }
      return NextResponse.json(
        { error: "Talking Avatar is temporarily unavailable. Credits have been refunded." },
        { status: 503 }
      );
    }

    try {
      // Build a talking-head prompt from the text/audio input
      const avatarPrompt = text
        ? `A person talking and expressing: "${text.slice(0, 200)}". Natural head movement, lip sync, expressive facial gestures.`
        : "A person talking naturally with expressive facial movement and gestures, lip syncing to audio.";

      // Submit to FAL.AI Kling i2v with the face image
      const result = await fal.queue.submit(FAL_AVATAR_MODEL, {
        input: {
          prompt: avatarPrompt,
          image_url: imageUrl,
          duration: String(Math.min(effectiveDuration, 10)),
          aspect_ratio: "16:9",
          native_audio: true,
        },
      });

      const jobId = result.request_id;

      return NextResponse.json({
        jobId: `fal:${FAL_AVATAR_MODEL}:${jobId}`,
        creditsCost,
        estimatedTime: Math.ceil(effectiveDuration / 10) * 60,
      });
    } catch (gpuError) {
      console.error("Talking Avatar FAL error:", gpuError);

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Talking Avatar submission failed — automatic refund"
        );
      }

      return NextResponse.json(
        { error: "Submission failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Talking Avatar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
