import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";
import { r2PublicUrl } from "@/lib/storage";
import { autoPostMimicToMBS, autoPostBrainToPages, autoPostSingleVideo } from "@/lib/owner-autopost";

/**
 * POST /api/videos/[videoId]/post-to-pages
 *
 * Owner-only: manually post an existing video to Facebook pages.
 * Picks the right pages based on the video's model/type.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const { videoId } = await params;
    const { targetPages } = await req.json().catch(() => ({ targetPages: "auto" }));

    const supabase = createSupabaseAdmin();
    const { data: video } = await supabase
      .from("videos")
      .select("id, user_id, title, prompt, model_id, url, job_id")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Build the R2 key from the video URL pattern: /api/videos/{id} → videos/{userId}/{jobId}.mp4
    const r2Key = `videos/${video.user_id}/${video.job_id || video.id}.mp4`;
    const prompt = video.prompt || video.title || "AI-generated video";
    const results: Record<string, { success: boolean; postId?: string; error?: string }> = {};

    if (targetPages === "mbs" || targetPages === "auto" && video.model_id === "mimic-motion") {
      // Mimic → MBS
      await autoPostMimicToMBS(clerkId, r2Key, prompt);
      results.mbs = { success: true };
    }

    if (targetPages === "tech" || targetPages === "all" || targetPages === "auto") {
      // Brain/Single → Tech Pulse + Africa 2050
      await autoPostBrainToPages(video.user_id, r2PublicUrl(r2Key), prompt);
      results.tech_pulse = { success: true };
      results.africa_2050 = { success: true };
    }

    if (targetPages === "single" || (targetPages === "auto" && video.model_id !== "mimic-motion")) {
      await autoPostSingleVideo(clerkId, r2Key, prompt);
      results.tech_pulse = { success: true };
    }

    return NextResponse.json({
      posted: true,
      videoId,
      results,
    });
  } catch (error) {
    console.error("[POST-TO-PAGES] Error:", error);
    return NextResponse.json(
      { error: "Failed to post to pages" },
      { status: 500 }
    );
  }
}
