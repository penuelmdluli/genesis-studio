import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// Explore videos are public — give the longest practical TTL (7 days max for
// AWS sigv4 presigned URLs).
const PRESIGN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Serve explore videos from R2 permanent storage via 302 redirect to a
 * presigned R2 URL. Bytes flow R2 → browser directly, never through Vercel,
 * so this endpoint costs ~zero fastOriginTransfer.
 *
 * URL format: /api/explore/video/{exploreId}
 * R2 key: explore/{exploreId}.mp4
 *
 * Public endpoint — no auth required (explore videos are public).
 * Range requests are handled natively by R2 on the redirected URL.
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

    const signedUrl = await getSignedUrl(
      R2,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: PRESIGN_TTL_SECONDS }
    );

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        // Cache the redirect for 6 days; the inner URL is good for 7.
        "Cache-Control": "public, max-age=518400",
      },
    });
  } catch (error) {
    console.error("[EXPLORE VIDEO] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
