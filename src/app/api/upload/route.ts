import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getR2 } from "@/lib/cf-env";
import { r2PublicUrl } from "@/lib/storage";

// POST /api/upload — accepts file directly, stores in R2, returns public URL
// On Workers we can't generate presigned URLs for R2, so the client
// uploads to this endpoint and we stream it to R2.
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const purpose = (formData.get("purpose") as string) || "image";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/webm", "video/quicktime",
      "audio/mpeg", "audio/wav", "audio/mp3",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // Validate size
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const maxSize = isVideo ? 500 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum ${limitMB}MB for ${isVideo ? "videos" : isAudio ? "audio" : "images"}.` },
        { status: 413 }
      );
    }

    // Build storage key
    const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const prefix = purpose === "video" ? "uploads/videos" : purpose === "audio" ? "uploads/audio" : "uploads/images";
    const key = `${prefix}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to R2
    const r2 = getR2();
    const arrayBuffer = await file.arrayBuffer();
    await r2.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = r2PublicUrl(key);

    return NextResponse.json({
      url: publicUrl,
      publicUrl,
      key,
      path: key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
