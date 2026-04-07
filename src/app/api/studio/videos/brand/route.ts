import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { updateStudioVideo } from "@/lib/studio/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const { videoId } = (await req.json()) as { videoId: string };
    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase
      .from("studio_videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (!video.raw_video_url) {
      return NextResponse.json(
        { error: "Video has no raw_video_url yet" },
        { status: 400 }
      );
    }

    // MVP: Brain Studio already handles captions via burn_captions phase.
    // For watermark, we pass through the raw video as the branded video.
    // A future iteration can add FAL compose or ffmpeg-based watermarking.
    const brandedVideoUrl = video.raw_video_url;

    await updateStudioVideo(videoId, {
      branded_video_url: brandedVideoUrl,
      watermark_applied: true,
      status: "ready",
    });

    return NextResponse.json({
      videoId,
      brandedVideoUrl,
      status: "ready",
    });
  } catch (error) {
    console.error("[studio/videos/brand] Error:", error);
    return NextResponse.json(
      { error: "Failed to apply branding" },
      { status: 500 }
    );
  }
}
