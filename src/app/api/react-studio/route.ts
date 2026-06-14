import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, isOwnerClerkId, refundCredits } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { downloadVideoFromUrl } from "@/lib/video-downloader";
import { envString } from "@/lib/env";

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

// Credit costs per tier
const TIER_COSTS = {
  standard: 200, // Kling Elements + I2V
  premium: 600,  // Veo 3.1 Reference-to-Video
} as const;

type Tier = keyof typeof TIER_COSTS;

function getWavespeedApiKey(): string {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) throw new Error("WAVESPEED_API_KEY not configured");
  return key;
}

/** Helper: submit to WaveSpeed and return { request_id, status } */
async function wavespeedPost(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ request_id: string; status: string }> {
  const res = await fetch(`${WAVESPEED_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getWavespeedApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WaveSpeed submit failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const data = json.data;
  return { request_id: data.id, status: data.status || "created" };
}

/** Helper: poll a WaveSpeed prediction until terminal state */
async function wavespeedPoll(
  requestId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<{ status: string; data: Record<string, unknown> }> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${WAVESPEED_API_BASE}/predictions/${requestId}/result`,
      { headers: { Authorization: `Bearer ${getWavespeedApiKey()}` } }
    );

    if (res.ok) {
      const json = await res.json();
      const data = json.data;
      if (data.status === "completed" || data.status === "failed") {
        return { status: data.status, data };
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("WaveSpeed element creation timed out");
}

/** Standard tier: Kling Elements + I2V via WaveSpeed, FAL fallback */
async function submitStandardTier(params: {
  userPhotos: string[];
  sceneVideoUrl?: string;
  scenePrompt: string;
  duration: number;
  enableAudio: boolean;
  aspectRatio: string;
}): Promise<{ requestId: string; prefix: string }> {
  const wsKey = envString("WAVESPEED_API_KEY");

  if (wsKey) {
    try {
      // Step 1: Create a Kling Element from the first user photo
      console.log("[ReactStudio] Creating Kling Element from user photo...");
      const elementResult = await wavespeedPost(
        "kwaivgi/kling-elements",
        {
          image: params.userPhotos[0],
          name: "user",
          description: "Person to insert into video",
        }
      );

      // Step 2: Wait for element creation to complete
      console.log("[ReactStudio] Polling element creation:", elementResult.request_id);
      const elementPoll = await wavespeedPoll(elementResult.request_id);

      if (elementPoll.status !== "completed") {
        throw new Error("Element creation failed: " + (elementPoll.data.error || "unknown error"));
      }

      const elementId = elementPoll.data.id as string;
      const elementName = (elementPoll.data.name as string) || "user";

      // Step 3: Submit Kling V3 Pro I2V with element_list
      console.log("[ReactStudio] Submitting Kling V3 Pro I2V with element...");
      const i2vBody: Record<string, unknown> = {
        prompt: params.scenePrompt.includes("@Element1")
          ? params.scenePrompt
          : `${params.scenePrompt} @Element1`,
        element_list: [{ element_id: elementId, element_name: elementName }],
        duration: params.duration,
        sound: params.enableAudio,
        aspect_ratio: params.aspectRatio,
        cfg_scale: 0.5,
      };

      if (params.sceneVideoUrl) {
        i2vBody.image = params.sceneVideoUrl;
      }

      const i2vResult = await wavespeedPost(
        "kwaivgi/kling-v3.0-pro/image-to-video",
        i2vBody
      );

      return { requestId: i2vResult.request_id, prefix: "ws" };
    } catch (wsErr) {
      console.warn("[ReactStudio] WaveSpeed standard failed, falling back to FAL:", wsErr);
    }
  }

  // FAL fallback — use queue.submit (same pattern as fal.ts)
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY || "" });
  const falResult = await fal.queue.submit("fal-ai/kling-video/v3/pro/image-to-video", {
    input: {
      prompt: params.scenePrompt,
      image_url: params.sceneVideoUrl || params.userPhotos[0],
      duration: String(params.duration),
      aspect_ratio: params.aspectRatio,
      elements: params.userPhotos.map((url, i) => ({
        frontal_image_url: url,
      })),
    },
  });

  return { requestId: falResult.request_id, prefix: "" };
}

/** Premium tier: Veo 3.1 Reference-to-Video via WaveSpeed, FAL fallback */
async function submitPremiumTier(params: {
  userPhotos: string[];
  scenePrompt: string;
  enableAudio: boolean;
}): Promise<{ requestId: string; prefix: string }> {
  const wsKey = envString("WAVESPEED_API_KEY");

  if (wsKey) {
    try {
      console.log("[ReactStudio] Submitting Veo 3.1 Reference-to-Video...");
      const result = await wavespeedPost(
        "google/veo3.1/reference-to-video",
        {
          prompt: params.scenePrompt,
          images: params.userPhotos,
          resolution: "1080p",
          generate_audio: params.enableAudio,
        }
      );

      return { requestId: result.request_id, prefix: "ws" };
    } catch (wsErr) {
      console.warn("[ReactStudio] WaveSpeed premium failed, falling back to FAL:", wsErr);
    }
  }

  // FAL fallback — use queue.submit
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY || "" });
  const falResult = await fal.queue.submit("fal-ai/veo3" as string, {
    input: {
      prompt: params.scenePrompt,
      enable_audio: params.enableAudio,
    },
  });

  return { requestId: falResult.request_id, prefix: "" };
}

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
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      userPhotos,
      sceneVideoUrl: rawSceneVideoUrl,
      sceneUrl,
      scenePrompt,
      tier = "standard",
      duration = 5,
      enableAudio = true,
      aspectRatio = "16:9",
    } = body as {
      userPhotos: string[];
      sceneVideoUrl?: string;
      sceneUrl?: string;
      scenePrompt: string;
      tier?: Tier;
      duration?: number;
      enableAudio?: boolean;
      aspectRatio?: string;
    };

    let sceneVideoUrl = rawSceneVideoUrl;

    // Validate inputs
    if (!userPhotos || !Array.isArray(userPhotos) || userPhotos.length === 0) {
      return NextResponse.json(
        { error: "At least one user photo is required" },
        { status: 400 }
      );
    }

    if (userPhotos.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 user photos allowed" },
        { status: 400 }
      );
    }

    if (!scenePrompt) {
      return NextResponse.json(
        { error: "Scene prompt is required" },
        { status: 400 }
      );
    }

    if (tier !== "standard" && tier !== "premium") {
      return NextResponse.json(
        { error: "Tier must be 'standard' or 'premium'" },
        { status: 400 }
      );
    }

    // Reject YouTube URLs
    if (sceneUrl && /(?:youtube\.com|youtu\.be)\//i.test(sceneUrl)) {
      return NextResponse.json(
        { error: "YouTube URLs are not supported. Please use TikTok, Instagram, or upload a video directly." },
        { status: 400 }
      );
    }

    // Calculate credits
    const creditCost = TIER_COSTS[tier];
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success } = await deductCredits(
        user.id,
        creditCost,
        "",
        `React Studio ${tier}: "${scenePrompt.substring(0, 60)}" ${duration}s`
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
      type: "i2v",
      modelId: "mimic-motion",
      prompt: scenePrompt,
      inputImageUrl: userPhotos[0],
      inputVideoUrl: sceneVideoUrl,
      resolution: tier === "premium" ? "1080p" : "720p",
      duration,
      fps: 24,
      isDraft: false,
      creditsCost: creditCost,
      aspectRatio: aspectRatio === "9:16" ? "portrait" : aspectRatio === "1:1" ? "square" : "landscape",
    });

    // Download social media video if sceneUrl provided but no direct upload
    if (sceneUrl && !sceneVideoUrl) {
      try {
        const downloaded = await downloadVideoFromUrl(sceneUrl, user.id, job.id);
        sceneVideoUrl = downloaded.publicUrl;
      } catch (primaryErr) {
        console.warn("[ReactStudio] Primary video download failed, trying scraper fallback:", primaryErr);
        try {
          const { downloadAndPersist } = await import("@/lib/mbs/scraper");
          const { r2Key } = await downloadAndPersist(sceneUrl);
          sceneVideoUrl = `${process.env.R2_PUBLIC_URL || "https://cdn.ivideostudio.ai"}/${r2Key}`;
        } catch {
          if (!ownerAccount) {
            await refundCredits(user.id, creditCost, job.id, "Failed to download scene video — automatic refund");
          }
          await updateJobStatus(job.id, {
            status: "failed",
            errorMessage: "Could not download video from the provided URL",
          });
          return NextResponse.json(
            { error: "Could not download video from the provided URL. Please upload the video directly or try a different link." },
            { status: 422 }
          );
        }
      }
    }

    try {
      let result: { requestId: string; prefix: string };

      if (tier === "premium") {
        result = await submitPremiumTier({
          userPhotos,
          scenePrompt,
          enableAudio,
        });
      } else {
        result = await submitStandardTier({
          userPhotos,
          sceneVideoUrl,
          scenePrompt,
          duration,
          enableAudio,
          aspectRatio,
        });
      }

      // Store provider request ID with prefix
      const runpodJobId = result.prefix
        ? `${result.prefix}:${result.requestId}`
        : result.requestId;

      await updateJobStatus(job.id, {
        runpodJobId,
        status: "queued",
      });

      const estimatedTime = tier === "premium" ? duration * 20 : duration * 15;

      return NextResponse.json({
        jobId: job.id,
        status: "queued",
        estimatedTime,
        creditsCost: creditCost,
        tier,
      });
    } catch (submitErr) {
      console.error("[ReactStudio] Submission error:", submitErr);

      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditCost,
          job.id,
          "React Studio submission failed — automatic refund"
        );
      }

      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: submitErr instanceof Error ? submitErr.message : "Submission failed",
      });

      return NextResponse.json(
        { error: "React Studio submission failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[ReactStudio] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
