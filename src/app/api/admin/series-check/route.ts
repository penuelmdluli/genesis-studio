// ============================================
// SERIES STUDIO — diagnostic
// ============================================
// POST /api/admin/series-check   (cron secret or owner session)
//
// Runs the exact steps a dialogue shot takes, one at a time, and reports the
// RAW failure. It exists because the render route quite rightly shows
// customers a friendly message — and stored that friendly message instead of
// the cause, which left a real failure undiagnosable after the fact.
//
// Nothing here is customer-facing and nothing is charged.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { envString } from "@/lib/env";
import { submitWsModel, WS_MODELS } from "@/lib/wavespeed-tools";
import { synthesiseSpeech } from "@/lib/edge-tts";
import { getDb } from "@/lib/db-driver";
import { startAssembly, collectAssembly } from "@/lib/series/assemble";
import { submitShot } from "@/lib/series/render";
import type { Shot as SeriesShot } from "@/lib/series/writer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function detail(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    voice?: string;
    assembleEpisodeId?: string;
    retryEpisodeId?: string;
    /** Redo every shot, not only the failed ones. */
    force?: boolean;
  };

  // Re-submit the shots of an episode that failed. Same path the creator's
  // retry button takes, so verifying it here verifies what they get.
  if (body.retryEpisodeId) {
    const db = getDb();
    const { data: ep } = await db
      .from("series_episodes")
      .select("id, user_id, series_id, script")
      .eq("id", body.retryEpisodeId)
      .maybeSingle();
    if (!ep) return NextResponse.json({ error: "episode not found" }, { status: 404 });

    const { data: series } = await db.from("series").select("*").eq("id", ep.series_id).maybeSingle();
    if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

    const { data: existingShots } = await db
      .from("series_shots")
      .select("id, shot_index, status")
      .eq("episode_id", ep.id)
      .limit(20);
    const existing = (existingShots || []) as Array<{ id: string; shot_index: number; status: string }>;
    // A forced run redoes the whole episode — used when the pipeline itself
    // has changed and the existing shots were made by the old one.
    const retryIndexes = body.force
      ? new Set(existing.map((s) => s.shot_index))
      : new Set(existing.filter((s) => s.status === "failed").map((s) => s.shot_index));
    if (retryIndexes.size === 0) return NextResponse.json({ retried: 0, note: "no failed shots" });

    if (body.force) {
      // The joined episode belongs to the old shots, so it is cleared and
      // rebuilt once the new ones land.
      await db
        .from("series_episodes")
        .update({ video_id: null, video_url: null, assembly_job: null })
        .eq("id", ep.id);
    }

    let shots: SeriesShot[] = [];
    try {
      shots = (JSON.parse(ep.script || "{}") as { shots?: SeriesShot[] }).shots || [];
    } catch {
      return NextResponse.json({ error: "unreadable script" }, { status: 400 });
    }

    const ctx = {
      language: series.language || "en-ZA",
      characterDescription: series.character_description || null,
      characterName: series.character_name || null,
      aspectRatio: "9:16" as const,
    };

    const todo = shots
      .map((shot, index) => ({ shot, index }))
      .filter(({ index }) => retryIndexes.has(index));

    const results = await Promise.allSettled(
      todo.map(({ shot, index }) => submitShot(shot, ctx, ep.user_id, `${ep.id}-${index}-${Date.now()}`, ep.series_id))
    );

    let submitted = 0;
    const errors: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const { shot, index } = todo[i];
      const r = results[i];
      const previous = existing.find((e) => e.shot_index === index);
      if (previous) await db.from("series_shots").delete().eq("id", previous.id);

      const base = {
        id: previous?.id || crypto.randomUUID(),
        episode_id: ep.id,
        user_id: ep.user_id,
        shot_index: index,
        kind: shot.kind,
        speaker: shot.speaker,
        dialogue: shot.dialogue,
        subtitle: shot.subtitle,
        action: shot.action,
        emotion: shot.emotion,
        stage: "render",
      };

      if (r.status === "fulfilled") {
        submitted++;
        await db.from("series_shots").insert({
          ...base,
          image_url: r.value.imageUrl,
          audio_url: r.value.audioUrl,
          provider_ref: `ws:${r.value.providerRef}`,
          status: "processing",
        });
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`shot ${index}: ${message.slice(0, 160)}`);
        await db.from("series_shots").insert({ ...base, status: "failed", raw_error: message.slice(0, 400) });
      }
    }

    await db.from("series_episodes").update({ status: "rendering" }).eq("id", ep.id);
    return NextResponse.json({ retried: todo.length, submitted, errors });
  }

  // Assembly normally runs when a creator opens a finished episode. This
  // triggers it on demand so it can be proved to work without waiting for
  // somebody to load a page.
  if (body.assembleEpisodeId) {
    const db = getDb();
    const { data: ep } = await db
      .from("series_episodes")
      .select("id, user_id, series_id, title, episode_number, video_id, assembly_job")
      .eq("id", body.assembleEpisodeId)
      .maybeSingle();
    if (!ep) return NextResponse.json({ error: "episode not found" }, { status: 404 });
    if (ep.video_id) return NextResponse.json({ alreadyAssembled: true, videoId: ep.video_id });

    const { data: ser } = await db.from("series").select("title").eq("id", ep.series_id).maybeSingle();
    const { data: shots } = await db
      .from("series_shots")
      .select("id")
      .eq("episode_id", ep.id)
      .eq("status", "completed")
      .limit(20);

    // Same two steps the episode page takes: collect a running job, or start
    // one if there is none.
    const result = ep.assembly_job
      ? await collectAssembly(
          ep.id,
          ep.user_id,
          ep.assembly_job,
          ep.title || `Episode ${ep.episode_number}`,
          ser?.title || "Series",
          shots?.length || 0
        )
      : await startAssembly(ep.id, ep.user_id, true);

    return NextResponse.json({ assembled: result });
  }
  const text = body.text || "Sisi! Ubuye nini? Bengingazi ukuthi uyeza namhlanje!";
  const voice = body.voice || "zu-ZA-ThembaNeural";
  const steps: Record<string, unknown> = {};

  // 1. Speech synthesis — the step every dialogue shot failed on.
  let audio: Buffer | null = null;
  try {
    audio = Buffer.from(await synthesiseSpeech(text, voice));
    steps.tts = { ok: audio.length > 0, bytes: audio.length };
  } catch (err) {
    steps.tts = { ok: false, error: detail(err) };
    return NextResponse.json({ steps }, { status: 200 });
  }

  // 2. Storing it where the lip-sync model can read it.
  let audioUrl = "";
  try {
    const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
    const key = audioStorageKey("series-check", `probe-${Date.now()}`);
    await uploadAudio(key, audio!);
    audioUrl = r2PublicUrl(key);
    steps.upload = { ok: !!audioUrl, url: audioUrl };
  } catch (err) {
    steps.upload = { ok: false, error: detail(err) };
    return NextResponse.json({ steps }, { status: 200 });
  }

  // 3. Can the provider actually fetch it back?
  try {
    const head = await fetch(audioUrl, { method: "HEAD" });
    steps.reachable = { ok: head.ok, status: head.status };
  } catch (err) {
    steps.reachable = { ok: false, error: detail(err) };
  }

  // 4. The lip-sync submission itself.
  if (!envString("WAVESPEED_API_KEY")) {
    steps.lipsync = { ok: false, error: "WAVESPEED_API_KEY is not configured" };
    return NextResponse.json({ steps });
  }
  try {
    const prediction = await submitWsModel(WS_MODELS.lipsyncFromImage, {
      image: "https://d2h7xmz5gqybh9.cloudfront.net/predictions/14c6cf2d1af84e9eb8fb7cbb81181a3a/1.png",
      audio: audioUrl,
      prompt: "A person speaking naturally, composed. Accurate lip sync.",
    });
    steps.lipsync = { ok: true, id: prediction.id };
  } catch (err) {
    steps.lipsync = { ok: false, error: detail(err) };
  }

  return NextResponse.json({ steps });
}
