import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";

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

    const { videoUrl, language, style } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    // Check if captions endpoint is configured
    const captionsEndpoint = process.env.RUNPOD_ENDPOINT_CAPTIONS;
    if (!captionsEndpoint) {
      return NextResponse.json(
        { error: "Auto Captions is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // Calculate credits: 10 per minute, minimum 10
    // Whisper GPU costs ~$0.05/min → 10 credits ($0.24) = 4.8x markup
    const estimatedMinutes = 1;
    const creditCost = Math.max(estimatedMinutes * 10, 10);

    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditCost,
        "", // no job ID yet
        `Auto captions: ${language || "en"} / ${style || "tiktok"}`
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

    // Submit to RunPod captions endpoint (direct fetch, not model-based)
    try {
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (!runpodApiKey) {
        throw new Error("RunPod API key not configured");
      }

      const runpodRes = await fetch(`https://api.runpod.ai/v2/${captionsEndpoint}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({
          input: {
            audio: videoUrl,
            model: "large-v3",
            transcription: "srt",
            translate: false,
            language: language || null,
            word_timestamps: true,
          },
        }),
      });

      if (!runpodRes.ok) {
        const errText = await runpodRes.text();
        throw new Error(`RunPod request failed: ${runpodRes.status} ${errText}`);
      }

      const runpodData = await runpodRes.json();

      return NextResponse.json({
        jobId: runpodData.id,
        status: "processing",
        estimatedTime: 30,
      });
    } catch (gpuError) {
      console.error("Caption GPU submission error:", gpuError);

      // Refund credits on submission failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditCost,
          "",
          "Caption GPU submission failed — automatic refund"
        );
      }

      const errorMsg =
        gpuError instanceof Error ? gpuError.message : "Unknown GPU error";

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
