import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

const VALID_PLATFORMS = [
  "whatsapp",
  "twitter",
  "facebook",
  "linkedin",
  "tiktok",
  "instagram",
  "copy_link",
  "download",
] as const;

type SharePlatform = (typeof VALID_PLATFORMS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, platform } = body;

    if (!videoId || !platform) {
      return NextResponse.json(
        { error: "videoId and platform are required" },
        { status: 400 }
      );
    }

    if (!VALID_PLATFORMS.includes(platform as SharePlatform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify video exists
    const { data: video, error: videoError } = await supabase
      .from("explore_videos")
      .select("id, shares")
      .eq("id", videoId)
      .eq("is_published", true)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Insert share event
    const { error: insertError } = await supabase
      .from("share_events")
      .insert({
        video_id: videoId,
        platform,
      });

    if (insertError) throw insertError;

    // Increment share count
    const newCount = (video.shares || 0) + 1;
    const { error: updateError } = await supabase
      .from("explore_videos")
      .update({ shares: newCount })
      .eq("id", videoId);

    if (updateError) throw updateError;

    return NextResponse.json({ shares: newCount });
  } catch (error) {
    console.error("Share track error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
