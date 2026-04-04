import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits } from "@/lib/credits";
import { submitRunPodJob, buildRunPodInput } from "@/lib/runpod";
import { AI_MODELS, MODEL_ACCESS, BUILT_IN_AUDIO_TRACKS } from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { GenerateRequest, ModelId } from "@/types";

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

    const body: GenerateRequest = await req.json();

    // Validate model access
    const allowedModels = MODEL_ACCESS[user.plan] || MODEL_ACCESS.free;
    if (!allowedModels.includes(body.modelId)) {
      return NextResponse.json(
        { error: "Model not available on your plan" },
        { status: 403 }
      );
    }

    // Validate model exists and supports the generation type
    const model = AI_MODELS[body.modelId];
    if (!model) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }
    if (!model.types.includes(body.type)) {
      return NextResponse.json(
        { error: `Model ${model.name} does not support ${body.type}` },
        { status: 400 }
      );
    }

    // Calculate credit cost
    const resolution = body.resolution || "720p";
    const duration = body.duration || 5;
    const creditCost = estimateCreditCost(
      body.modelId,
      resolution,
      duration,
      body.isDraft || false
    );

    // Deduct credits
    const { success, newBalance } = await deductCredits(
      user.id,
      creditCost,
      "", // job ID will be updated after job creation
      `Video generation: ${model.name} ${resolution} ${duration}s`
    );

    if (!success) {
      return NextResponse.json(
        { error: "Insufficient credits", required: creditCost, balance: newBalance },
        { status: 402 }
      );
    }

    // Resolve audio track URL if selected
    const audioTrack = body.audioTrackId
      ? BUILT_IN_AUDIO_TRACKS.find((t) => t.id === body.audioTrackId)
      : undefined;

    // Create job record
    const job = await createJob({
      userId: user.id,
      type: body.type,
      modelId: body.modelId,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      inputImageUrl: body.inputImageUrl,
      inputVideoUrl: body.inputVideoUrl,
      resolution,
      duration,
      fps: body.fps || 24,
      seed: body.seed,
      guidanceScale: body.guidanceScale,
      numInferenceSteps: body.numInferenceSteps,
      isDraft: body.isDraft || false,
      creditsCost: creditCost,
      aspectRatio: body.aspectRatio,
      audioTrackId: body.audioTrackId,
      audioUrl: audioTrack?.url,
    });

    // Build RunPod input (model-specific schema)
    const runpodInput = buildRunPodInput({
      modelId: body.modelId,
      type: body.type,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      inputImageUrl: body.inputImageUrl,
      inputVideoUrl: body.inputVideoUrl,
      resolution,
      duration,
      fps: body.fps || 24,
      seed: body.seed,
      guidanceScale: body.guidanceScale,
      numInferenceSteps: body.numInferenceSteps,
      isDraft: body.isDraft,
      aspectRatio: body.aspectRatio,
    });

    // Submit to RunPod — use server-side URL for webhook (not NEXT_PUBLIC_ which may be localhost)
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/webhooks/runpod`;

    try {
      const runpodJob = await submitRunPodJob(
        body.modelId,
        runpodInput,
        webhookUrl
      );

      await updateJobStatus(job.id, {
        runpodJobId: runpodJob.id,
        status: "queued",
      });

      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        estimatedTime: model.avgGenerationTime * (body.isDraft ? 0.3 : 1),
        creditsCost: creditCost,
      });
    } catch (gpuError) {
      // If RunPod submission fails, refund credits
      const { refundCredits } = await import("@/lib/credits");
      await refundCredits(
        user.id,
        creditCost,
        job.id,
        "GPU submission failed — automatic refund"
      );

      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: "Failed to submit to GPU. Credits refunded.",
      });

      return NextResponse.json(
        { error: "GPU submission failed. Credits refunded.", jobId: job.id },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
