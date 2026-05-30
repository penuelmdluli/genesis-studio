import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getDb } from "@/lib/db-driver";
import { getUserByClerkId, deleteVideo } from "@/lib/db";
import { r2PublicUrl, deleteFile, verifyR2Upload } from "@/lib/storage";

async function findVideoKeyInR2(
  userId: string,
  jobId: string
): Promise<string | null> {
  const candidates = [
    `videos/${userId}/${jobId}.mp4`,
    `videos/${userId}/${jobId}`,
    `videos/${userId}/${jobId}.webm`,
    `videos/${userId}/${jobId}.mov`,
    `mimic-outputs/${userId}/${jobId}.mp4`,
  ];

  for (const key of candidates) {
    try {
      await verifyR2Upload(key, 1);
      return key;
    } catch {
      // Key doesn't exist, try next
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const supabase = getDb();
    const { data: video } = await supabase
      .from("videos")
      .select("user_id, job_id, is_public")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Auth check: allow if video is public, has valid cron secret, or require owner
    const cronSecret =
      req.headers.get("x-cron-secret") ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const hasCronAccess = cronSecret === process.env.CRON_SECRET;

    if (!video.is_public && !hasCronAccess) {
      const clerkId = await getAuthUserId();
      if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await getUserByClerkId(clerkId);
      if (!user || user.id !== video.user_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Find the video file in R2 (tries multiple key formats)
    const r2LookupId = video.job_id || videoId;
    const key = await findVideoKeyInR2(video.user_id, r2LookupId);
    if (!key) {
      return NextResponse.json(
        { error: "Video file not found in storage" },
        { status: 404 }
      );
    }

    // Redirect to the public R2 URL (custom domain).
    // Bytes flow R2 → browser directly, never through the Worker.
    const publicUrl = r2PublicUrl(key);

    return NextResponse.redirect(publicUrl, {
      status: 302,
      headers: {
        "Cache-Control": "private, max-age=3540",
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

// ============================================
// DELETE — Remove video from DB + R2 storage
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = getDb();
    const { data: video } = await supabase
      .from("videos")
      .select("id, user_id, job_id")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from R2 storage (try all key formats, ignore errors)
    const keyCandidates = [
      `videos/${video.user_id}/${video.job_id}.mp4`,
      `videos/${video.user_id}/${video.job_id}`,
      `videos/${video.user_id}/${video.job_id}.webm`,
      `videos/${video.user_id}/${video.job_id}.mov`,
      `thumbnails/${video.user_id}/${video.job_id}.jpg`,
    ];

    for (const key of keyCandidates) {
      try {
        await deleteFile(key);
      } catch {
        // Key might not exist, that's fine
      }
    }

    await deleteVideo(videoId, user.id);

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
