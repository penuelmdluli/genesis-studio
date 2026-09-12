// ============================================
// SERIES STUDIO — writing the next episode, or the whole season
// ============================================
// POST /api/series/<id>/episodes   { count?: 1..10, shotCount?: 3..12 }
//
// Writing is cheap; pictures are not. So a creator can plan an entire season
// here for almost nothing, see the whole arc, and then render episodes one
// at a time, whenever they have the budget and the appetite. The scripts
// wait for them.
//
// Each episode in a season is written in sequence, and each one reads the
// recap the previous one produced. That is what makes it a season rather
// than ten unrelated clips.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { getDb } from "@/lib/db-driver";
import { writeEpisode, type SeriesLanguage } from "@/lib/series/writer";
import {
  EPISODE_SCRIPT_CREDITS,
  MAX_SEASON_EPISODES,
  DEFAULT_SHOT_COUNT,
  MIN_SHOT_COUNT,
  MAX_SHOT_COUNT,
  renderCost,
} from "@/lib/series/pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const rate = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You are writing faster than we can keep up. Try again shortly.", resetAt: rate.resetAt },
      { status: 429 }
    );
  }

  const db = getDb();
  const { data: series } = await db.from("series").select("*").eq("id", seriesId).maybeSingle();
  if (!series || series.user_id !== user.id) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { count?: number; shotCount?: number };
  const count = Math.min(Math.max(Number(body.count) || 1, 1), MAX_SEASON_EPISODES);
  const shotCount = Math.min(
    Math.max(Number(body.shotCount) || DEFAULT_SHOT_COUNT, MIN_SHOT_COUNT),
    MAX_SHOT_COUNT
  );

  const ownerAccount = isOwnerClerkId(clerkId);
  const cost = EPISODE_SCRIPT_CREDITS * count;

  if (!ownerAccount) {
    const { success, newBalance } = await deductCredits(
      user.id,
      cost,
      "",
      `Series script: ${count} episode${count > 1 ? "s" : ""} of ${series.title}`
    );
    if (!success) {
      return NextResponse.json(
        { error: "Not enough credits to write this", required: cost, balance: newBalance },
        { status: 402 }
      );
    }
  }

  // Where the story currently stands. Written back after every episode so an
  // interrupted season leaves the series consistent rather than half-told.
  let storySoFar: string = series.story_so_far || "";
  let episodeNumber: number = (series.episode_count || 0) + 1;
  const written: Array<{ id: string; episodeNumber: number; title: string; synopsis: string; shots: number; renderCost: number }> = [];

  try {
    for (let i = 0; i < count; i++) {
      const draft = await writeEpisode(
        {
          title: series.title,
          language: (series.language || "en-ZA") as SeriesLanguage,
          genre: series.genre,
          logline: series.logline,
          characterName: series.character_name,
          characterDescription: series.character_description,
          storySoFar,
          episodeNumber,
        },
        shotCount
      );

      const episodeId = randomUUID();
      const { error: insertError } = await db.from("series_episodes").insert({
        id: episodeId,
        series_id: seriesId,
        user_id: user.id,
        episode_number: episodeNumber,
        title: draft.title,
        synopsis: draft.synopsis,
        script: JSON.stringify({ shots: draft.shots, cliffhanger: draft.cliffhanger }),
        status: "written",
      });
      if (insertError) throw new Error(`Could not save episode ${episodeNumber}`);

      storySoFar = draft.storySoFar;

      // Saved per episode, not once at the end: if episode 6 of 10 fails,
      // the five that worked are still there and still consistent.
      await db
        .from("series")
        .update({ story_so_far: storySoFar, episode_count: episodeNumber, updated_at: sqlNow() })
        .eq("id", seriesId);

      written.push({
        id: episodeId,
        episodeNumber,
        title: draft.title,
        synopsis: draft.synopsis,
        shots: draft.shots.length,
        renderCost: renderCost(draft.shots),
      });
      episodeNumber++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SERIES] write failed:", message);

    // Refund only what was not delivered. Episodes already saved are real.
    const unwritten = count - written.length;
    if (!ownerAccount && unwritten > 0) {
      await refundCredits(
        user.id,
        EPISODE_SCRIPT_CREDITS * unwritten,
        "",
        `Series script: ${unwritten} episode${unwritten > 1 ? "s" : ""} not written — automatic refund`
      );
    }

    if (written.length === 0) {
      return NextResponse.json({ error: message || "The writer could not finish. Nothing was charged." }, { status: 503 });
    }
    return NextResponse.json({
      episodes: written,
      partial: true,
      message: `Wrote ${written.length} of ${count} episodes. The rest were refunded — try again for the others.`,
    });
  }

  return NextResponse.json({ episodes: written });
}
