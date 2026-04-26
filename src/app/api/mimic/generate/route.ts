import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, isOwnerClerkId, refundCredits } from "@/lib/credits";
import { submitKlingMotion } from "@/lib/providers/fal-kling-i2v";
import { downloadAndPersist } from "@/lib/mbs/scraper";
import { createSupabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/fraud";
import { recordSpend } from "@/lib/spend-tracker";
import { envString } from "@/lib/env";

const CREDIT_COST = 1500;

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

    const duration = Math.max(3, Math.min(30, durationSec));
    const ownerAccount = isOwnerClerkId(clerkId);
    const supabase = createSupabaseAdmin();

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
      // If user provided a social media URL, scrape it via Railway
      let finalVideoUrl = referenceVideoUrl;
      if (referenceUrl && !referenceVideoUrl) {
        const { r2Key } = await downloadAndPersist(referenceUrl);
        const r2Pub = envString("R2_PUBLIC_URL") ?? "";
        finalVideoUrl = `${r2Pub}/${r2Key}`;

        await supabase.from("mimic_jobs").update({
          reference_video_url: finalVideoUrl,
          status: "pending",
        }).eq("id", job.id);
      }

      // Submit to Kling Motion Control
      const { requestId } = await submitKlingMotion({
        prompt: prompt || "Person performing dance moves, high quality, cinematic",
        characterImageUrl,
        referenceVideoUrl: finalVideoUrl!,
        characterOrientation: "video",
        keepOriginalSound: keepVideoSound,
      });

      await supabase.from("mimic_jobs").update({
        status: "submitted",
        fal_request_id: requestId,
      }).eq("id", job.id);

      recordSpend("fal-kling-i2v-mimic", 0).catch(() => {}); // actual cost tracked on completion

      return NextResponse.json({
        jobId: job.id,
        status: "submitted",
        creditsCost: CREDIT_COST,
      });
    } catch (submitErr) {
      console.error("[Mimic] Submission error:", submitErr);

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
