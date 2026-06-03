import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { submitRunPodJob, buildRunPodInput } from "@/lib/runpod";
import { submitFalJob } from "@/lib/fal";
import { AI_MODELS, MODEL_ACCESS, BUILT_IN_AUDIO_TRACKS } from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { isProfitable } from "@/lib/profitability";
import { generateSchema } from "@/lib/validation";
import { GenerateRequest, ModelId } from "@/types";
import { checkRateLimit } from "@/lib/fraud";
import { enforceDistributedRateLimit } from "@/lib/rate-limit";
import { recordProviderSuccess, recordProviderFailure } from "@/lib/vendor-failover";
import { sendSlackAlert } from "@/lib/alerts";

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

    // Rate limiting (in-memory per-instance)
    const rateCategory = user.plan === "free" ? "generate:free" : "generate:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating again.", resetAt: rateCheck.resetAt },
        { status: 429 }
      );
    }

    // Distributed rate limiting (Cloudflare KV — cross-instance, persists across cold starts)
    const distributedBlock = await enforceDistributedRateLimit(user.id, user.plan);
    if (distributedBlock) return distributedBlock;

    const rawBody = await req.json();
    const parsed = generateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const body = parsed.data;

    // Validate model access (owners have access to all models)
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedModels = MODEL_ACCESS[user.plan] || MODEL_ACCESS.free;
      if (!allowedModels.includes(body.modelId)) {
        return NextResponse.json(
          { error: "Model not available on your plan" },
          { status: 403 }
        );
      }
    }

    // Validate model exists and supports the generation type
    const model = AI_MODELS[body.modelId];
    if (!model) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }
    // Keep original type for model routing; use "i2v" for DB (constraint only allows t2v/i2v/v2v)
    const effectiveType = body.type;
    const dbType = body.type === "motion" ? "i2v" : body.type;
    if (!model.types.includes(effectiveType)) {
      return NextResponse.json(
        { error: `Model ${model.name} does not support ${body.type}` },
        { status: 400 }
      );
    }

    // Motion control requires both a reference video and a character image
    if (body.type === "motion") {
      if (!body.inputVideoUrl || !body.inputImageUrl) {
        return NextResponse.json(
          { error: "Motion control requires both a motion reference video and a character image" },
          { status: 400 }
        );
      }
    }

    // Calculate credit cost
    const resolution = body.resolution || "720p";
    const duration = body.duration || 8;
    const creditCost = estimateCreditCost(
      body.modelId,
      resolution,
      duration,
      body.isDraft || false
    );

    if (!ownerAccount) {
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
    }

    // Log profitability metrics
    const profit = isProfitable(creditCost, body.modelId, duration, resolution);
    if (!profit.profitable) {
      console.warn(`[MARGIN WARNING] ${body.modelId} ${resolution} ${duration}s: margin=${profit.margin}% gpuCost=$${profit.gpuCost} netRevenue=$${profit.netRevenue}`);
    }

    // Resolve audio track URL if selected
    const audioTrack = body.audioTrackId
      ? BUILT_IN_AUDIO_TRACKS.find((t) => t.id === body.audioTrackId)
      : undefined;

    // Create job record (use dbType for DB constraint compatibility — "motion" stored as "i2v")
    const job = await createJob({
      userId: user.id,
      type: dbType,
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

    // Route to the correct provider (FAL.AI or RunPod)
    // FAL auto-fallback: if FAL fails (balance exhausted, forbidden), retry on RunPod Wan 2.2
    let usedFallback = false;
    let actualModelId: string = body.modelId;
    try {
      if (model.provider === "fal") {
        // FAL.AI — premium models with native audio
        try {
          const falResult = await submitFalJob({
            modelId: body.modelId,
            type: effectiveType as "t2v" | "i2v",
            prompt: body.prompt,
            negativePrompt: body.negativePrompt,
            imageUrl: body.inputImageUrl,
            duration,
            aspectRatio: body.aspectRatio,
            enableAudio: body.enableAudio,
            seed: body.seed,
          });

          await updateJobStatus(job.id, {
            runpodJobId: falResult.request_id,
            status: "queued",
          });
        } catch (falError) {
          const falMsg = falError instanceof Error ? falError.message : String(falError);
          // Auto-fallback to RunPod Wan 2.2 on FAL billing/auth errors
          if (falMsg.includes("Forbidden") || falMsg.includes("locked") || falMsg.includes("balance") || falMsg.includes("403")) {
            console.warn(`[FAL_FALLBACK] ${body.modelId} failed (${falMsg}), falling back to wan-2.2`);
            usedFallback = true;
            actualModelId = "wan-2.2" as ModelId;
            // Fall through to RunPod block below
          } else {
            throw falError; // Re-throw non-billing errors
          }
        }
      }

      if (model.provider !== "fal" || usedFallback) {
        // RunPod — open-source models (or FAL fallback)
        const runpodInput = buildRunPodInput({
          modelId: actualModelId as ModelId,
          type: effectiveType,
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

        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const webhookUrl = `${appUrl}/api/webhooks/runpod`;

        const runpodJob = await submitRunPodJob(
          actualModelId as ModelId,
          runpodInput,
          webhookUrl,
          effectiveType
        );

        await updateJobStatus(job.id, {
          runpodJobId: runpodJob.id,
          status: "queued",
        });
      }

      // Track provider success
      recordProviderSuccess(model.provider === "fal" ? "fal" : "runpod");

      sendSlackAlert({
        level: "info",
        title: "Video generation started",
        message: `User: ${user.name} (${user.email})\nModel: ${model.name} | ${body.duration}s | ${creditCost} credits`,
      }).catch(() => {});

      const fallbackModel = usedFallback ? AI_MODELS[actualModelId as ModelId] : null;
      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        estimatedTime: (fallbackModel || model).avgGenerationTime * (body.isDraft ? 0.3 : 1),
        creditsCost: creditCost,
        ...(usedFallback && { fallbackModel: fallbackModel?.name, fallbackNote: `${model.name} is temporarily unavailable. Routed to ${fallbackModel?.name} instead.` }),
      });
    } catch (gpuError) {
      console.error("GPU submission error:", gpuError);

      // Track provider failure
      const provider = model.provider === "fal" ? "fal" : "runpod";
      const errorMsg = gpuError instanceof Error ? gpuError.message : "Unknown GPU error";
      recordProviderFailure(provider as "fal" | "runpod", errorMsg);

      sendSlackAlert({
        level: "warning",
        title: "Video generation failed",
        message: `User: ${user.name} (${user.email})\nModel: ${model.name}\nError: ${errorMsg}\nCredits refunded: ${creditCost}`,
      }).catch(() => {});

      const { refundCredits } = await import("@/lib/credits");
      await refundCredits(
        user.id,
        creditCost,
        job.id,
        "GPU submission failed — automatic refund"
      );

      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: `Submission failed: ${errorMsg}. Credits refunded.`,
      });

      return NextResponse.json(
        {
          error: `${model.name} submission failed. Credits refunded.`,
          jobId: job.id,
        },
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
