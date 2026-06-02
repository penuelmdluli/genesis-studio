import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, isOwnerClerkId, refundCredits } from "@/lib/credits";
import { submitKlingMotion } from "@/lib/providers/fal-kling-i2v";
import { downloadVideoFromUrl } from "@/lib/video-downloader";
import { getDb } from "@/lib/db-driver";
import { checkRateLimit } from "@/lib/fraud";
import { recordSpend } from "@/lib/spend-tracker";
import { sendSlackAlert } from "@/lib/alerts";
import { envString } from "@/lib/env";

const CREDIT_COST = 1500;

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
      characterImageUrl,
      referenceUrl,
      referenceVideoUrl,
      durationSec = 10,
      aspectRatio = "9:16",
      keepVideoSound = true,
      prompt,
    } = body as {
      characterImageUrl: string;
      referenceUrl?: string;
      referenceVideoUrl?: string;
      durationSec?: number;
      aspectRatio?: string;
      keepVideoSound?: boolean;
      prompt?: string;
    };

    if (!characterImageUrl) {
      return NextResponse.json({ error: "Character image is required" }, { status: 400 });
    }
    if (!referenceUrl && !referenceVideoUrl) {
      return NextResponse.json({ error: "Reference video URL or upload is required" }, { status: 400 });
    }

    // Social media link validation
    if (referenceUrl && !referenceVideoUrl) {
      // YouTube blocks direct downloads
      if (referenceUrl.includes("youtube.com") || referenceUrl.includes("youtu.be")) {
        return NextResponse.json(
          { error: "YouTube videos can't be imported directly. Please download the video first and upload it." },
          { status: 400 }
        );
      }
    }

    const duration = Math.max(3, Math.min(30, durationSec));
    const ownerAccount = isOwnerClerkId(clerkId);
    const supabase = getDb();

    // Deduct credits upfront (non-owners)
    if (!ownerAccount) {
      const { success } = await deductCredits(
        user.id,
        CREDIT_COST,
        "",
        `Mimic Studio: ${duration}s generation`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: CREDIT_COST, balance: user.credit_balance },
          { status: 402 }
        );
      }
    }

    // Insert mimic_jobs row
    const { data: job, error: insertError } = await supabase
      .from("mimic_jobs")
      .insert({
        user_id: user.id,
        character_image_url: characterImageUrl,
        reference_source_url: referenceUrl || null,
        reference_video_url: referenceVideoUrl || null,
        prompt: prompt || null,
        duration_sec: duration,
        aspect_ratio: aspectRatio,
        keep_video_sound: keepVideoSound,
        credits_charged: CREDIT_COST,
        status: referenceUrl ? "scraping" : "pending",
      })
      .select("id")
      .single();

    if (insertError || !job) {
      // Refund on DB error
      if (!ownerAccount) {
        await refundCredits(user.id, CREDIT_COST, "", "Mimic Studio: job creation failed — automatic refund");
      }
      console.error("[Mimic] Job insert failed:", insertError);
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    try {
      // If user provided a social media URL, download it to R2
      let finalVideoUrl = referenceVideoUrl;
      if (referenceUrl && !referenceVideoUrl) {
        const result = await downloadVideoFromUrl(referenceUrl, user.id, job.id);
        finalVideoUrl = result.publicUrl;

        await supabase.from("mimic_jobs").update({
          reference_video_url: finalVideoUrl,
          status: "pending",
        }).eq("id", job.id);
      }

      // Try FAL Kling Motion Control first, fall back to RunPod MimicMotion
      let provider = "fal";
      let trackingId = "";

      try {
        const { requestId } = await submitKlingMotion({
          prompt: prompt || "Person performing dance moves, high quality, cinematic",
          characterImageUrl,
          referenceVideoUrl: finalVideoUrl!,
          characterOrientation: "video",
          keepOriginalSound: keepVideoSound,
        });
        trackingId = requestId;

        await supabase.from("mimic_jobs").update({
          status: "submitted",
          fal_request_id: requestId,
        }).eq("id", job.id);

        recordSpend("fal-kling-i2v-mimic", 0).catch(() => {});
      } catch (falErr) {
        // FAL failed (likely balance exhausted) — fall back to RunPod MimicMotion
        const falMsg = falErr instanceof Error ? falErr.message : String(falErr);
        console.warn(`[Mimic] FAL failed (${falMsg}), falling back to RunPod MimicMotion`);
        provider = "runpod";

        const { submitRunPodJob, buildRunPodInput } = await import("@/lib/runpod");
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";

        const runpodInput = buildRunPodInput({
          modelId: "mimic-motion" as any,
          type: "motion",
          prompt: prompt || "Person performing dance moves",
          inputImageUrl: characterImageUrl,
          inputVideoUrl: finalVideoUrl!,
          resolution: "720p",
          duration: duration,
          fps: 24,
          aspectRatio: "portrait",
        });

        const runpodJob = await submitRunPodJob(
          "mimic-motion" as any,
          runpodInput,
          `${appUrl}/api/webhooks/runpod`
        );

        trackingId = runpodJob.id;

        await supabase.from("mimic_jobs").update({
          status: "submitted",
          fal_request_id: runpodJob.id, // reuse field for RunPod job ID
        }).eq("id", job.id);

        recordSpend("runpod-mimic-motion", 0).catch(() => {});
      }

      sendSlackAlert({
        level: "info",
        title: "Mimic Studio generation started",
        message: `User: ${user.name} (${user.email})\nDuration: ${duration}s | Credits: ${CREDIT_COST} | Provider: ${provider}`,
      }).catch(() => {});

      return NextResponse.json({
        jobId: job.id,
        status: "submitted",
        creditsCost: CREDIT_COST,
        provider,
      });
    } catch (submitErr) {
      console.error("[Mimic] Submission error:", submitErr);

      sendSlackAlert({
        level: "warning",
        title: "Mimic Studio generation failed",
        message: `User: ${user.name} (${user.email})\nError: ${submitErr instanceof Error ? submitErr.message : "Unknown"}\nCredits refunded: ${CREDIT_COST}`,
      }).catch(() => {});

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(user.id, CREDIT_COST, job.id, "Mimic Studio: submission failed — automatic refund");
      }

      await supabase.from("mimic_jobs").update({
        status: "failed",
        error_message: submitErr instanceof Error ? submitErr.message : "Submission failed",
      }).eq("id", job.id);

      return NextResponse.json(
        { error: "Generation failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[Mimic] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
