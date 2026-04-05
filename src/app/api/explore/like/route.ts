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
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify the video exists and is published
    const { data: video, error: videoError } = await supabase
      .from("explore_videos")
      .select("id, likes")
      .eq("id", videoId)
      .eq("is_published", true)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Check if like already exists
    const { data: existingLike } = await supabase
      .from("explore_likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("video_id", videoId)
      .single();

    let liked: boolean;
    let likeCount: number;

    if (existingLike) {
      // Unlike: remove the like
      const { error: deleteError } = await supabase
        .from("explore_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) throw deleteError;

      // Decrement like count
      const newCount = Math.max((video.likes || 0) - 1, 0);
      const { error: updateError } = await supabase
        .from("explore_videos")
        .update({ likes: newCount })
        .eq("id", videoId);

      if (updateError) throw updateError;

      liked = false;
      likeCount = newCount;
    } else {
      // Like: insert new like
      const { error: insertError } = await supabase
        .from("explore_likes")
        .insert({
          user_id: user.id,
          video_id: videoId,
        });

      if (insertError) throw insertError;

      // Increment like count
      const newCount = (video.likes || 0) + 1;
      const { error: updateError } = await supabase
        .from("explore_videos")
        .update({ likes: newCount })
        .eq("id", videoId);

      if (updateError) throw updateError;

      liked = true;
      likeCount = newCount;
    }

    return NextResponse.json({ liked, likeCount });
  } catch (error) {
    console.error("Explore like error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
