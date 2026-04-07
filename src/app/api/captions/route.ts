import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

// Ensure FAL client is configured
fal.config({ credentials: process.env.FAL_KEY || "" });

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

    const { videoUrl, language } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    // Calculate credits: 2 per minute, minimum 2
    const creditCost = 2;

    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditCost,
        "",
        `Auto captions: ${language || "en"}`
      );

      if (!success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditCost,
            balance: newBalance,
          },
          { status: 402 }
        );
      }
    }

    // Submit to FAL Whisper (same engine as Brain Studio subtitles)
    try {
      const result = await fal.queue.submit("fal-ai/whisper", {
        input: {
          audio_url: videoUrl,
          task: "transcribe",
          chunk_level: "segment",
          language: language && language !== "auto" ? language : undefined,
        },
      });

      return NextResponse.json({
        jobId: result.request_id,
        status: "processing",
        estimatedTime: 30,
      });
    } catch (gpuError) {
      console.error("Caption FAL submission error:", gpuError);

      // Refund credits on submission failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditCost,
          "",
          "Caption submission failed — automatic refund"
        );
      }

      const errorMsg =
        gpuError instanceof Error ? gpuError.message : "Unknown error";

      return NextResponse.json(
        { error: `Caption processing failed: ${errorMsg}. Credits refunded.` },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Captions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
