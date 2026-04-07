import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createSupabaseAdmin } from "@/lib/supabase";

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

/**
 * GET /api/thumbnails/{videoId}
 * Serves video thumbnail images from R2.
 * Public endpoint, heavily cached (1 week).
 *
 * R2 key format: thumbnails/{userId}/{videoId}.jpg
 * We look up userId from the videos table.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Look up video to get userId for the R2 key
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

    try {
      const response = await R2.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key })
      );

      if (!response.Body) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const byteArray = await response.Body.transformToByteArray();

      return new NextResponse(Buffer.from(byteArray), {
        headers: {
          "Content-Type": response.ContentType || "image/jpeg",
          "Content-Length": byteArray.length.toString(),
          "Cache-Control": "public, max-age=604800, immutable",
        },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("[THUMBNAILS] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
