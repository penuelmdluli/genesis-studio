import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";

const CREDIT_COST = 10; // 10 credits per 4 images
const FAL_API_KEY = process.env.FAL_KEY || "";

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
    const rateCategory = user.plan === "free" ? "image:free" : "image:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const { prompt, aspectRatio = "landscape", numImages = 4 } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json({ error: "Prompt is required (min 3 characters)" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        CREDIT_COST,
        "",
        `Image generation: FLUX Pro ${numImages} images`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: CREDIT_COST, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // Map aspect ratio to FLUX Pro format
    const sizeMap: Record<string, { width: number; height: number }> = {
      landscape: { width: 1360, height: 768 },
      portrait: { width: 768, height: 1360 },
      square: { width: 1024, height: 1024 },
    };
    const size = sizeMap[aspectRatio] || sizeMap.landscape;

    // Submit to FAL.AI FLUX Pro (synchronous endpoint, not queue)
    const falRes = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        image_size: size,
        num_images: Math.min(numImages, 4),
        enable_safety_checker: true,
        output_format: "jpeg",
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("[IMAGE-GEN] FAL error:", errText);

      // Refund on failure
      if (!ownerAccount) {
        const { refundCredits } = await import("@/lib/credits");
        await refundCredits(user.id, CREDIT_COST, "", "Image generation failed — automatic refund");
      }

      return NextResponse.json({ error: "Image generation failed. Credits refunded." }, { status: 503 });
    }

    const result = await falRes.json();

    const imageUrls = result.images?.map((img: { url: string }) => img.url) || [];
    if (imageUrls.length === 0) {
      console.error("[IMAGE-GEN] No images in response:", JSON.stringify(result).slice(0, 500));
      if (!ownerAccount) {
        await refundCredits(user.id, CREDIT_COST, "", "Image generation returned no images — automatic refund");
      }
      return NextResponse.json({ error: "No images generated. Credits refunded." }, { status: 503 });
    }

    // Convert FAL URLs to base64 data URIs server-side to avoid CDN/CORS issues
    const base64Images = await Promise.all(
      imageUrls.map(async (url: string) => {
        try {
          const imgRes = await fetch(url);
          if (!imgRes.ok) return url; // fallback to URL if fetch fails
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          return `data:${contentType};base64,${buffer.toString("base64")}`;
        } catch {
          return url; // fallback to URL
        }
      })
    );

    return NextResponse.json({
      images: base64Images,
      prompt: prompt.trim(),
      creditsCost: CREDIT_COST,
    });
  } catch (error) {
    console.error("[IMAGE-GEN] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
