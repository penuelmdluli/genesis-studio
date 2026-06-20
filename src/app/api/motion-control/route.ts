import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId, refundCredits } from "@/lib/credits";
import {
  submitMotionControlJob,
  estimateMotionCost,
  type MotionQuality,
  type MotionModel,
  type MotionOrientation,
} from "@/lib/motion-control";
import { checkRateLimit } from "@/lib/fraud";
import { downloadVideoFromUrl } from "@/lib/video-downloader";

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

    // Rate limiting
    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const {
      characterImageUrl,
      referenceVideoUrl: rawReferenceVideoUrl,
      referenceUrl,
      effect,
      prompt,
      quality = "standard",
      model = "kling-v3",
      orientation = "video",
      duration = 10,
      enableAudio = false,
      keepOriginalSound = true,
      seed,
    } = body as {
      characterImageUrl: string;
      referenceVideoUrl?: string;
      referenceUrl?: string;
      effect?: string;
      prompt?: string;
      quality?: MotionQuality;
      model?: MotionModel;
      orientation?: MotionOrientation;
      duration?: number;
      enableAudio?: boolean;
      keepOriginalSound?: boolean;
      seed?: number;
    };

    let referenceVideoUrl = rawReferenceVideoUrl;

    // Validate inputs
    if (!characterImageUrl) {
      return NextResponse.json(
        { success: false, error: "Character image is required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // Reject YouTube URLs
    if (referenceUrl && /(?:youtube\.com|youtu\.be)\//i.test(referenceUrl)) {
      return NextResponse.json(
        { success: false, error: "YouTube URLs are not supported. Please use TikTok, Instagram, or upload a video directly.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // Prompt-only mode: if no reference video/URL/effect but prompt is provided,
    // we'll use a standard i2v model (image + prompt → video) instead of motion transfer
    const isPromptOnlyMode = !referenceVideoUrl && !referenceUrl && !effect;
    if (isPromptOnlyMode && !prompt) {
      return NextResponse.json(
        { success: false, error: "Please provide a reference video, an effect, or describe the motion you want.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // Calculate credits
    const { credits: creditCost } = estimateMotionCost(quality, duration);
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success } = await deductCredits(
        user.id,
        creditCost,
        "",
        `Motion control: ${effect || "custom"} ${duration}s ${quality}`
      );
      if (!success) {
        return NextResponse.json(
          { success: false, error: "Insufficient credits", code: "INSUFFICIENT_CREDITS", required: creditCost },
          { status: 402 }
        );
      }
    }

    // Create job record
    const job = await createJob({
      userId: user.id,
      type: "i2v", // DB constraint: motion stored as i2v
      modelId: "mimic-motion", // closest existing model ID for DB
      prompt: prompt || `Motion control: ${effect || "custom reference"}`,
      inputImageUrl: characterImageUrl,
      inputVideoUrl: referenceVideoUrl,
      resolution: "720p",
      duration,
      fps: 24,
      seed,
      isDraft: false,
      creditsCost: creditCost,
      aspectRatio: "landscape",
    });

    // Download social media video if referenceUrl provided but no direct upload
    if (referenceUrl && !referenceVideoUrl) {
      try {
        const downloaded = await downloadVideoFromUrl(referenceUrl, user.id, job.id);
        referenceVideoUrl = downloaded.publicUrl;
      } catch (primaryErr) {
        console.warn("[Motion] Primary video download failed, trying scraper fallback:", primaryErr);
        try {
          const { downloadAndPersist } = await import("@/lib/mbs/scraper");
          const { r2Key } = await downloadAndPersist(referenceUrl);
          referenceVideoUrl = `${process.env.R2_PUBLIC_URL || "https://cdn.ivideostudio.ai"}/${r2Key}`;
        } catch {
          if (!ownerAccount) {
            await refundCredits(user.id, creditCost, job.id, "Failed to download reference video — automatic refund");
          }
          await updateJobStatus(job.id, { status: "failed", errorMessage: "Could not download video from the provided URL" });
          return NextResponse.json(
            { success: false, error: "Could not download video from the provided URL. Please upload the video directly or try a different link.", code: "GENERATION_FAILED" },
            { status: 422 }
          );
        }
      }
    }

    try {
      let result: { requestId: string; endpoint: string };

      if (isPromptOnlyMode) {
        // Prompt-only mode: use standard i2v (image + prompt → video)
        const { fal } = await import("@fal-ai/client");
        fal.config({ credentials: process.env.FAL_KEY || "" });
        const i2vEndpoint = quality === "pro"
          ? "fal-ai/kling-video/v3/pro/image-to-video"
          : "fal-ai/kling-video/v3/standard/image-to-video";
        const falResult = await fal.queue.submit(i2vEndpoint, {
          input: {
            image_url: characterImageUrl,
            prompt: prompt || "gentle natural movement",
            duration: String(duration),
            aspect_ratio: orientation === "image" ? "9:16" : "16:9",
            ...(seed !== undefined && seed >= 0 ? { seed } : {}),
            ...(enableAudio ? { native_audio: true } : {}),
          },
        });
        result = { requestId: falResult.request_id, endpoint: i2vEndpoint };
      } else {
        // Motion control mode: transfer motion from reference video/effect
        result = await submitMotionControlJob({
          characterImageUrl,
          referenceVideoUrl,
          effect,
          prompt,
          quality,
          model,
          orientation,
          duration,
          enableAudio,
          keepOriginalSound,
          seed,
        });
      }

      // Store FAL request ID and endpoint for polling
      await updateJobStatus(job.id, {
        runpodJobId: `fal:${result.endpoint}:${result.requestId}`,
        status: "queued",
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: "queued",
        estimatedTime: duration * 12, // rough estimate
        creditsCost: creditCost,
      });
    } catch (submitErr) {
      console.error("Motion control submission error:", submitErr);

      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditCost,
          job.id,
          "Motion control submission failed — automatic refund"
        );
      }

      const errMsg = submitErr instanceof Error ? submitErr.message : "Submission failed";
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: `${errMsg}. Credits have been refunded.`,
      });

      return NextResponse.json(
        { success: false, error: "Motion control submission failed. Credits refunded.", code: "GENERATION_FAILED" },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Motion control error:", error);
    return NextResponse.json({ success: false, error: "Internal server error", code: "GENERATION_FAILED" }, { status: 500 });
  }
}
