import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";

const FAL_API_KEY = process.env.FAL_KEY || "";

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  instagram: { width: 1088, height: 1088 },
  tiktok: { width: 768, height: 1360 },
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

    const dimensions = SIZE_MAP[size || "youtube"];
    if (!dimensions) {
      return NextResponse.json(
        { error: "Invalid size. Use: youtube, instagram, or tiktok" },
        { status: 400 }
      );
    }

    const numImages = count && [1, 2, 4].includes(count) ? count : 1;
    const creditsCost = numImages <= 2 ? 1 : 2;

    if (!FAL_API_KEY) {
      return NextResponse.json(
        { error: "AI Thumbnails is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

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

    const styledPrompt = style
      ? `${style} style: ${trimmedPrompt}`
      : trimmedPrompt;

    try {
      const falRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: styledPrompt,
          image_size: dimensions,
          num_images: numImages,
          enable_safety_checker: true,
          output_format: "jpeg",
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }),
      });

      if (!falRes.ok) {
        const errText = await falRes.text();
        throw new Error(`FAL request failed (${falRes.status}): ${errText}`);
      }

      const result = await falRes.json();
      const imageUrls = result.images?.map((img: { url: string }) => img.url) || [];

      // Convert FAL URLs to base64 data URIs server-side
      const base64Images = await Promise.all(
        imageUrls.map(async (url: string) => {
          try {
            const imgRes = await fetch(url);
            if (!imgRes.ok) return url;
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            return `data:${contentType};base64,${buffer.toString("base64")}`;
          } catch {
            return url;
          }
        })
      );

      return NextResponse.json({
        jobId: `thumb-${Date.now()}`,
        creditsCost,
        images: base64Images,
      });
    } catch (gpuError) {
      console.error("Thumbnail generation error:", gpuError);

      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Thumbnail generation failed — automatic refund"
        );
      }

      return NextResponse.json(
        { error: "Thumbnail generation failed. Credits refunded." },
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
