import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { submitRunPodJob, buildRunPodInput } from "@/lib/runpod";
import { submitFalJob } from "@/lib/fal";
import { submitVideoJob } from "@/lib/provider-router";
import { AI_MODELS, MODEL_ACCESS, BUILT_IN_AUDIO_TRACKS } from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { isProfitable } from "@/lib/profitability";
import { generateSchema } from "@/lib/validation";
import { GenerateRequest, ModelId } from "@/types";
import { checkRateLimit } from "@/lib/fraud";
import { modelAvailability, durationProblem } from "@/lib/config";
import { holdCredits, attachHoldToJob, releaseHold } from "@/lib/credit-escrow";
import { enforceDistributedRateLimit } from "@/lib/rate-limit";
import { recordProviderSuccess, recordProviderFailure } from "@/lib/vendor-failover";
import { sendSlackAlert } from "@/lib/alerts";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";

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

    // Standard Idempotency-Key header. A client that sends one is protected
    // from double-charging on retries; one that does not is no worse off than
    // before.
    const idempotencyKey = req.headers.get("idempotency-key")?.slice(0, 200) || "";

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

    // Refuse an unrunnable model BEFORE taking credits. Production has
    // charged users and then discovered the config was missing — three
    // cogvideo-x jobs died on "No GPU endpoint configured", one ai-singer job
    // on "RUNPOD_ENDPOINT_ACE_STEP not configured". Both debited first.
    const availability = modelAvailability(body.modelId, effectiveType);
    if (!availability.runnable) {
      console.warn(`[GENERATE] ${body.modelId} unavailable: ${availability.detail}`);
      return NextResponse.json(
        { error: availability.reason || "That model is unavailable right now.", code: "MODEL_UNAVAILABLE" },
        { status: 503 }
      );
    }

    // The provider rejects some durations outright. Catching it here means
    // the user is told which lengths work instead of being charged and then
    // shown an error naming a vendor their model does not use.
    const durationIssue = durationProblem(body.modelId, duration);
    if (durationIssue) {
      return NextResponse.json(
        { error: durationIssue, code: "INVALID_DURATION" },
        { status: 400 }
      );
    }

    // Reserve credits rather than spending them. The hold is settled only if
    // the provider accepts the job, and released on any failure — so a job
    // that never runs cannot leave the user charged. This replaces a debit
    // that was written before the job row existed, with jobId "" and a
    // comment promising to fill it in later that never happened.
    let holdId: string | null = null;
    if (!ownerAccount) {
      const held = await holdCredits({
        userId: user.id,
        amount: creditCost,
        description: `Video generation: ${model.name} ${resolution} ${duration}s`,
        // A double-click, a retry or a flaky connection must not create two
        // jobs and two charges. Callers that send no key get no protection,
        // which is the previous behaviour rather than a regression.
        idempotencyKey: idempotencyKey || undefined,
      });

      if (!held.ok) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditCost, balance: held.balance },
          { status: 402 }
        );
      }

      // A reused hold means this exact request already went through. Return
      // the job it created instead of starting a second one.
      if (held.reused && held.hold?.jobId) {
        return NextResponse.json({
          jobId: held.hold.jobId,
          status: "queued",
          estimatedTime: model.avgGenerationTime * (body.isDraft ? 0.3 : 1),
          creditsCost: creditCost,
          duplicate: true,
        });
      }

      holdId = held.hold?.id ?? null;
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

    // Bind the reservation to the job the moment the row exists. Until this
    // runs the hold is orphaned, which is why releaseOrphanedHolds() exists —
    // a crash in between must not strand a user's credits.
    if (holdId) {
      await attachHoldToJob(holdId, job.id);
    }

    // Every job gets a point past which it is not worth waiting for. Without
    // one a job can sit in "queued" forever, which is what the 18 timeout
    // failures were: nothing owned the decision to give up. Three times the
    // model's own average, floored at five minutes for fast models and capped
    // at forty for slow ones.
    const deadlineMs = Math.min(
      Math.max(model.avgGenerationTime * 3 * 1000, 5 * 60 * 1000),
      40 * 60 * 1000
    );
    await updateJobStatus(job.id, {
      deadlineAt: new Date(Date.now() + deadlineMs).toISOString(),
      creditHoldId: holdId ?? undefined,
    });

    // Route to the correct provider.
    //
    // This used to fall back to RunPod Wan 2.2 whenever a hosted provider
    // answered with a billing or auth error. That failover was the single
    // largest source of production failures: RUNPOD_ENDPOINT_WAN22 was deleted
    // months ago, so every exhausted-balance error became an opaque
    // "RunPod API error: 404" on a model the user never chose. 54 of the 55
    // RunPod 404s in production history came through this branch, on
    // seedance-1.5 — a model declared provider:"fal" that never intentionally
    // touches RunPod. Audited 2026-09-09: all 8 configured RunPod video
    // endpoints 404, and every endpoint on the account is scaled to
    // workersMax=0, so there is nothing to fail over TO.
    //
    // A hosted provider being out of balance is now reported as itself. The
    // catch below refunds either way; the difference is that the user gets a
    // true reason instead of a 404 from an unrelated vendor.
    const actualModelId: string = body.modelId;
    try {
      if (model.provider === "fal") {
        // Premium models — route through provider router (WaveSpeed → FAL)
        const routerResult = await submitVideoJob({
          modelId: body.modelId,
          type: effectiveType as "t2v" | "i2v",
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          imageUrl: body.inputImageUrl,
          duration,
          aspectRatio: body.aspectRatio,
          enableAudio: body.enableAudio,
          seed: body.seed,
          isDraft: body.isDraft || false,
        });

        await updateJobStatus(job.id, {
          runpodJobId: routerResult.request_id,
          status: "queued",
        });
      }

      if (model.provider !== "fal") {
        // RunPod — open-source models only. Never a fallback target.
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

      // Track provider success (router already tracks wavespeed/fal internally)
      if (model.provider !== "fal") {
        recordProviderSuccess("runpod");
      }

      sendSlackAlert({
        level: "info",
        title: "Video generation started",
        message: `User: ${user.name} (${user.email})\nModel: ${model.name} | ${body.duration}s | ${creditCost} credits`,
      }).catch(() => {});

      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        estimatedTime: model.avgGenerationTime * (body.isDraft ? 0.3 : 1),
        creditsCost: creditCost,
      });
    } catch (gpuError) {
      console.error("GPU submission error:", gpuError);

      // Track provider failure
      const provider = model.provider === "fal" ? "fal" : "runpod";
      const errorMsg = gpuError instanceof Error ? gpuError.message : "Unknown GPU error";
      recordProviderFailure(provider as "fal" | "runpod", errorMsg);

      // A provider out of balance is an operator emergency: every customer
      // from now on fails the same way. Shout, don't whisper.
      const operatorMustAct = isOperatorActionable(errorMsg);
      sendSlackAlert({
        level: operatorMustAct ? "critical" : "warning",
        title: operatorMustAct ? "GENERATION DOWN — provider balance/access" : "Video generation failed",
        message: `User: ${user.name} (${user.email})\nModel: ${model.name}\nError: ${errorMsg}\nCredits refunded: ${creditCost}${operatorMustAct ? "\n\nTop up the provider now — all generations are failing." : ""}`,
      }).catch(() => {});

      // Release the reservation rather than refunding a debit. The hold is
      // guarded, so this is safe even if the reaper reaches the same job
      // first — exactly the race that produced double refunds before.
      if (holdId) {
        await releaseHold(holdId, "Provider submission failed");
      }

      // The raw error is in the log and the alert above. The customer gets
      // plain language with no vendor names in it.
      const userMessage = toUserFacingProviderError(errorMsg);
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: userMessage,
      });

      return NextResponse.json(
        {
          error: userMessage,
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
