import { NextRequest, NextResponse } from "next/server";
import { requireOwnerOrNotFound } from "@/lib/owner-only";
import { createSupabaseAdmin } from "@/lib/supabase";
import { buildCaption } from "@/lib/mbs/caption-template";

/**
 * POST /api/admin/mbs — Create an MBS job
 * GET /api/admin/mbs — List MBS jobs
 */
export async function POST(req: NextRequest) {
  const ownerCheck = await requireOwnerOrNotFound();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const body = await req.json();
  const { referenceVideoUrl, characterId, setting, prompt, caption, scheduledPostAt } = body as {
    referenceVideoUrl: string;
    characterId: string;
    setting?: string;
    prompt?: string;
    caption?: string;
    scheduledPostAt?: string;
  };

  if (!referenceVideoUrl || !characterId) {
    return NextResponse.json({ error: "referenceVideoUrl and characterId required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  // Get character
  const { data: character } = await supabase
    .from("mbs_characters")
    .select("*")
    .eq("id", characterId)
    .single();

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  // Build prompt and caption
  const finalPrompt = prompt ??
    `${character.description}, dancing joyfully, ${setting ?? "vibrant Soweto street"}, golden hour, cinematic, high quality`;

  // Admin route requires creatorHandle in body for attribution
  const { creatorHandle } = body as { creatorHandle?: string };
  const finalCaption = caption ?? buildCaption({
    character: character.name,
    creatorHandle: creatorHandle ?? null,
    setting,
  });

  const { data: job, error } = await supabase
    .from("mbs_jobs")
    .insert({
      reference_video_url: referenceVideoUrl,
      character_id: characterId,
      prompt: finalPrompt,
      setting,
      caption: finalCaption,
      scheduled_post_at: scheduledPostAt || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job });
}

export async function GET(req: NextRequest) {
  const ownerCheck = await requireOwnerOrNotFound();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  let query = supabase
    .from("mbs_jobs")
    .select("*, mbs_characters(name, portrait_url)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data });
}
