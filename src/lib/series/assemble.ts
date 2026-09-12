// ============================================
// SERIES STUDIO — making the episode watchable
// ============================================
// Six clips are not an episode. Until the shots are joined there is nothing
// to play, nothing to download and nothing in the gallery — which is exactly
// what a creator found when their first episode "finished".
//
// This runs once, as soon as the last shot lands, and produces one video with
// the English subtitle burned onto each shot. It is included rather than
// charged for: the creator already paid for every scene, and an episode they
// cannot watch is not a thing worth selling.

import { randomUUID } from "crypto";
import { createVideo } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { r2PublicUrl, videoStorageKey } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";

interface ShotForAssembly {
  shot_index: number;
  status: string;
  clip_url: string | null;
  subtitle: string | null;
}

export interface AssembledEpisode {
  videoId: string;
  url: string;
}

/**
 * Why an assembly did not happen. Returned rather than swallowed: the first
 * time this failed it returned a bare null, which said nothing at all about
 * the cause.
 */
export interface AssemblyFailure {
  reason: string;
}

export type AssemblyResult = AssembledEpisode | AssemblyFailure | null;

export function isAssembled(r: AssemblyResult): r is AssembledEpisode {
  return !!r && "videoId" in r;
}

/**
 * Joins one episode's finished shots into a single video and files it in the
 * creator's gallery. Returns null when there is nothing worth assembling, or
 * when assembly fails — a failure here must never cost anyone their shots,
 * which still exist and still play individually.
 */
export async function assembleEpisode(
  episodeId: string,
  userId: string,
  episodeTitle: string,
  seriesTitle: string,
  burnSubtitles = true
): Promise<AssemblyResult> {
  const scraperUrl = envString("SCRAPER_SERVICE_URL");
  const scraperSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!scraperUrl || !scraperSecret) {
    return { reason: "the video service is not configured" };
  }

  const db = getDb();

  const { data: shotRows } = await db
    .from("series_shots")
    .select("shot_index, status, clip_url, subtitle")
    .eq("episode_id", episodeId)
    .order("shot_index", { ascending: true })
    .limit(20);

  const shots = (shotRows || []) as ShotForAssembly[];
  const usable = shots.filter((s) => s.status === "completed" && s.clip_url);

  // One clip is not worth a join, and the creator can already play it.
  if (usable.length < 2) {
    return { reason: `only ${usable.length} finished shot(s) — nothing to join` };
  }

  const videoId = randomUUID();
  const outputKey = videoStorageKey(userId, `episode-${videoId}`);

  try {
    const res = await fetch(`${scraperUrl}/stitch-episode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scraper-secret": scraperSecret },
      body: JSON.stringify({
        clips: usable.map((s) => ({ url: s.clip_url, subtitle: s.subtitle || "" })),
        outputR2Key: outputKey,
        burnSubtitles,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`[SERIES] stitch failed ${res.status}: ${detail}`);
      return { reason: `stitch ${res.status}: ${detail}` };
    }

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
      resolution: "1080p",
      duration: usable.length * 5,
      fps: 30,
      fileSize: 0,
      aspectRatio: "portrait",
    });

    await db
      .from("series_episodes")
      .update({ video_id: videoId, video_url: url })
      .eq("id", episodeId);

    console.log(`[SERIES] episode ${episodeId} assembled from ${usable.length} shots → ${videoId}`);
    return { videoId, url };
  } catch (err) {
    console.error("[SERIES] assembly failed:", err);
    return { reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/** The public URL of a stored episode, for anything that needs the file itself. */
export function episodePublicUrl(userId: string, videoId: string): string {
  return r2PublicUrl(videoStorageKey(userId, `episode-${videoId}`));
}
