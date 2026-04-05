import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { getSignedUploadUrl, getSignedDownloadUrl, uploadToR2 } from "@/lib/storage";

// POST /api/upload — upload file via server proxy (avoids R2 CORS issues)
// Accepts multipart form data with: file, purpose (image|video)
// OR JSON with: filename, contentType, purpose (returns presigned URLs for legacy flow)
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

    const contentTypeHeader = req.headers.get("content-type") || "";

    // --- Multipart upload (server proxy) ---
    if (contentTypeHeader.includes("multipart/form-data")) {
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
      ];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }

      // Validate file size (50MB for video, 10MB for image)
      const maxSize = purpose === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File too large. Max ${purpose === "video" ? "50MB" : "10MB"}.` },
          { status: 400 }
        );
      }

      const prefix = purpose === "video" ? "inputs/videos" : "inputs/images";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${prefix}/${user.id}/${Date.now()}-${safeName}`;

      // Upload to R2 server-side
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadToR2(key, buffer, file.type);

      // Get signed download URL for FAL/RunPod to fetch
      const downloadUrl = await getSignedDownloadUrl(key, 86400);

      return NextResponse.json({ downloadUrl, key });
    }

    // --- JSON (presigned URL flow, legacy fallback) ---
    const body = await req.json();
    const { filename, contentType, purpose } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/webm", "video/quicktime",
    ];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const prefix = purpose === "video" ? "inputs/videos" : "inputs/images";
    const key = `${prefix}/${user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const uploadUrl = await getSignedUploadUrl(key, contentType, 600);
    const downloadUrl = await getSignedDownloadUrl(key, 86400);

    return NextResponse.json({ uploadUrl, downloadUrl, key });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
