import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { envString } from "@/lib/env";

const CREDIT_COST = 10; // 10 credits per 4 images
const WS_API_BASE = "https://api.wavespeed.ai/api/v3";
// flux-dev gives higher quality + respects custom sizes (portrait/landscape)
const WS_IMAGE_MODEL = "wavespeed-ai/flux-dev";

function getWavespeedKey(): string {
  return envString("WAVESPEED_API_KEY") || "";
}

/**
 * Submit image generation to WaveSpeed, poll until done, return output URLs.
 */
async function generateWithWavespeed(
  prompt: string,
  size: { width: number; height: number },
  numImages: number
): Promise<string[]> {
  const apiKey = getWavespeedKey();
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not configured");

  const allOutputs: string[] = [];

  // WaveSpeed flux-schnell generates 1 image per request, so we run N in parallel
  const requests = Array.from({ length: Math.min(numImages, 4) }, () =>
    fetch(`${WS_API_BASE}/${WS_IMAGE_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        size: `${size.width}x${size.height}`,
        num_images: 1,
      }),
    })
  );

  const submitResults = await Promise.all(requests);
  const jobs: Array<{ id: string; pollUrl: string }> = [];

  for (const res of submitResults) {
    if (!res.ok) {
      const err = await res.text();
      console.error("[IMAGE-GEN] WaveSpeed submit error:", err.slice(0, 200));
      continue;
    }
    const data = await res.json();
    const pred = data.data || data;
    if (pred.id) {
      jobs.push({
        id: pred.id,
        pollUrl: pred.urls?.get || `${WS_API_BASE}/predictions/${pred.id}/result`,
      });
    }
  }

  if (jobs.length === 0) throw new Error("All image generation requests failed");

  // Poll all jobs until complete (max 60s)
  const maxWait = 60_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const pending = jobs.filter((j) => !allOutputs.some((o) => o.includes(j.id)));
    if (pending.length === 0 || allOutputs.length >= numImages) break;

    await new Promise((r) => setTimeout(r, 2000));

    for (const job of pending) {
      try {
        const pollRes = await fetch(job.pollUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!pollRes.ok) continue;
        const pollData = await pollRes.json();
        const pred = pollData.data || pollData;

        if (pred.status === "completed" && pred.outputs?.length > 0) {
          allOutputs.push(...pred.outputs);
        } else if (pred.status === "failed") {
          console.error(`[IMAGE-GEN] Job ${job.id} failed: ${pred.error}`);
        }
      } catch {
        // retry on next poll
      }
    }
  }

  return allOutputs;
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
        `Image generation: ${numImages} images`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: CREDIT_COST, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // Map aspect ratio — WaveSpeed uses "size" string param (WxH), not "image_size" object
    const sizeMap: Record<string, { width: number; height: number }> = {
      landscape: { width: 1344, height: 768 },
      portrait: { width: 768, height: 1344 },
      square: { width: 1024, height: 1024 },
    };
    const size = sizeMap[aspectRatio] || sizeMap.landscape;

    // Generate with WaveSpeed
    console.log(`[IMAGE-GEN] Generating ${numImages} images via WaveSpeed (${WS_IMAGE_MODEL})`);
    const imageUrls = await generateWithWavespeed(prompt.trim(), size, Math.min(numImages, 4));

    if (imageUrls.length === 0) {
      console.error("[IMAGE-GEN] No images generated");
      if (!ownerAccount) {
        await refundCredits(user.id, CREDIT_COST, "", "Image generation returned no images — automatic refund");
      }
      return NextResponse.json({ error: "No images generated. Credits refunded." }, { status: 503 });
    }

    // Convert URLs to base64 data URIs to avoid CORS issues
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

    console.log(`[IMAGE-GEN] Generated ${base64Images.length} images successfully`);

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
