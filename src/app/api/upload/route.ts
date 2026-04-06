import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

// POST /api/upload — returns a signed upload URL for direct client-to-Supabase upload
// Client uploads directly to Supabase Storage (no Vercel body size limit, no CORS issues)
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
      "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/webm", "video/quicktime",
      "audio/mpeg", "audio/wav", "audio/mp3",
    ];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Sanitize filename - only allow safe characters
    const safeFilename = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');

    // Build storage path
    const ext = safeFilename.split(".").pop() || "bin";
    const prefix = purpose === "video" ? "videos" : purpose === "audio" ? "audio" : "images";
    const path = `${prefix}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const supabase = createSupabaseAdmin();

    // Create a signed upload URL (client uploads directly to Supabase, bypasses RLS)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("uploads")
      .createSignedUploadUrl(path);

    if (signedError || !signedData) {
      console.error("Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    // Get the public URL for the file (FAL/RunPod will fetch from this)
    const { data: publicData } = supabase.storage
      .from("uploads")
      .getPublicUrl(path);

    return NextResponse.json({
      uploadUrl: signedData.signedUrl,
      token: signedData.token,
      path,
      publicUrl: publicData.publicUrl,
    });
  } catch (error) {
    console.error("Upload presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
