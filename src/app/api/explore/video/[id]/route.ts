import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
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

/**
 * Serve explore videos from R2 permanent storage.
 *
 * Uses the public R2 URL (custom domain or pub-*.r2.dev) so browsers can
 * play the video without CORS issues. Falls back to a 302 redirect to the
 * public URL.
 *
 * URL format: /api/explore/video/{exploreId}
 * R2 key: explore/{exploreId}.mp4
 *
 * Public endpoint — no auth required (explore videos are public).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const key = `explore/${id}.mp4`;

    // Verify the file exists before redirecting
    try {
      const head = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      if ((head.ContentLength ?? 0) === 0) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const publicUrl = r2PublicUrl(key);

    return NextResponse.redirect(publicUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch (error) {
    console.error("[EXPLORE VIDEO] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
