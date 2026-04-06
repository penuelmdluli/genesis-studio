import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

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
 * URL format: /api/explore/video/{exploreId}
 * R2 key: explore/{exploreId}.mp4
 *
 * Public endpoint — no auth required (explore videos are public).
 * Supports HTTP range requests for video seeking.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const key = `explore/${id}.mp4`;

    // Get file metadata
    let size: number;
    let contentType: string;
    try {
      const head = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      size = head.ContentLength ?? 0;
      contentType = head.ContentType || "video/mp4";
      if (size === 0) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Handle range requests for video seeking
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid Range", { status: 416 });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : size - 1;

      if (start >= size || end >= size || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }

      const contentLength = end - start + 1;
      const response = await R2.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Range: `bytes=${start}-${end}`,
        })
      );

      if (!response.Body) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const byteArray = await response.Body.transformToByteArray();
      return new NextResponse(Buffer.from(byteArray), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": contentLength.toString(),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=604800",
          "Content-Disposition": "inline",
        },
      });
    }

    // Full file response
    const response = await R2.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );

    if (!response.Body) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const byteArray = await response.Body.transformToByteArray();
    return new NextResponse(Buffer.from(byteArray), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=604800",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("[EXPLORE VIDEO] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
