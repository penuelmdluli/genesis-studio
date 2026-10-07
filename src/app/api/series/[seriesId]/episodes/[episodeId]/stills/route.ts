// ============================================
// SERIES STUDIO — the stills, before any video is paid for
// ============================================
// POST /api/series/<id>/episodes/<episodeId>/stills   { redo?: number }
//
// The way the clean AI films online are made: the picture is got right
// first, as a still, and only then animated. A still costs cents; a filmed,
// lip-synced, upscaled shot costs a hundred times more. So the creator sees
// every shot as a still, redoes the ones that are wrong, and only then
// presses Film, which starts from exactly these pictures.
//
// Each call does a bounded slice of the work and says how much is left; the
// page calls again until nothing is. In order: the episode's set picture,
// each speaker's portrait, then the stills three at a time. Everything made
// is saved as it is made, so a dropped connection loses nothing.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { makeShotStill, ensureSetImage, portraitForShot, type RenderContext } from "@/lib/series/render";
import { ensureCast, characterKey } from "@/lib/series/cast";
import { guessGender } from "@/lib/series/writer";
import { styleForGenre } from "@/lib/series/style";
import type { Shot, SeriesLanguage, CharacterLook } from "@/lib/series/writer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Work started after this much time is left for the next call. */
const BUDGET_MS = 30_000;
const PARALLEL_STILLS = 3;
/** A still is cheap, not free: a few retakes each, then film or rewrite. */
const MAX_REDOS_PER_SHOT = 4;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const started = Date.now();
  const { seriesId, episodeId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ownerAccount = isOwnerClerkId(clerkId);
  if (!ownerAccount && !["creator", "pro", "studio"].includes(user.plan)) {
    return NextResponse.json({ error: "Series Studio is part of the Creator plan and up.", upgrade: true }, { status: 403 });
  }
  const rate = checkRateLimit(user.id, "feature:paid");
  if (!rate.allowed) {
    return NextResponse.json({ error: "Give the last batch a moment.", resetAt: rate.resetAt }, { status: 429 });
  }
  if (!envString("WAVESPEED_API_KEY")) {
    return NextResponse.json({ error: "The studio is temporarily unavailable." }, { status: 503 });
  }

  const db = getDb();
  const { data: episode } = await db.from("series_episodes").select("*").eq("id", episodeId).maybeSingle();
  if (!episode || episode.user_id !== user.id || episode.series_id !== seriesId) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  if (episode.status === "rendering" || episode.status === "completed") {
    return NextResponse.json({ error: "This episode is already being filmed." }, { status: 409 });
  }
  const { data: series } = await db.from("series").select("*").eq("id", seriesId).maybeSingle();
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  let script: { shots?: Shot[]; cliffhanger?: string; location?: string | null; characters?: CharacterLook[] } = {};
  try {
    script = JSON.parse(episode.script || "{}");
  } catch {
    return NextResponse.json({ error: "This episode's script could not be read." }, { status: 500 });
  }
  const shots: Shot[] = script.shots || [];
  if (!shots.length) return NextResponse.json({ error: "This episode has no shots." }, { status: 400 });

  const save = async () => {
    await db.from("series_episodes").update({ script: JSON.stringify({ ...script, shots }) }).eq("id", episodeId);
  };

  // A retake of one still.
  const body = (await req.json().catch(() => ({}))) as { redo?: number };
  if (typeof body.redo === "number" && shots[body.redo]) {
    const shot = shots[body.redo];
    if ((shot.stillRedos || 0) >= MAX_REDOS_PER_SHOT) {
      return NextResponse.json(
        { error: `That shot has been redone ${MAX_REDOS_PER_SHOT} times. Rewrite the episode, or film it as it is.` },
        { status: 400 }
      );
    }
    shot.stillUrl = undefined;
    shot.stillRedos = (shot.stillRedos || 0) + 1;
    await save();
  }

  const ctx: RenderContext = {
    language: (series.language || "en-ZA") as SeriesLanguage,
    characterDescription: series.character_description || null,
    characterName: series.character_name || null,
    aspectRatio: "9:16",
    style: styleForGenre(series.genre),
    episodeId,
  };

  // Cast first (the portraits hang off the cast rows), then lock in the
  // location and looks the writer gave this episode. A returning character
  // keeps the look they were first given.
  await ensureCast(seriesId, shots, ctx.language, guessGender, user.id);
  if (script.location) {
    await db.from("series_episodes").update({ location: script.location.slice(0, 400) }).eq("id", episodeId).is("location", null);
  }
  for (const c of script.characters || []) {
    if (!c?.name || !c?.look) continue;
    await db
      .from("series_cast")
      .update({ look: c.look.slice(0, 500) })
      .eq("series_id", seriesId)
      .eq("character_key", characterKey(c.name))
      .is("look", null);
  }

  const timeLeft = () => Date.now() - started < BUDGET_MS;

  // 1. The set.
  const set = await ensureSetImage(seriesId, episodeId, ctx);

  // 2. Every speaker's portrait, once.
  const seen = new Set<string>();
  for (const shot of shots) {
    if (!timeLeft()) break;
    const key = shot.kind === "dialogue" && shot.speaker ? characterKey(shot.speaker) : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await portraitForShot(seriesId, shot, ctx);
  }

  // 3. The stills, a few at a time, saved after each batch.
  let failures = 0;
  while (timeLeft()) {
    const todo = shots.map((s, i) => ({ s, i })).filter(({ s }) => !s.stillUrl).slice(0, PARALLEL_STILLS);
    if (!todo.length) break;
    const made = await Promise.allSettled(todo.map(({ s }) => makeShotStill(s, ctx, seriesId)));
    made.forEach((r, k) => {
      if (r.status === "fulfilled") shots[todo[k].i].stillUrl = r.value;
      else failures++;
    });
    await save();
    if (failures >= PARALLEL_STILLS) break; // the provider is struggling; let the page retry
  }

  const remaining = shots.filter((s) => !s.stillUrl).length;
  const { data: lead } = await db.from("series").select("character_name, character_image_url").eq("id", seriesId).maybeSingle();
  const { data: cast } = await db
    .from("series_cast")
    .select("display_name, character_key, look, image_url")
    .eq("series_id", seriesId);

  return NextResponse.json({
    remaining,
    set: set.url,
    location: set.location,
    lead: lead ? { name: lead.character_name, portrait: lead.character_image_url || null } : null,
    cast: ((cast || []) as Array<{ display_name: string | null; character_key: string; look: string | null; image_url: string | null }>)
      .filter((c) => c.image_url || c.look)
      .map((c) => ({ name: c.display_name || c.character_key, look: c.look, portrait: c.image_url })),
    stills: shots.map((s) => ({ url: s.stillUrl || null, redos: s.stillRedos || 0 })),
  });
}
