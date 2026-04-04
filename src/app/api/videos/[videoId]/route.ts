import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";
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
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const supabase = createSupabaseAdmin();
    const { data: video } = await supabase
      .from("videos")
      .select("user_id, job_id, is_public")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Auth check: allow if video is public, otherwise require owner
    if (!video.is_public) {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await getUserByClerkId(clerkId);
      if (!user || user.id !== video.user_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const key = `videos/${video.user_id}/${video.job_id}.mp4`;

    // HEAD request first to get the total file size
    let totalSize: number;
    try {
      const headResponse = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      totalSize = headResponse.ContentLength ?? 0;
    } catch {
      return NextResponse.json(
        { error: "Video file not found in storage" },
        { status: 404 }
      );
    }

    if (totalSize === 0) {
      return NextResponse.json(
        { error: "Video file is empty" },
        { status: 404 }
      );
    }

    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      // Parse Range header: "bytes=start-end"
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid Range header", { status: 416 });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalSize}`,
          },
        });
      }

      const contentLength = end - start + 1;

      // Fetch the requested range from R2
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Range: `bytes=${start}-${end}`,
      });
      const response = await R2.send(command);

      if (!response.Body) {
        return NextResponse.json(
          { error: "Video file not found in storage" },
          { status: 404 }
        );
      }

      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": contentLength.toString(),
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400",
          "Content-Disposition": "inline",
        },
      });
    }

    // No Range header — return full file
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await R2.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: "Video file not found in storage" },
        { status: 404 }
      );
    }

    const byteArray = await response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": totalSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("Video stream error:", error);
    return NextResponse.json(
      { error: "Failed to stream video" },
      { status: 500 }
    );
  }
}
