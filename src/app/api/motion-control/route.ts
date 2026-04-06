import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
    const {
      characterImageUrl,
      referenceVideoUrl,
      effect,
      prompt,
      quality = "standard",
      model = "kling-v3",
      orientation = "video",
      duration = 10,
      enableAudio = false,
      keepOriginalSound = false,
      seed,
    } = body as {
      characterImageUrl: string;
      referenceVideoUrl?: string;
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

    // Validate inputs
    if (!characterImageUrl) {
      return NextResponse.json({ error: "Character image is required" }, { status: 400 });
    }
    if (!referenceVideoUrl && !effect) {
      return NextResponse.json(
        { error: "Either a reference video or a fun effect is required" },
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
          { error: "Insufficient credits", required: creditCost },
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

    try {
      const result = await submitMotionControlJob({
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

      // Store FAL request ID and endpoint for polling
      await updateJobStatus(job.id, {
        runpodJobId: `fal:${result.endpoint}:${result.requestId}`,
        status: "queued",
      });

      return NextResponse.json({
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

      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: submitErr instanceof Error ? submitErr.message : "Submission failed",
      });

      return NextResponse.json(
        { error: "Motion control submission failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Motion control error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
