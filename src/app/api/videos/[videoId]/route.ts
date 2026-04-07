import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getUserByClerkId, deleteVideo } from "@/lib/db";

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

async function findVideoInR2(
  userId: string,
  jobId: string
): Promise<{ key: string; size: number; contentType: string } | null> {
  // Try possible key formats in order of likelihood
  const candidates = [
    `videos/${userId}/${jobId}.mp4`,
    `videos/${userId}/${jobId}`,
    `videos/${userId}/${jobId}.webm`,
    `videos/${userId}/${jobId}.mov`,
  ];

  for (const key of candidates) {
    try {
      const head = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      const size = head.ContentLength ?? 0;
      if (size > 0) {
        return {
          key,
          size,
          contentType: head.ContentType || "video/mp4",
        };
      }
    } catch {
      // Key doesn't exist, try next
    }
  }
  return null;
}

async function streamFromR2(
  req: NextRequest,
  key: string,
  totalSize: number,
  contentType: string
): Promise<NextResponse> {
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new NextResponse("Invalid Range header", { status: 416 });
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }

    const contentLength = end - start + 1;
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
    return new NextResponse(Buffer.from(byteArray), {
      status: 206,
      headers: {
        "Content-Type": contentType,
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
  return new NextResponse(Buffer.from(byteArray), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": "inline",
    },
  });
}

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

    // Find the video file in R2 (tries multiple key formats)
    // For Brain Studio videos, job_id is null — use videoId as R2 key instead
    const r2LookupId = video.job_id || videoId;
    const found = await findVideoInR2(video.user_id, r2LookupId);
    if (!found) {
      return NextResponse.json(
        { error: "Video file not found in storage" },
        { status: 404 }
      );
    }

    return streamFromR2(req, found.key, found.size, found.contentType);
  } catch (error) {
    console.error("Video stream error:", error);
    return NextResponse.json(
      { error: "Failed to stream video" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE — Remove video from DB + R2 storage
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Auth: must be signed in
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Look up the video (need job_id for R2 key)
    const supabase = createSupabaseAdmin();
    const { data: video } = await supabase
      .from("videos")
      .select("id, user_id, job_id")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Only the owner can delete
    if (video.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Delete from R2 storage (try all key formats, ignore errors)
    const keyCandidates = [
      `videos/${video.user_id}/${video.job_id}.mp4`,
      `videos/${video.user_id}/${video.job_id}`,
      `videos/${video.user_id}/${video.job_id}.webm`,
      `videos/${video.user_id}/${video.job_id}.mov`,
      `thumbnails/${video.user_id}/${video.job_id}.jpg`,
    ];

    for (const key of keyCandidates) {
      try {
        await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      } catch {
        // Key might not exist, that's fine
      }
    }

    // 2. Delete from database
    await deleteVideo(videoId, user.id);

    // 3. Also clean up the generation job record
    await supabase
      .from("generation_jobs")
      .update({ status: "deleted" })
      .eq("id", video.job_id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, deleted: videoId });
  } catch (error) {
    console.error("Video delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
