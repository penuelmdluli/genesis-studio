import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const supabase = getDb();

    const { data: collection } = await supabase
      .from("video_collections")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Get video IDs in this collection
    const { data: items } = await supabase
      .from("video_collection_items")
      .select("video_id")
      .eq("collection_id", id)
      .order("added_at", { ascending: false });

    // Fetch full video records separately (D1 doesn't support join syntax)
    const videoIds = (items || []).map((item: any) => item.video_id).filter(Boolean);
    let videos: any[] = [];
    if (videoIds.length > 0) {
      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .in("id", videoIds);
      videos = videoData ?? [];
    }

    return NextResponse.json({
      collection: {
        ...collection,
        videos,
      },
    });
  } catch (error) {
    console.error("[COLLECTIONS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = getDb();

    // Add or remove a video from collection
    if (body.action === "add_video" && body.videoId) {
      const { error } = await supabase
        .from("video_collection_items")
        .upsert(
          { collection_id: id, video_id: body.videoId },
          { onConflict: "collection_id,video_id" }
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === "remove_video" && body.videoId) {
      const { error } = await supabase
        .from("video_collection_items")
        .delete()
        .eq("collection_id", id)
        .eq("video_id", body.videoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Update collection metadata
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.color) updates.color = body.color;

    const { error } = await supabase
      .from("video_collections")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COLLECTIONS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const supabase = getDb();

    // Delete items first (cascade might not be set up)
    await supabase
      .from("video_collection_items")
      .delete()
      .eq("collection_id", id);

    const { error } = await supabase
      .from("video_collections")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COLLECTIONS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
