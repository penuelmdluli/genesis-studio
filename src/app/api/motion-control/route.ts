import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId, refundCredits } from "@/lib/credits";
import {
  submitMotionControlJob,
  hostedMotionAvailable,
  hostedMotionUnavailable,
  estimateMotionCost,
  type MotionQuality,
  type MotionModel,
  type MotionOrientation,
} from "@/lib/motion-control";
import { checkRateLimit } from "@/lib/fraud";
import { downloadVideoFromUrl } from "@/lib/video-downloader";

// Matches the client-side cap on direct uploads and Kling's own hard limit.
// 0 means the duration could not be read, which we let through rather than
// blocking a valid video on a parsing gap.
const MAX_REFERENCE_SECONDS = 30;

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

    // Fun effects and prompt-only motion are Kling-only — Wan-Animate needs a
    // driving video. If neither hosted provider has funds, say so before taking
    // the user's credits rather than refunding them after an opaque 403.
    const needsHostedProvider = isPromptOnlyMode || !!effect;
    if (needsHostedProvider && !(await hostedMotionAvailable())) {
      return NextResponse.json(
        {
          success: false,
          error: referenceVideoUrl || referenceUrl
            ? "This motion style is temporarily unavailable. Please try again later."
            : "Fun effects are temporarily unavailable. Upload a reference video instead — that mode is working.",
          code: "PROVIDER_UNAVAILABLE",
        },
        { status: 503 }
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

        // Direct uploads are length-checked in the browser, but a pasted URL
        // reaches here unchecked — and an over-long reference is the joint
        // largest cause of production motion failures. Kling rejects it after
        // we have already taken credits; Wan-Animate is worse, since it
        // animates the whole clip and bills our GPU by the second.
        if (downloaded.durationSec > MAX_REFERENCE_SECONDS) {
          if (!ownerAccount) {
            await refundCredits(user.id, creditCost, job.id, "Reference video too long — automatic refund");
          }
          await updateJobStatus(job.id, {
            status: "failed",
            errorMessage: `Reference video is ${Math.round(downloaded.durationSec)}s — the limit is ${MAX_REFERENCE_SECONDS}s.`,
          });
          return NextResponse.json(
            {
              success: false,
              error: `That video is ${Math.round(downloaded.durationSec)} seconds long. Please use a clip of ${MAX_REFERENCE_SECONDS} seconds or less.`,
              code: "INVALID_INPUT",
            },
            { status: 400 }
          );
        }

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

      // Our own Wan-Animate GPU is far slower than the hosted Kling endpoints
      // (a 14B diffusion pass plus pose/face preprocessing), so quote honestly
      // — an optimistic ETA just makes a working job look broken.
      const onRunpod = result.endpoint.startsWith("rp:");

      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: "queued",
        estimatedTime: onRunpod ? 30 * 60 : duration * 12,
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

      // A bare "Forbidden" from a provider means its account is locked or out
      // of balance — nothing the user can fix by retrying, so don't invite it.
      const providerLocked = /forbidden|exhausted balance|user is locked/i.test(errMsg);
      if (providerLocked) {
        hostedMotionUnavailable();
        import("@/lib/alerts").then(({ sendSlackAlert }) =>
          sendSlackAlert({
            level: "critical",
            title: "Motion provider locked",
            message: `Motion control submission was refused: ${errMsg}
Top up the hosted provider balance — effects and prompt-only motion are down.`,
          })
        ).catch(() => {});
      }

      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: providerLocked
          ? "This motion style is temporarily unavailable. Credits have been refunded."
          : `${errMsg}. Credits have been refunded.`,
      });

      return NextResponse.json(
        {
          success: false,
          error: providerLocked
            ? "This motion style is temporarily unavailable — we've been alerted. Your credits were refunded. Uploading a reference video still works."
            : "Motion control submission failed. Credits refunded.",
          code: providerLocked ? "PROVIDER_UNAVAILABLE" : "GENERATION_FAILED",
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Motion control error:", error);
    return NextResponse.json({ success: false, error: "Internal server error", code: "GENERATION_FAILED" }, { status: 500 });
  }
}
