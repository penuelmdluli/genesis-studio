import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
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

    const { data: collections } = await supabase
      .from("video_collections")
      .select("*, video_collection_items(video_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      collections: (collections || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        videoCount: c.video_collection_items?.length || 0,
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
    const { userId: clerkId } = await auth();
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

    const supabase = createSupabaseAdmin();

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
