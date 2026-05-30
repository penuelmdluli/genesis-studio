import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
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

    const supabase = getDb();

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
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = getDb();

    const { data: favorites } = await supabase
      .from("video_favorites")
      .select("video_id")
      .eq("user_id", user.id);

    return NextResponse.json({
      favorites: (favorites || []).map((f: any) => f.video_id),
    });
  } catch (error) {
    console.error("[FAVORITES] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
