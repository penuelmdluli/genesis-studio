import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

// Hero poster is public — max sigv4 TTL (7 days)
const PRESIGN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * GET /api/assets/hero-poster
 * 302-redirects to a presigned R2 URL for the hero poster.
 * Bytes flow R2 → browser directly (zero fastOriginTransfer).
 */
export async function GET() {
  try {
    const signedUrl = await getSignedUrl(
      R2,
      new GetObjectCommand({ Bucket: BUCKET, Key: "assets/hero-poster.jpg" }),
      { expiresIn: PRESIGN_TTL_SECONDS }
    );

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=518400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Poster not found" }, { status: 404 });
  }
}
