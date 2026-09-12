import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { submitWsModel, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError } from "@/lib/user-errors";

// Video → transcript with timestamps → SRT. The job id returned is the
// provider prediction id; /api/captions/[jobId] polls it and formats the
// result. Transcription is cheap (~$0.001), so the credit price is a
// convenience fee rather than a margin play — captions are what make a
// Reel watchable on mute, and we want every video to have them.

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
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
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const { videoUrl, language } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string" || !/^https:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const creditCost = 2;
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, creditCost, "", `Auto captions: ${language || "auto"}`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditCost, balance: newBalance }, { status: 402 });
      }
    }

    try {
      const prediction = await submitWsModel(WS_MODELS.transcribeVideo, {
        video: videoUrl,
        task: "transcribe",
        enable_timestamps: true,
        language: language && language !== "auto" ? language : "auto",
      });

      return NextResponse.json({
        jobId: prediction.id,
        status: "processing",
        estimatedTime: 30,
      });
    } catch (gpuError) {
      const raw = gpuError instanceof Error ? gpuError.message : String(gpuError);
      console.error("Caption submission error:", raw);

      if (!ownerAccount) {
        await refundCredits(user.id, creditCost, "", "Caption submission failed — automatic refund");
      }

      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("Captions API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
