import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

type Rating = "great" | "okay" | "bad";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { videoId } = await params;
    const { rating } = await req.json();

    if (!["great", "okay", "bad"].includes(rating)) {
      return NextResponse.json({ error: "Invalid rating. Must be: great, okay, or bad" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify the video belongs to this user
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Upsert rating (one rating per user per video)
    const { error } = await supabase
      .from("video_ratings")
      .upsert(
        {
          video_id: videoId,
          user_id: user.id,
          rating: rating as Rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_id,user_id" }
      );

    if (error) {
      // If the video_ratings table doesn't exist yet, just store on the video itself
      await supabase
        .from("videos")
        .update({ rating })
        .eq("id", videoId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ success: true, rating });
  } catch (error) {
    console.error("[RATE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
