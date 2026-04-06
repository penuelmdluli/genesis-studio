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

    const { videoId, action } = await req.json();

    if (!videoId || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    if (action === "add") {
      const { error } = await supabase
        .from("video_favorites")
        .upsert(
          { user_id: user.id, video_id: videoId },
          { onConflict: "user_id,video_id" }
        );

      if (error) {
        console.error("[FAVORITES] Add error:", error.message);
        return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("video_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("video_id", videoId);

      if (error) {
        console.error("[FAVORITES] Remove error:", error.message);
        return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("[FAVORITES] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    const { data: favorites } = await supabase
      .from("video_favorites")
      .select("video_id")
      .eq("user_id", user.id);

    return NextResponse.json({
      favorites: (favorites || []).map((f) => f.video_id),
    });
  } catch (error) {
    console.error("[FAVORITES] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
