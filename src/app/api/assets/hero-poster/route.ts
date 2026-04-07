import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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
 * GET /api/assets/hero-poster
 * Serves the hero poster image from R2.
 * Public, heavily cached (1 week).
 */
export async function GET() {
  try {
    const response = await R2.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: "assets/hero-poster.jpg" })
    );

    if (!response.Body) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Poster not found" }, { status: 404 });
  }
}
