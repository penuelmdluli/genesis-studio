// ============================================
// SERIES STUDIO — making the episode watchable
// ============================================
// Six clips are not an episode. Until the shots are joined there is nothing
// to play, nothing to download and nothing in the gallery — which is exactly
// what a creator found when their first episode "finished".
//
// Joining takes minutes on our hardware, far longer than any HTTP request
// survives, so it runs as a background job on the video service: we start it,
// remember the job id, and collect the result the next time the episode is
// opened. The page already polls while shots render, so this costs no extra
// machinery.
//
// Included rather than charged for: the creator paid for every scene, and an
// episode they cannot watch is not a thing worth selling.

import { randomUUID } from "crypto";
import { createVideo } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { r2PublicUrl, videoStorageKey } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { generateScore } from "@/lib/series/score";

interface ShotForAssembly {
  shot_index: number;
  status: string;
  kind: string | null;
  clip_url: string | null;
  audio_url: string | null;
  subtitle: string | null;
}

export interface AssembledEpisode {
  videoId: string;
  url: string;
}

/** Started, but not finished. Collected on a later poll. */
export interface AssemblyPending {
  pending: true;
  jobId: string;
}

/**
 * Why an assembly did not happen. Returned rather than swallowed: the first
 * time this failed it returned a bare null, which said nothing at all about
 * the cause.
 */
export interface AssemblyFailure {
  reason: string;
}

export type AssemblyResult = AssembledEpisode | AssemblyPending | AssemblyFailure | null;

export function isAssembled(r: AssemblyResult): r is AssembledEpisode {
  return !!r && "videoId" in r;
}

/**
 * Height of the joined episode.
 *
 * 1080p, measured rather than assumed. Joining at this size once exhausted
 * the 512MB instance outright, which is why it was dropped to 720p — but that
 * was before clips streamed to disk instead of being buffered and x264 was
 * pinned to one thread. With those in place a full six-shot episode joins at
 * 1080x1920 on the same free box with the service still healthy afterwards,
 * so the resolution came back without anyone paying for a bigger machine.
 */
export const EPISODE_HEIGHT: 1280 | 1920 = 1920;

function service(): { url: string; secret: string } | null {
  const url = envString("SCRAPER_SERVICE_URL");
  const secret = envString("SCRAPER_SERVICE_SECRET");
  return url && secret ? { url, secret } : null;
}

/**
 * Asks the video service to join this episode's finished shots. Returns as
 * soon as the job is accepted — the file does not exist yet.
 */
export async function startAssembly(
  episodeId: string,
  userId: string,
  burnSubtitles = true,
  height: 1280 | 1920 = EPISODE_HEIGHT,
  watermark: string | null = "ivideostudio.ai",
  genre: string | null = null
): Promise<AssemblyResult> {
  const svc = service();
  if (!svc) return { reason: "the video service is not configured" };

  const db = getDb();
  const { data: shotRows } = await db
    .from("series_shots")
    .select("shot_index, status, kind, clip_url, audio_url, subtitle")
    .eq("episode_id", episodeId)
    .order("shot_index", { ascending: true })
    .limit(20);

  const usable = ((shotRows || []) as ShotForAssembly[]).filter(
    (s) => s.status === "completed" && s.clip_url
  );

  // One clip is not worth joining, and the creator can already play it.
  if (usable.length < 2) {
    return { reason: `only ${usable.length} finished shot(s) — nothing to join` };
  }

  // The destination is chosen now so the video id is stable across the whole
  // job: the poll that collects the result must know where the file landed.
  const videoId = randomUUID();
  const outputKey = videoStorageKey(userId, `episode-${videoId}`);

  // Made before the join so it can be mixed in the same pass. A failure
  // here returns null and the episode is assembled without it.
  const musicUrl = await generateScore(genre, usable.length * 5);

  try {
    const res = await fetch(`${svc.url}/stitch-episode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scraper-secret": svc.secret },
      body: JSON.stringify({
        // Each clip carries the voice we synthesised for it. The video
        // model's own soundtrack is discarded during the join — it invents
        // speech, in Chinese, under every shot.
        clips: usable.map((s) => ({
          url: s.clip_url,
          subtitle: s.subtitle || "",
          audioUrl: s.kind === "dialogue" ? s.audio_url || null : null,
        })),
        outputR2Key: outputKey,
        burnSubtitles,
        height,
        watermark,
        musicUrl,
        musicVolume: 0.14,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { reason: `stitch ${res.status}: ${detail}` };
    }

    const body = (await res.json()) as { jobId?: string };
    if (!body.jobId) return { reason: "the video service did not return a job" };

    // videoId travels with the job so the collecting poll can file the result
    // without guessing.
    await db
      .from("series_episodes")
      .update({ assembly_job: `${body.jobId}|${videoId}` })
      .eq("id", episodeId);

    return { pending: true, jobId: body.jobId };
  } catch (err) {
    return { reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/**
 * Checks a running job and, if it has finished, files the episode in the
 * creator's gallery. Safe to call on every page load.
 */
export async function collectAssembly(
  episodeId: string,
  userId: string,
  assemblyJob: string,
  episodeTitle: string,
  seriesTitle: string,
  shotCount: number
): Promise<AssemblyResult> {
  const svc = service();
  if (!svc) return { reason: "the video service is not configured" };

  const [jobId, videoId] = assemblyJob.split("|");
  if (!jobId || !videoId) return { reason: "malformed assembly job" };

  const db = getDb();

  try {
    const res = await fetch(`${svc.url}/stitch-episode/${jobId}`, {
      headers: { "x-scraper-secret": svc.secret },
    });

    // The service restarts when it is idle, which loses jobs it was holding
    // in memory. Clearing the marker lets the next poll start a fresh one
    // rather than waiting forever on a job that no longer exists.
    if (res.status === 404) {
      await db.from("series_episodes").update({ assembly_job: null }).eq("id", episodeId);
      return { reason: "the join was interrupted — it will start again" };
    }

    if (!res.ok) return { reason: `status ${res.status}` };

    const body = (await res.json()) as { status?: string; error?: string };

    if (body.status === "running") return { pending: true, jobId };

    if (body.status !== "done") {
      await db.from("series_episodes").update({ assembly_job: null }).eq("id", episodeId);
      return { reason: body.error || "the join failed" };
    }

    const outputKey = videoStorageKey(userId, `episode-${videoId}`);
    const thumbnailUrl = await extractAndUploadThumbnail(outputKey, userId, videoId).catch(() => "");
    const url = `/api/videos/${videoId}`;

    await createVideo({
      id: videoId,
      userId,
      jobId: null,
      title: `${seriesTitle} — ${episodeTitle}`.slice(0, 100),
      url,
      thumbnailUrl,
      modelId: "kling-2.6",
      prompt: `Series episode: ${episodeTitle}`,
      resolution: EPISODE_HEIGHT === 1920 ? "1080p" : "720p",
      duration: shotCount * 5,
      fps: 30,
      fileSize: 0,
      aspectRatio: "portrait",
    });

    await db
      .from("series_episodes")
      .update({ video_id: videoId, video_url: url, assembly_job: null })
      .eq("id", episodeId);

    console.log(`[SERIES] episode ${episodeId} assembled → ${videoId}`);
    return { videoId, url };
  } catch (err) {
    return { reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/** The public URL of a stored episode, for anything that needs the file itself. */
export function episodePublicUrl(userId: string, videoId: string): string {
  return r2PublicUrl(videoStorageKey(userId, `episode-${videoId}`));
}
