import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId } = await params;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Look for audio file in R2
    const key = `audio/${user.id}/${audioId}.mp3`;

    try {
      const head = await R2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      const totalSize = head.ContentLength ?? 0;

      if (totalSize === 0) {
        return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
      }

      // Support range requests for audio streaming
      const rangeHeader = req.headers.get("range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
          const contentLength = end - start + 1;

          const response = await R2.send(
            new GetObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Range: `bytes=${start}-${end}`,
            })
          );

          if (!response.Body) {
            return NextResponse.json({ error: "Audio not found" }, { status: 404 });
          }

          const byteArray = await response.Body.transformToByteArray();
          return new NextResponse(Buffer.from(byteArray), {
            status: 206,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": contentLength.toString(),
              "Content-Range": `bytes ${start}-${end}/${totalSize}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }

      // Full file
      const response = await R2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      if (!response.Body) {
        return NextResponse.json({ error: "Audio not found" }, { status: 404 });
      }

      const byteArray = await response.Body.transformToByteArray();
      return new NextResponse(Buffer.from(byteArray), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": totalSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400",
          "Content-Disposition": `inline; filename="voiceover-${audioId}.mp3"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Audio stream error:", error);
    return NextResponse.json({ error: "Failed to stream audio" }, { status: 500 });
  }
}
