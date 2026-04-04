import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";

const RUNPOD_ENDPOINT = process.env.RUNPOD_ENDPOINT_VOICEOVER;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

const MIN_TEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 5000;
const CHARS_PER_30S = 150;
const CREDITS_PER_30S = 3;

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
    const { text, voiceId, speed, language } = body as {
      text: string;
      voiceId: string;
      speed?: number;
      language?: string;
    };

    // --- Validation ---
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be at least ${MIN_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be at most ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json({ error: "Voice ID is required" }, { status: 400 });
    }

    const safeSpeed = typeof speed === "number" ? Math.min(Math.max(speed, 0.5), 2.0) : 1.0;

    // --- Credit calculation ---
    const creditCost = Math.ceil(text.length / CHARS_PER_30S) * CREDITS_PER_30S;
    const estimatedDuration = Math.round((text.length / CHARS_PER_30S) * 30);

    const ownerAccount = isOwnerClerkId(clerkId);

    let newBalance: number | undefined;

    if (!ownerAccount) {
      const result = await deductCredits(
        user.id,
        creditCost,
        "",
        `Voiceover: ${voiceId} ${text.length} chars`
      );

      if (!result.success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditCost,
            balance: result.newBalance,
          },
          { status: 402 }
        );
      }

      newBalance = result.newBalance;
    }

    // --- Check if endpoint is configured ---
    if (!RUNPOD_ENDPOINT) {
      // Refund credits since we can't process
      if (!ownerAccount) {
        const refundedBalance = await refundCredits(
          user.id,
          creditCost,
          "",
          "Voiceover refund: endpoint not configured"
        );
        newBalance = refundedBalance;
      }
      return NextResponse.json(
        { error: "AI Voiceover coming soon", newBalance },
        { status: 503 }
      );
    }

    // --- Submit to RunPod ---
    try {
      const runpodResponse = await fetch(`${RUNPOD_ENDPOINT}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            text,
            voice_id: voiceId,
            speed: safeSpeed,
            output_format: "mp3",
            ...(language && { language }),
          },
        }),
      });

      if (!runpodResponse.ok) {
        const errText = await runpodResponse.text();
        console.error("[voiceover] RunPod error:", runpodResponse.status, errText);

        // Refund on failure
        if (!ownerAccount) {
          const refundedBalance = await refundCredits(
            user.id,
            creditCost,
            "",
            "Voiceover refund: RunPod submission failed"
          );
          newBalance = refundedBalance;
        }

        return NextResponse.json(
          { error: "Failed to start voiceover generation", newBalance },
          { status: 502 }
        );
      }

      const runpodData = await runpodResponse.json();

      return NextResponse.json({
        jobId: runpodData.id,
        estimatedDuration,
        creditsCost: creditCost,
        newBalance,
      });
    } catch (runpodError) {
      console.error("[voiceover] RunPod fetch error:", runpodError);

      // Refund on failure
      if (!ownerAccount) {
        const refundedBalance = await refundCredits(
          user.id,
          creditCost,
          "",
          "Voiceover refund: network error"
        );
        newBalance = refundedBalance;
      }

      return NextResponse.json(
        { error: "Failed to connect to voiceover service", newBalance },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[voiceover] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
