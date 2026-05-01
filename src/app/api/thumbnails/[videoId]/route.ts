import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createSupabaseAdmin } from "@/lib/supabase";
import { r2PublicUrl } from "@/lib/storage";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";

// Thumbnails are public images.

/**
 * GET /api/thumbnails/{videoId}
 * 302-redirects to a presigned R2 URL for the thumbnail.
 * Bytes flow R2 → browser directly (zero fastOriginTransfer).
 *
 * R2 key format: thumbnails/{userId}/{videoId}.jpg
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const supabase = createSupabaseAdmin();
    const { data: video } = await supabase
      .from("videos")
      .select("user_id")
      .eq("id", videoId)
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const key = `thumbnails/${video.user_id}/${videoId}.jpg`;

    // Verify file exists
    try {
      const head = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      if ((head.ContentLength ?? 0) === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const publicUrl = r2PublicUrl(key);

    return NextResponse.redirect(publicUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    console.error("[THUMBNAILS] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
