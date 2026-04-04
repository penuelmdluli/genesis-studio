// ============================================
// GENESIS STUDIO — Public REST API v1
// API Key authenticated endpoint for developers
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/db";
import { createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { submitRunPodJob, buildRunPodInput } from "@/lib/runpod";
import { AI_MODELS, MODEL_ACCESS, BUILT_IN_AUDIO_TRACKS } from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { ModelId } from "@/types";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  try {
    // API Key authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing API key. Use: Authorization: Bearer gs_your_key" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyRecord = await validateApiKey(keyHash);

    if (!keyRecord) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    const user = keyRecord.users;
    const body = await req.json();

    // Validate required fields
    if (!body.prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const modelId = body.model || "ltx-video";
    const type = body.type || "t2v";
    const resolution = body.resolution || "720p";
    const duration = body.duration || 5;
    const fps = body.fps || 24;
    const isDraft = body.draft || false;

    // Validate model access (owners have access to all models)
    const ownerAccount = isOwnerClerkId(user.clerk_id);
    if (!ownerAccount) {
      const allowedModels = MODEL_ACCESS[user.plan] || MODEL_ACCESS.free;
      if (!allowedModels.includes(modelId)) {
        return NextResponse.json(
          { error: `Model ${modelId} not available on ${user.plan} plan` },
          { status: 403 }
        );
      }
    }

    const model = AI_MODELS[modelId as keyof typeof AI_MODELS];
    if (!model) {
      return NextResponse.json(
        { error: `Unknown model: ${modelId}. Available: ${Object.keys(AI_MODELS).join(", ")}` },
        { status: 400 }
      );
    }

    // Calculate credits
    const creditCost = estimateCreditCost(modelId, resolution, duration, isDraft);

    if (!ownerAccount) {
      const { success } = await deductCredits(
        user.id,
        creditCost,
        "",
        `API: ${model.name} ${resolution} ${duration}s`
      );

      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", credits_required: creditCost, credits_balance: user.credit_balance },
          { status: 402 }
        );
      }
    }

    // Resolve audio track
    const audioTrackId = body.audio_track_id;
    const audioTrack = audioTrackId
      ? BUILT_IN_AUDIO_TRACKS.find((t) => t.id === audioTrackId)
      : undefined;
    const aspectRatio = body.aspect_ratio || "landscape";

    // Create job
    const job = await createJob({
      userId: user.id,
      type,
      modelId: modelId as keyof typeof AI_MODELS,
      prompt: body.prompt,
      negativePrompt: body.negative_prompt,
      inputImageUrl: body.input_image_url,
      resolution,
      duration,
      fps,
      seed: body.seed,
      guidanceScale: body.guidance_scale,
      numInferenceSteps: body.num_inference_steps,
      isDraft,
      creditsCost: creditCost,
      aspectRatio,
      audioTrackId,
      audioUrl: audioTrack?.url,
    });

    // Submit to RunPod
    const runpodInput = buildRunPodInput({
      modelId: modelId as ModelId,
      type,
      prompt: body.prompt,
      negativePrompt: body.negative_prompt,
      inputImageUrl: body.input_image_url,
      resolution,
      duration,
      fps,
      seed: body.seed,
      guidanceScale: body.guidance_scale,
      numInferenceSteps: body.num_inference_steps,
      isDraft,
      aspectRatio,
    });

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/webhooks/runpod`;
    const runpodJob = await submitRunPodJob(
      modelId as keyof typeof AI_MODELS,
      runpodInput,
      webhookUrl
    );

    await updateJobStatus(job.id, { runpodJobId: runpodJob.id });

    return NextResponse.json({
      id: job.id,
      status: "queued",
      estimated_seconds: Math.round(model.avgGenerationTime * (isDraft ? 0.3 : 1)),
      credits_charged: creditCost,
      poll_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/status/${job.id}`,
    });
  } catch (error) {
    console.error("API v1 generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
