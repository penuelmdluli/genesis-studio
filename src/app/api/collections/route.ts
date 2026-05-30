import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export async function GET() {
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

    const { data: collections } = await supabase
      .from("video_collections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch video counts per collection separately (D1 doesn't support join syntax)
    const collectionIds = (collections || []).map((c: any) => c.id);
    let itemCountMap: Record<string, number> = {};
    if (collectionIds.length > 0) {
      const { data: items } = await supabase
        .from("video_collection_items")
        .select("collection_id, video_id")
        .in("collection_id", collectionIds);
      for (const item of items ?? []) {
        itemCountMap[item.collection_id] = (itemCountMap[item.collection_id] || 0) + 1;
      }
    }

    return NextResponse.json({
      collections: (collections || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        videoCount: itemCountMap[c.id] || 0,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error("[COLLECTIONS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const { name, description, color } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Collection name is required" }, { status: 400 });
    }

    const supabase = getDb();

    const { data, error } = await supabase
      .from("video_collections")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#7c3aed",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
    }

    return NextResponse.json({ collection: data });
  } catch (error) {
    console.error("[COLLECTIONS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
