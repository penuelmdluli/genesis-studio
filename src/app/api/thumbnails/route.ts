import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  instagram: { width: 1080, height: 1080 },
  tiktok: { width: 1080, height: 1920 },
};

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
    const { prompt, size, style, count } = body as {
      prompt: string;
      size: string;
      style?: string;
      count?: number;
    };

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 5) {
      return NextResponse.json(
        { error: "Prompt must be at least 5 characters" },
        { status: 400 }
      );
    }
    if (trimmedPrompt.length > 1000) {
      return NextResponse.json(
        { error: "Prompt must be at most 1000 characters" },
        { status: 400 }
      );
    }

    // Validate size
    const dimensions = SIZE_MAP[size || "youtube"];
    if (!dimensions) {
      return NextResponse.json(
        { error: "Invalid size. Use: youtube, instagram, or tiktok" },
        { status: 400 }
      );
    }

    // Validate count
    const numImages = count && [1, 2, 4].includes(count) ? count : 1;

    // Calculate credits: 1 credit for 1-2 images, 2 credits for 4
    const creditsCost = numImages <= 2 ? 1 : 2;

    // Check if RunPod endpoint is configured
    const runpodEndpoint = process.env.RUNPOD_ENDPOINT_THUMBNAILS;
    if (!runpodEndpoint) {
      return NextResponse.json(
        { error: "AI Thumbnails coming soon" },
        { status: 503 }
      );
    }

    // Deduct credits (skip for owner accounts)
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Thumbnail generation: ${size} ${numImages} image(s)`
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

    // Build the prompt with style prefix
    const styledPrompt = style
      ? `${style} style: ${trimmedPrompt}`
      : trimmedPrompt;

    // Submit to RunPod (SDXL-turbo)
    try {
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (!runpodApiKey) {
        throw new Error("RunPod API key not configured");
      }

      const response = await fetch(`https://api.runpod.ai/v2/${runpodEndpoint}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({
          input: {
            prompt: styledPrompt,
            width: dimensions.width,
            height: dimensions.height,
            num_images: numImages,
            steps: 4,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`RunPod request failed (${response.status}): ${errText}`);
      }

      const result = await response.json();

      return NextResponse.json({
        jobId: result.id || `thumb-${Date.now()}`,
        creditsCost,
        images: result.output?.images || [],
      });
    } catch (gpuError) {
      console.error("Thumbnail GPU submission error:", gpuError);

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Thumbnail generation failed — automatic refund"
        );
      }

      return NextResponse.json(
        {
          error: "Thumbnail generation failed. Credits refunded.",
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Thumbnails API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
