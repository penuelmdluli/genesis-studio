// ============================================
// SERIES STUDIO — rendering an episode
// ============================================
// POST /api/series/<id>/episodes/<episodeId>/render
//
// This is the expensive one, so it is the careful one. The quote comes from
// the script that already exists, credits are taken once, and every shot
// that fails to submit is refunded individually — a creator never pays for a
// shot that was never made.
//
// Shots are submitted in parallel and polled afterwards. Six shots rendered
// one after another would hold a request open past any sane timeout.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { submitShot, type RenderContext } from "@/lib/series/render";
import { ensureCast } from "@/lib/series/cast";
import { guessGender } from "@/lib/series/writer";
import { renderCost, DIALOGUE_SHOT_CREDITS, ACTION_SHOT_CREDITS } from "@/lib/series/pricing";
import type { Shot, SeriesLanguage } from "@/lib/series/writer";
import { toUserFacingProviderError } from "@/lib/user-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const { seriesId, episodeId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const rate = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many renders at once. Give the last one a moment.", resetAt: rate.resetAt },
      { status: 429 }
    );
  }

  const ownerAccount = isOwnerClerkId(clerkId);
  if (!ownerAccount && !["creator", "pro", "studio"].includes(user.plan)) {
    return NextResponse.json(
      { error: "Series Studio is part of the Creator plan and up.", upgrade: true },
      { status: 403 }
    );
  }

  const db = getDb();
  const { data: episode } = await db.from("series_episodes").select("*").eq("id", episodeId).maybeSingle();
  if (!episode || episode.user_id !== user.id || episode.series_id !== seriesId) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // Rendering twice is the easiest way for somebody to pay twice for the
  // same episode. But an episode where some scenes failed is not "done" — it
  // is half an episode nobody can finish, which is worse. So: never redo a
  // scene that worked, always allow a retry of one that did not.
  const { data: existingShots } = await db
    .from("series_shots")
    .select("id, shot_index, status")
    .eq("episode_id", episodeId)
    .limit(20);

  const existing = (existingShots || []) as Array<{ id: string; shot_index: number; status: string }>;

  // "retrying" counts as in flight: it is the marker a request sets while it
  // claims a scene, and a second press must not slip past it.
  if (existing.some((s) => s.status === "processing" || s.status === "retrying")) {
    return NextResponse.json({ error: "This episode is being made right now." }, { status: 409 });
  }

  const retryIndexes = new Set(existing.filter((s) => s.status === "failed").map((s) => s.shot_index));
  const isRetry = existing.length > 0 && retryIndexes.size > 0;

  if (existing.length > 0 && !isRetry) {
    return NextResponse.json({ error: "This episode is already made." }, { status: 409 });
  }

  const { data: series } = await db.from("series").select("*").eq("id", seriesId).maybeSingle();
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  let shots: Shot[] = [];
  try {
    shots = (JSON.parse(episode.script || "{}") as { shots?: Shot[] }).shots || [];
  } catch {
    shots = [];
  }
  if (shots.length === 0) {
    return NextResponse.json({ error: "This episode has no scenes to make" }, { status: 400 });
  }

  if (!envString("WAVESPEED_API_KEY")) {
    return NextResponse.json(
      { error: "The studio is temporarily unavailable. Nothing was charged." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { aspectRatio?: string };
  const ctx: RenderContext = {
    language: (series.language || "en-ZA") as SeriesLanguage,
    characterDescription: series.character_description || null,
    characterName: series.character_name || null,
    aspectRatio: body.aspectRatio === "16:9" ? "16:9" : "9:16",
  };

  // Only the scenes that still need making.
  const candidates = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ index }) => !isRetry || retryIndexes.has(index));

  if (candidates.length === 0) {
    return NextResponse.json({ error: "This episode is already made." }, { status: 409 });
  }

  // Claim each scene in the database BEFORE spending anything.
  //
  // The old guard read the existing shots and then decided, which two presses
  // of the button could both pass before either had written a row: one
  // episode ended up with 24 rows for 12 scenes, every one of them rendered
  // and paid for twice. A shot's id is now derived from the episode and its
  // position, and a unique index backs it, so the database itself refuses the
  // second claim. Whoever loses simply has nothing to do.
  const todo: Array<{ shot: Shot; index: number; rowId: string }> = [];

  for (const { shot, index } of candidates) {
    const previous = existing.find((e) => e.shot_index === index);

    if (previous) {
      // A retry: take the existing row only if it is still the failed one we
      // read a moment ago. If another request got there first, leave it be.
      const { error } = await db
        .from("series_shots")
        .update({
          status: "retrying",
          stage: "render",
          error: null,
          raw_error: null,
          clip_url: null,
          raw_clip_url: null,
          updated_at: sqlNow(),
        })
        .eq("id", previous.id)
        .eq("status", "failed");
      if (!error) todo.push({ shot, index, rowId: previous.id });
      continue;
    }

    const rowId = `${episodeId}:${index}`;
    const { error } = await db.from("series_shots").insert({
      id: rowId,
      episode_id: episodeId,
      user_id: user.id,
      shot_index: index,
      kind: shot.kind,
      speaker: shot.speaker,
      dialogue: shot.dialogue,
      subtitle: shot.subtitle,
      action: shot.action,
      emotion: shot.emotion,
      status: "retrying",
      stage: "render",
      attempts: 1,
      updated_at: sqlNow(),
    });
    // A rejected insert means the row already exists, so somebody else owns
    // this scene. Nothing was charged for it and nothing will be.
    if (!error) todo.push({ shot, index, rowId });
  }

  if (todo.length === 0) {
    return NextResponse.json({ error: "This episode is already being made." }, { status: 409 });
  }

  // Charged for exactly what was claimed, never for what somebody else is
  // already making.
  const cost = renderCost(todo.map(({ shot }) => shot));
  if (!ownerAccount) {
    const { success, newBalance } = await deductCredits(
      user.id,
      cost,
      "",
      isRetry
        ? `Series: ${series.title} episode ${episode.episode_number} (${todo.length} scene retry)`
        : `Series: ${series.title} episode ${episode.episode_number}`
    );
    if (!success) {
      // Release the claim so the scenes are not stranded behind a payment
      // that never happened.
      for (const { rowId } of todo) {
        await db.from("series_shots").update({ status: "failed", error: "Not enough credits" }).eq("id", rowId);
      }
      return NextResponse.json(
        { error: "Not enough credits to make this episode", required: cost, balance: newBalance },
        { status: 402 }
      );
    }
  }

  // Cast everyone before anything renders, so two characters cannot claim
  // the same voice at the same instant.
  await ensureCast(seriesId, shots, ctx.language, guessGender);

  await db.from("series_episodes").update({ status: "rendering" }).eq("id", episodeId);

  // Every shot is submitted; none is allowed to take down the others.
  const results = await Promise.allSettled(
    todo.map(({ shot, index }) =>
      submitShot(shot, ctx, user.id, `${episodeId}-${index}-${Date.now()}`, seriesId)
    )
  );

  let submitted = 0;
  let refundDue = 0;

  for (let i = 0; i < results.length; i++) {
    const { shot, index, rowId } = todo[i];
    const result = results[i];

    if (result.status === "fulfilled") {
      submitted++;
      await db
        .from("series_shots")
        .update({
          status: "processing",
          stage: "render",
          image_url: result.value.imageUrl,
          audio_url: result.value.audioUrl,
          provider_ref: `ws:${result.value.providerRef}`,
          updated_at: sqlNow(),
        })
        .eq("id", rowId);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[SERIES] shot ${index} failed to submit:`, message);
      refundDue += shot.kind === "dialogue" ? DIALOGUE_SHOT_CREDITS : ACTION_SHOT_CREDITS;
      await db
        .from("series_shots")
        .update({
          status: "failed",
          error: toUserFacingProviderError(message).slice(0, 300),
          // The customer sees the friendly line above; this keeps the actual
          // cause, because storing only the reassurance once left a real
          // failure impossible to diagnose after the fact.
          raw_error: message.slice(0, 500),
          updated_at: sqlNow(),
        })
        .eq("id", rowId);
    }
  }

  if (!ownerAccount && refundDue > 0) {
    await refundCredits(
      user.id,
      refundDue,
      "",
      `Series: ${results.length - submitted} shot(s) could not be started — automatic refund`
    );
  }

  if (submitted === 0) {
    await db.from("series_episodes").update({ status: "failed" }).eq("id", episodeId);
    return NextResponse.json(
      { error: "None of the scenes could be started. You have been fully refunded." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    episodeId,
    shots: results.length,
    submitted,
    charged: cost - refundDue,
    estimatedSeconds: 60 + todo.length * 30,
    retry: isRetry,
  });
}
