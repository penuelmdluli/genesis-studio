import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";

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

    const body = await req.json();
    const { imageUrl, text, audioUrl, voiceId, duration, language } = body as {
      imageUrl: string;
      text?: string;
      audioUrl?: string;
      voiceId?: string;
      duration?: number;
      language?: string;
    };

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Face image is required" },
        { status: 400 }
      );
    }

    if (!text && !audioUrl) {
      return NextResponse.json(
        { error: "Either text script or audio file is required" },
        { status: 400 }
      );
    }

    // Plan check: must be pro, studio, or owner
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedPlans = ["pro", "studio"];
      if (!allowedPlans.includes(user.plan)) {
        return NextResponse.json(
          { error: "Talking Avatar requires a Pro or Studio plan" },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost: 15 credits per 10 seconds
    const effectiveDuration = duration || 10;
    const creditsCost = Math.ceil(effectiveDuration / 10) * 15;

    // Deduct credits (owners skip)
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Talking Avatar: ${effectiveDuration}s ${language || "en"}`
      );

      if (!success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditsCost,
            balance: newBalance,
          },
          { status: 402 }
        );
      }
    }

    // Submit to RunPod
    const endpointUrl = process.env.RUNPOD_ENDPOINT_TALKING_AVATAR;
    if (!endpointUrl) {
      // Refund if endpoint not configured
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Talking Avatar endpoint not configured — automatic refund"
        );
      }
      return NextResponse.json(
        { error: "Talking Avatar coming soon — credits refunded" },
        { status: 503 }
      );
    }

    try {
      const runpodResponse = await fetch(`${endpointUrl}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            image_url: imageUrl,
            text: text || undefined,
            audio_url: audioUrl || undefined,
            voice_id: voiceId || undefined,
            duration: effectiveDuration,
            language: language || "en",
          },
        }),
      });

      if (!runpodResponse.ok) {
        const errText = await runpodResponse.text();
        throw new Error(`RunPod error ${runpodResponse.status}: ${errText}`);
      }

      const runpodData = await runpodResponse.json();
      const jobId = runpodData.id || runpodData.jobId || crypto.randomUUID();

      return NextResponse.json({
        jobId,
        creditsCost,
        estimatedTime: Math.ceil(effectiveDuration / 10) * 30, // ~30s processing per 10s of video
      });
    } catch (gpuError) {
      console.error("Talking Avatar GPU error:", gpuError);

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Talking Avatar GPU submission failed — automatic refund"
        );
      }

      return NextResponse.json(
        {
          error: "GPU submission failed. Credits refunded.",
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Talking Avatar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
