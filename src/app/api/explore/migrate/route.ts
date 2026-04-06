import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";
import { persistExternalVideo, exploreVideoStorageKey } from "@/lib/storage";

/**
 * POST /api/explore/migrate
 *
 * Admin-only endpoint to migrate explore_videos with external URLs
 * (FAL, RunPod, etc.) to permanent R2 storage.
 *
 * Finds all explore_videos where video_url is an external http(s) URL
 * (not /api/explore/video/* or /api/videos/*), downloads each video,
 * uploads to R2, and updates the record with the permanent URL.
 *
 * Videos that fail to download (already expired) are marked as flagged.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ error: "Unauthorized — owner only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const limit = Math.min(body.limit || 50, 100);

    const supabase = createSupabaseAdmin();

    // Find explore_videos with external URLs (not already on our API)
    const { data: videos, error: fetchErr } = await supabase
      .from("explore_videos")
      .select("id, video_url, prompt")
      .like("video_url", "http%")
      .eq("is_flagged", false)
      .limit(limit);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        message: "No external URLs to migrate",
        migrated: 0,
        expired: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        message: `Dry run: found ${videos.length} videos to migrate`,
        videos: videos.map((v) => ({
          id: v.id,
          url: v.video_url?.slice(0, 80),
          prompt: v.prompt?.slice(0, 50),
        })),
      });
    }

    let migrated = 0;
    let expired = 0;
    const errors: string[] = [];

    for (const video of videos) {
      try {
        const storageKey = exploreVideoStorageKey(video.id);
        await persistExternalVideo(video.video_url, storageKey);

        const permanentUrl = `/api/explore/video/${video.id}`;
        await supabase
          .from("explore_videos")
          .update({ video_url: permanentUrl })
          .eq("id", video.id);

        migrated++;
        console.log(`[MIGRATE] ✓ ${video.id} → R2`);
      } catch (err) {
        // Video URL has expired or is unreachable — flag it
        await supabase
          .from("explore_videos")
          .update({ is_flagged: true })
          .eq("id", video.id);

        expired++;
        errors.push(`${video.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
        console.log(`[MIGRATE] ✗ ${video.id} — expired/unreachable, flagged`);
      }
    }

    return NextResponse.json({
      message: `Migration complete: ${migrated} migrated, ${expired} expired`,
      migrated,
      expired,
      total: videos.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[MIGRATE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
