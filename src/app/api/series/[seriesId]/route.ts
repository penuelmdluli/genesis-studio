// ============================================
// SERIES STUDIO — one series, with everything made so far
// ============================================
// GET    /api/series/<id>  — the series, its episodes, and where it stands
// PATCH  /api/series/<id>  — change the cast or the premise
// DELETE /api/series/<id>  — give up on it

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

async function loadOwned(seriesId: string) {
  const clerkId = await getAuthUserId();
  if (!clerkId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await getUserByClerkId(clerkId);
  if (!user) return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };

  const db = getDb();
  const { data: series } = await db.from("series").select("*").eq("id", seriesId).maybeSingle();

  // Same answer for "does not exist" and "is not yours" — otherwise this
  // endpoint tells a stranger which series ids are real.
  if (!series || series.user_id !== user.id) {
    return { error: NextResponse.json({ error: "Series not found" }, { status: 404 }) };
  }
  return { user, series, db };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const owned = await loadOwned(seriesId);
  if (owned.error) return owned.error;
  const { series, db } = owned;

  const { data: episodes } = await db
    .from("series_episodes")
    .select("id, episode_number, title, synopsis, status, production_id, created_at")
    .eq("series_id", seriesId)
    .order("episode_number", { ascending: true })
    .limit(100);

  return NextResponse.json({ series, episodes: episodes || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const owned = await loadOwned(seriesId);
  if (owned.error) return owned.error;
  const { db } = owned;

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString().slice(0, 19).replace("T", " ") };

  // story_so_far is deliberately editable: a creator who does not like where
  // the story went should be able to steer it rather than start again.
  const allowed: Array<[string, string, number]> = [
    ["title", "title", 120],
    ["genre", "genre", 60],
    ["logline", "logline", 600],
    ["characterName", "character_name", 60],
    ["characterDescription", "character_description", 600],
    ["characterImageUrl", "character_image_url", 500],
    ["storySoFar", "story_so_far", 4000],
  ];
  for (const [key, column, max] of allowed) {
    if (typeof body[key] === "string") patch[column] = body[key].slice(0, max);
  }

  const { error } = await db.from("series").update(patch).eq("id", seriesId);
  if (error) {
    console.error("[SERIES] update failed:", error);
    return NextResponse.json({ error: "Could not save your changes" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const owned = await loadOwned(seriesId);
  if (owned.error) return owned.error;
  const { db } = owned;

  // Videos already rendered stay in the gallery. Deleting a series throws
  // away the plan, never the work somebody paid for.
  await db.from("series_episodes").delete().eq("series_id", seriesId);
  await db.from("series").delete().eq("id", seriesId);
  return NextResponse.json({ ok: true });
}
