import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Look up video in Supabase to get user_id and job_id
    const { createSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = createSupabaseAdmin();
    const { data: video } = await supabase
      .from("videos")
      .select("user_id, job_id")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Storage key uses job_id (set by videoStorageKey in storage.ts)
    const key = `videos/${video.user_id}/${video.job_id}.mp4`;

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await R2.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    // Stream the video back
    const byteArray = await response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": (response.ContentLength || buffer.length).toString(),
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
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
