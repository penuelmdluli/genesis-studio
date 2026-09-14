import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { envString } from "@/lib/env";
import { submitWsModel, wsJobRef, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError } from "@/lib/user-errors";

// Video upscale to 1080p / 4K. Creates a job row with a "ws:" reference, so
// the page polls /api/jobs/[id] and the finished file lands in the gallery
// like any other video.
//
// Was fal-ai/creative-upscaler — an IMAGE upscaler being fed a video URL, on
// a provider that has been locked for months. Frame interpolation had no
// backend at all and is no longer offered.

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

    const { videoUrl, targetResolution, videoDuration } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string" || !/^https:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }
    if (!targetResolution || !["1080p", "4k"].includes(targetResolution)) {
      return NextResponse.json({ error: "targetResolution must be '1080p' or '4k'" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const planOrder = ["free", "creator", "pro", "studio"];
      const userPlanIdx = planOrder.indexOf(user.plan);
      if (userPlanIdx < 1) {
        return NextResponse.json({ error: "Video upscaling requires a Creator+ plan." }, { status: 403 });
      }
      if (targetResolution === "4k" && userPlanIdx < 2) {
        return NextResponse.json({ error: "4K upscaling requires a Pro+ plan." }, { status: 403 });
      }
    }

    // 20 credits per 5 seconds (provider ≈ $0.007/s; 4K roughly double).
    const seconds = Math.max(1, Math.min(Number(videoDuration) || 5, 180));
    const creditsCost = Math.ceil(seconds / 5) * (targetResolution === "4k" ? 30 : 20);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, creditsCost, "", `Video upscale: ${targetResolution}`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    if (!envString("WAVESPEED_API_KEY")) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Refund: Video Upscaler not configured");
      }
      return NextResponse.json({ error: "Video Upscaler is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    try {
      const job = await createJob({
        userId: user.id,
        type: "v2v",
        modelId: "wan-2.2",
        prompt: `Upscaled to ${targetResolution.toUpperCase()}`,
        inputVideoUrl: videoUrl,
        resolution: targetResolution === "4k" ? "4k" : "1080p",
        duration: seconds,
        fps: 30,
        isDraft: false,
        creditsCost: ownerAccount ? 0 : creditsCost,
        aspectRatio: "landscape",
      });

      const prediction = await submitWsModel(WS_MODELS.videoUpscale, {
        video: videoUrl,
        target_resolution: targetResolution === "4k" ? "4k" : "1080p",
      });

      await updateJobStatus(job.id, {
        runpodJobId: wsJobRef(prediction.id),
        status: "processing",
        provider: "wavespeed",
        startedAt: new Date().toISOString(),
      });

      const estimatedTime = targetResolution === "4k" ? Math.ceil(seconds * 8) : Math.ceil(seconds * 4);
      return NextResponse.json({ jobId: job.id, creditsCost, estimatedTime });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error("[UPSCALE] submission failed:", raw);
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Refund: Upscale job submission failed");
      }
      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (err) {
    console.error("[UPSCALE] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
