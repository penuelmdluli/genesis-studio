import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getR2 } from "@/lib/cf-env";
import { r2PublicUrl } from "@/lib/storage";

/**
 * POST /api/upload-url — Downloads an image from an external URL server-side
 * and re-uploads to R2. Avoids CORS issues with cross-origin CDN URLs
 * and ensures permanent storage (third-party CDN links can expire).
 */
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

    const { url, purpose = "image" } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid URL is required" }, { status: 400 });
    }

    // Download the image
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Failed to download image (${imgRes.status})` },
        { status: 422 }
      );
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imgRes.arrayBuffer();

    // Validate size (20MB max for images)
    const maxSize = purpose === "video" ? 500 * 1024 * 1024 : 20 * 1024 * 1024;
    if (arrayBuffer.byteLength > maxSize || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: arrayBuffer.byteLength === 0 ? "Downloaded file is empty" : "File too large" },
        { status: 413 }
      );
    }

    // Determine extension
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extMap[contentType] || "jpg";
    const prefix = purpose === "video" ? "uploads/videos" : "uploads/images";
    const key = `${prefix}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to R2
    const r2 = getR2();
    await r2.put(key, arrayBuffer, {
      httpMetadata: { contentType },
    });

    const publicUrl = r2PublicUrl(key);

    return NextResponse.json({ publicUrl, key });
  } catch (error) {
    console.error("[upload-url] Error:", error);
    return NextResponse.json({ error: "Failed to process image URL" }, { status: 500 });
  }
}
