import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { envString } from "@/lib/env";
import { runWsModelSync, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError } from "@/lib/user-errors";

// Thumbnails render in a few seconds, so this answers synchronously with the
// images inlined as data URIs — no job row, no polling, no expiring provider
// URLs in the page.

const SIZE_MAP: Record<string, string> = {
  youtube: "1280*720",
  instagram: "1024*1024",
  tiktok: "768*1360",
};

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

    const body = await req.json();
    const { prompt, size, style, count } = body as {
      prompt: string;
      size: string;
      style?: string;
      count?: number;
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 5) {
      return NextResponse.json({ error: "Prompt must be at least 5 characters" }, { status: 400 });
    }
    if (trimmedPrompt.length > 1000) {
      return NextResponse.json({ error: "Prompt must be at most 1000 characters" }, { status: 400 });
    }

    const wsSize = SIZE_MAP[size || "youtube"];
    if (!wsSize) {
      return NextResponse.json({ error: "Invalid size. Use: youtube, instagram, or tiktok" }, { status: 400 });
    }

    const numImages = count && [1, 2, 4].includes(count) ? count : 1;
    const creditsCost = numImages <= 2 ? 5 : 10;

    if (!envString("WAVESPEED_API_KEY")) {
      return NextResponse.json({ error: "AI Thumbnails is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, creditsCost, "", `Thumbnail generation: ${size} ${numImages} image(s)`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    const styledPrompt = `${style ? `${style} style: ` : ""}${trimmedPrompt}. Bold, high-contrast, eye-catching thumbnail composition, sharp focus.`;

    try {
      // One image per request; run them in parallel.
      const results = await Promise.allSettled(
        Array.from({ length: numImages }, () =>
          runWsModelSync(WS_MODELS.textToImage, { prompt: styledPrompt, size: wsSize }, { timeoutMs: 60_000 })
        )
      );
      const imageUrls = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof runWsModelSync>>> => r.status === "fulfilled")
        .flatMap((r) => r.value.outputs || []);

      if (imageUrls.length === 0) {
        const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstErr?.reason instanceof Error ? firstErr.reason.message : "no images returned");
      }

      const base64Images = await Promise.all(
        imageUrls.map(async (url) => {
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
      const raw = gpuError instanceof Error ? gpuError.message : String(gpuError);
      console.error("Thumbnail generation error:", raw);

      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Thumbnail generation failed — automatic refund");
      }

      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("Thumbnails API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
