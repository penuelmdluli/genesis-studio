import { NextRequest, NextResponse } from "next/server";
import { requireOwnerOrNotFound } from "@/lib/owner-only";
import { getDb } from "@/lib/db-driver";
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

  const supabase = getDb();

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

  const supabase = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  let query = supabase
    .from("mbs_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch related character data separately (D1 doesn't support join syntax)
  const jobs = data ?? [];
  const characterIds = [...new Set(jobs.map((j: any) => j.character_id).filter(Boolean))];
  let charactersMap: Record<string, { name: string; portrait_url: string }> = {};
  if (characterIds.length > 0) {
    const { data: characters } = await supabase
      .from("mbs_characters")
      .select("id, name, portrait_url")
      .in("id", characterIds);
    for (const c of characters ?? []) {
      charactersMap[c.id] = { name: c.name, portrait_url: c.portrait_url };
    }
  }
  const jobsWithCharacters = jobs.map((j: any) => ({
    ...j,
    mbs_characters: charactersMap[j.character_id] ?? null,
  }));

  return NextResponse.json({ jobs: jobsWithCharacters });
}
