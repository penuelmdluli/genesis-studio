import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

const FAL_UPSCALE_MODEL = "fal-ai/creative-upscaler";

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

    const { videoUrl, targetResolution, frameInterpolation, videoDuration } =
      await req.json();

    // Validate required fields
    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    if (!targetResolution || !["1080p", "4k"].includes(targetResolution)) {
      return NextResponse.json(
        { error: "targetResolution must be '1080p' or '4k'" },
        { status: 400 }
      );
    }

    // Plan gating
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const planOrder = ["free", "creator", "pro", "studio"];
      const userPlanIdx = planOrder.indexOf(user.plan);

      // Creator+ required for 1080p
      if (userPlanIdx < 1) {
        return NextResponse.json(
          { error: "Video upscaling requires a Creator+ plan." },
          { status: 403 }
        );
      }

      // Pro+ required for 4K
      if (targetResolution === "4k" && userPlanIdx < 2) {
        return NextResponse.json(
          { error: "4K upscaling requires a Pro+ plan." },
          { status: 403 }
        );
      }

      // Studio required for frame interpolation
      if (
        frameInterpolation &&
        frameInterpolation !== "none" &&
        userPlanIdx < 3
      ) {
        return NextResponse.json(
          { error: "Frame interpolation requires a Studio plan." },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost: 5 credits per 5 seconds of video
    const creditsCost = Math.ceil((videoDuration || 5) / 5) * 5;

    // Deduct credits (skip for owners)
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Video upscale: ${targetResolution}${frameInterpolation && frameInterpolation !== "none" ? ` + ${frameInterpolation}` : ""}`
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
        await refundCredits(user.id, creditsCost, "", "Refund: Video Upscaler not configured");
      }
      return NextResponse.json(
        { error: "Video Upscaler is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    let jobId: string;

    try {
      // Determine scale factor based on target resolution
      const scale = targetResolution === "4k" ? 4 : 2;

      // Submit to FAL.AI upscaler
      const result = await fal.queue.submit(FAL_UPSCALE_MODEL, {
        input: {
          image_url: videoUrl,
          scale,
          creativity: 0.3,
          detail: 1,
          shape_preservation: 0.5,
        },
      });

      jobId = `fal:${FAL_UPSCALE_MODEL}:${result.request_id}`;
    } catch (err) {
      console.error("[UPSCALE] FAL submission failed:", err);

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Refund: Upscale job submission failed");
      }

      return NextResponse.json(
        { error: "Failed to start upscaling job. Credits have been refunded." },
        { status: 500 }
      );
    }

    // Estimate processing time (seconds)
    const estimatedTime =
      targetResolution === "4k"
        ? Math.ceil((videoDuration || 5) * 8)
        : Math.ceil((videoDuration || 5) * 4);

    return NextResponse.json({
      jobId,
      creditsCost,
      estimatedTime,
    });
  } catch (err) {
    console.error("[UPSCALE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
