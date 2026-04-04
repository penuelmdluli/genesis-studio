import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { getSignedUploadUrl, getSignedDownloadUrl, inputImageStorageKey } from "@/lib/storage";

// POST /api/upload — returns a presigned upload URL + a download URL for the file
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
    const { filename, contentType, purpose } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Build storage key based on purpose
    const prefix = purpose === "video" ? "inputs/videos" : "inputs/images";
    const key = `${prefix}/${user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // Get presigned upload URL (client uploads directly to R2)
    const uploadUrl = await getSignedUploadUrl(key, contentType, 600);

    // Get presigned download URL (RunPod will use this to fetch the file)
    const downloadUrl = await getSignedDownloadUrl(key, 86400); // 24h expiry

    return NextResponse.json({
      uploadUrl,
      downloadUrl,
      key,
    });
  } catch (error) {
    console.error("Upload presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
