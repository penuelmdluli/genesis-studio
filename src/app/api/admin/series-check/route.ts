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
  };

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
