import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/brain/templates — List templates (user's own + public)
 */
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
    const filter = req.nextUrl.searchParams.get("filter") || "all";

    let query = supabase
      .from("production_templates")
      .select("*")
      .order("usage_count", { ascending: false });

    if (filter === "mine") {
      query = query.eq("user_id", user.id);
    } else if (filter === "public") {
      query = query.eq("is_public", true);
    } else {
      // all = user's own + public
      query = query.or(`user_id.eq.${user.id},is_public.eq.true`);
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      templates: (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        concept: t.concept,
        style: t.style,
        aspectRatio: t.aspect_ratio,
        targetDuration: t.target_duration,
        voiceover: t.voiceover,
        music: t.music,
        captions: t.captions,
        sceneStructure: t.scene_structure,
        isPublic: t.is_public,
        usageCount: t.usage_count,
        isOwn: t.user_id === user.id,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error("Templates list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/brain/templates — Create a new template
 */
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
    const { name, description, concept, style, aspectRatio, targetDuration, voiceover, music, captions, sceneStructure, isPublic } = body;

    if (!name || !concept) {
      return NextResponse.json({ error: "name and concept are required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("production_templates")
      .insert({
        user_id: user.id,
        name,
        description: description || "",
        concept,
        style: style || "cinematic",
        aspect_ratio: aspectRatio || "landscape",
        target_duration: targetDuration || 30,
        voiceover: voiceover || false,
        music: music || false,
        captions: captions || false,
        scene_structure: sceneStructure ? JSON.stringify(sceneStructure) : null,
        is_public: isPublic || false,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      template: {
        id: data.id,
        name: data.name,
        description: data.description,
        concept: data.concept,
        style: data.style,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error("Template create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/brain/templates — Delete a template
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { templateId } = await req.json();
    if (!templateId) {
      return NextResponse.json({ error: "templateId required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Only allow deleting own templates
    const { error } = await supabase
      .from("production_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Template delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
