import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { videoId, prompt, modelId, duration, resolution, hasAudio, type } = body;

    // Validate required fields
    if (!videoId || !prompt || !modelId) {
      return NextResponse.json(
        { error: "videoId, prompt, and modelId are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Fetch the user's original video to get URLs
    const { data: sourceVideo, error: sourceError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (sourceError || !sourceVideo) {
      return NextResponse.json(
        { error: "Source video not found or does not belong to you" },
        { status: 404 }
      );
    }

    // Check if this video was already published
    const { data: existing } = await supabase
      .from("explore_videos")
      .select("id")
      .eq("source_video_id", videoId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This video has already been published to Explore" },
        { status: 409 }
      );
    }

    // Determine if user is on free tier
    const isFreeTier = user.plan === "free";

    // Create the explore video entry
    const { data: exploreVideo, error: insertError } = await supabase
      .from("explore_videos")
      .insert({
        source_video_id: videoId,
        user_id: user.id,
        prompt,
        model_id: modelId,
        video_url: sourceVideo.video_url || sourceVideo.output_url,
        thumbnail_url: sourceVideo.thumbnail_url,
        duration: duration || sourceVideo.duration,
        resolution: resolution || sourceVideo.resolution,
        has_audio: hasAudio ?? false,
        type: type || "t2v",
        creator_name: user.name || "Anonymous",
        creator_avatar_url: user.avatar_url,
        is_free_tier: isFreeTier,
        is_published: true,
        is_flagged: false,
        is_featured: false,
        views: 0,
        likes: 0,
        recreates: 0,
        shares: 0,
        tags: [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      id: exploreVideo.id,
      message: "Video published to Explore",
    });
  } catch (error) {
    console.error("Explore publish error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
