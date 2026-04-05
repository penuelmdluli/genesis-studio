import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify video exists
    const { data: video, error: videoError } = await supabase
      .from("explore_videos")
      .select("id, recreates")
      .eq("id", videoId)
      .eq("is_published", true)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Increment recreate count
    const newCount = (video.recreates || 0) + 1;
    const { error: updateError } = await supabase
      .from("explore_videos")
      .update({ recreates: newCount })
      .eq("id", videoId);

    if (updateError) throw updateError;

    return NextResponse.json({ recreateCount: newCount });
  } catch (error) {
    console.error("Explore recreate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
