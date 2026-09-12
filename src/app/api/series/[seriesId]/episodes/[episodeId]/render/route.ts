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
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { submitShot, type RenderContext } from "@/lib/series/render";
import { renderCost, DIALOGUE_SHOT_CREDITS, ACTION_SHOT_CREDITS } from "@/lib/series/pricing";
import type { Shot, SeriesLanguage } from "@/lib/series/writer";
import { toUserFacingProviderError } from "@/lib/user-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  // same episode, so it is refused outright rather than quietly allowed.
  if (episode.status === "rendering" || episode.status === "completed") {
    return NextResponse.json(
      { error: episode.status === "completed" ? "This episode is already made." : "This episode is being made right now." },
      { status: 409 }
    );
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

  const cost = renderCost(shots);
  if (!ownerAccount) {
    const { success, newBalance } = await deductCredits(
      user.id,
      cost,
      "",
      `Series: ${series.title} episode ${episode.episode_number}`
    );
    if (!success) {
      return NextResponse.json(
        { error: "Not enough credits to make this episode", required: cost, balance: newBalance },
        { status: 402 }
      );
    }
  }

  await db.from("series_episodes").update({ status: "rendering" }).eq("id", episodeId);

  // Every shot is submitted; none is allowed to take down the others.
  const results = await Promise.allSettled(
    shots.map((shot, index) => submitShot(shot, ctx, user.id, `${episodeId}-${index}`))
  );

  let submitted = 0;
  let refundDue = 0;
  const rows: Record<string, unknown>[] = [];

  results.forEach((result, index) => {
    const shot = shots[index];
    const base = {
      id: randomUUID(),
      episode_id: episodeId,
      user_id: user.id,
      shot_index: index,
      kind: shot.kind,
      speaker: shot.speaker,
      dialogue: shot.dialogue,
      subtitle: shot.subtitle,
      action: shot.action,
      emotion: shot.emotion,
    };

    if (result.status === "fulfilled") {
      submitted++;
      rows.push({
        ...base,
        image_url: result.value.imageUrl,
        audio_url: result.value.audioUrl,
        provider_ref: `ws:${result.value.providerRef}`,
        status: "processing",
      });
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[SERIES] shot ${index} failed to submit:`, message);
      refundDue += shot.kind === "dialogue" ? DIALOGUE_SHOT_CREDITS : ACTION_SHOT_CREDITS;
      rows.push({ ...base, status: "failed", error: toUserFacingProviderError(message).slice(0, 300) });
    }
  });

  for (const row of rows) {
    const { error } = await db.from("series_shots").insert(row);
    if (error) console.error("[SERIES] could not record shot:", error);
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
    estimatedSeconds: 60 + shots.length * 30,
  });
}
