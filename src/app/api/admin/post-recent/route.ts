import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { autoPostMimicToMBS, autoPostSingleVideo } from "@/lib/owner-autopost";

/**
 * POST /api/admin/post-recent
 *
 * Owner-only: post the most recent videos to their Facebook pages RIGHT NOW.
 * With immediate posting enabled, each video publishes as soon as it's sent.
 *
 * Body (optional):
 *   { limit?: number }   how many recent videos to post (default 5, max 20)
 *
 * Routing mirrors /api/videos/[videoId]/post-to-pages:
 *   - mimic-motion videos → Mzansi Baby Stars (+ Penuel)
 *   - everything else     → Tech Pulse Africa (+ Penuel)
 */
export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const owner = await getUserByClerkId(clerkId);
    if (!owner) {
      return NextResponse.json({ error: "Owner user not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 20);

    const supabase = getDb();
    const { data: videos, error } = await supabase
      .from("videos")
      .select("id, user_id, title, prompt, model_id, job_id, created_at")
      .eq("user_id", owner.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!videos || videos.length === 0) {
      return NextResponse.json({ posted: false, message: "No recent videos found" });
    }

    const results: Array<{ videoId: string; page: string; posted: boolean; error?: string }> = [];

    for (const video of videos) {
      // Same R2 key convention used by post-to-pages
      const r2Key = `videos/${video.user_id}/${video.job_id || video.id}.mp4`;
      const prompt = video.prompt || video.title || "AI-generated video";
      try {
        if (video.model_id === "mimic-motion") {
          await autoPostMimicToMBS(clerkId, r2Key, prompt);
          results.push({ videoId: video.id, page: "mbs", posted: true });
        } else {
          await autoPostSingleVideo(clerkId, r2Key, prompt);
          results.push({ videoId: video.id, page: "tech_pulse", posted: true });
        }
      } catch (err) {
        results.push({ videoId: video.id, page: "auto", posted: false, error: String(err) });
      }
    }

    const posted = results.filter((r) => r.posted).length;
    return NextResponse.json({ posted: true, requested: videos.length, succeeded: posted, results });
  } catch (error) {
    console.error("[POST-RECENT] Error:", error);
    return NextResponse.json({ error: "Failed to post recent videos" }, { status: 500 });
  }
}
