import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";

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
        { error: "Auto Captions coming soon" },
        { status: 503 }
      );
    }

    // Calculate credits: 2 per minute, minimum 2
    // For URL-based submissions, estimate 1 minute minimum; actual duration
    // would be determined server-side by the transcription worker
    const estimatedMinutes = 1;
    const creditCost = Math.max(estimatedMinutes * 2, 2);

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

      const runpodRes = await fetch(`${captionsEndpoint}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({
          input: {
            audio_url: videoUrl,
            language: language || "en",
            word_timestamps: true,
          },
          webhook: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/runpod`,
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
