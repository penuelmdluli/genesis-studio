// ============================================
// SERIES STUDIO — getting every shot, without being asked
// ============================================
// Scenes fail for reasons that have nothing to do with the creator: a model
// drops a job, a CDN refuses a download for a second. Three of six shots in
// one episode failed that way, all transient, all fine on the next attempt.
//
// Leaving those behind a button means an episode sits half-made until
// somebody notices. So a failed shot is resubmitted automatically whenever
// the episode is looked at, up to a small cap. The cap matters: a shot that
// fails for a real reason — a prompt the model refuses, a broken input —
// would otherwise retry forever and bill every time.

import { getDb } from "@/lib/db-driver";
import { submitShot, type RenderContext } from "@/lib/series/render";
import { toUserFacingProviderError } from "@/lib/user-errors";
import type { Shot, SeriesLanguage } from "@/lib/series/writer";

/** Three goes in total. Past that it is not bad luck, it is a real problem. */
export const MAX_SHOT_ATTEMPTS = 3;

interface FailedShotRow {
  id: string;
  shot_index: number;
  attempts: number | null;
}

export interface RetryOutcome {
  attempted: number;
  submitted: number;
  exhausted: number;
}

/**
 * Resubmits failed shots that still have attempts left. Safe to call on
 * every poll: shots at the cap are skipped, and shots that are not failed
 * are never touched.
 */
export async function retryFailedShots(
  episodeId: string,
  seriesId: string,
  userId: string,
  shots: Shot[],
  series: {
    language?: string | null;
    character_description?: string | null;
    character_name?: string | null;
  },
  aspectRatio: "9:16" | "16:9" = "9:16"
): Promise<RetryOutcome> {
  const db = getDb();

  // A shot is marked "retrying" between being claimed and being resubmitted.
  // If a request dies in that gap the row would sit there forever, counted
  // as neither finished nor failed, and the episode would never complete.
  // Anything stuck in that state for more than a few minutes is put back.
  const { data: stuck } = await db
    .from("series_shots")
    .select("id, updated_at")
    .eq("episode_id", episodeId)
    .eq("status", "retrying")
    .limit(20);

  for (const row of (stuck || []) as Array<{ id: string; updated_at: string | null }>) {
    const at = Date.parse((row.updated_at || "").replace(" ", "T") + "Z");
    if (!Number.isFinite(at) || Date.now() - at > 5 * 60 * 1000) {
      await db.from("series_shots").update({ status: "failed" }).eq("id", row.id);
    }
  }

  const { data: rows } = await db
    .from("series_shots")
    .select("id, shot_index, attempts")
    .eq("episode_id", episodeId)
    .eq("status", "failed")
    .limit(20);

  const failed = (rows || []) as FailedShotRow[];
  if (failed.length === 0) return { attempted: 0, submitted: 0, exhausted: 0 };

  const retryable = failed.filter((r) => (r.attempts || 1) < MAX_SHOT_ATTEMPTS);
  const exhausted = failed.length - retryable.length;
  if (retryable.length === 0) return { attempted: 0, submitted: 0, exhausted };

  const ctx: RenderContext = {
    language: (series.language || "en-ZA") as SeriesLanguage,
    characterDescription: series.character_description || null,
    characterName: series.character_name || null,
    aspectRatio,
  };

  // Claim the shots first. Two polls arriving together would otherwise both
  // resubmit the same scene and pay for it twice.
  const claimed: Array<{ row: FailedShotRow; shot: Shot }> = [];
  for (const row of retryable) {
    const shot = shots[row.shot_index];
    if (!shot) continue;
    const { error } = await db
      .from("series_shots")
      .update({
        status: "retrying",
        attempts: (row.attempts || 1) + 1,
        updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .eq("id", row.id)
      .eq("status", "failed");
    if (!error) claimed.push({ row, shot });
  }

  if (claimed.length === 0) return { attempted: 0, submitted: 0, exhausted };

  const results = await Promise.allSettled(
    claimed.map(({ row, shot }) =>
      submitShot(shot, ctx, userId, `${episodeId}-${row.shot_index}-${Date.now()}`, seriesId)
    )
  );

  let submitted = 0;
  for (let i = 0; i < results.length; i++) {
    const { row } = claimed[i];
    const result = results[i];
    const attempts = (row.attempts || 1) + 1;

    if (result.status === "fulfilled") {
      submitted++;
      await db
        .from("series_shots")
        .update({
          status: "processing",
          stage: "render",
          attempts,
          image_url: result.value.imageUrl,
          audio_url: result.value.audioUrl,
          provider_ref: `ws:${result.value.providerRef}`,
          clip_url: null,
          raw_clip_url: null,
          error: null,
          raw_error: null,
        })
        .eq("id", row.id);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[SERIES] auto-retry of shot ${row.shot_index} failed:`, message);
      await db
        .from("series_shots")
        .update({
          status: "failed",
          attempts,
          error: toUserFacingProviderError(message).slice(0, 300),
          raw_error: message.slice(0, 400),
        })
        .eq("id", row.id);
    }
  }

  // Nothing here is charged again: the creator paid for this scene when the
  // episode was commissioned, and a provider dropping a job is not their
  // doing.
  return { attempted: claimed.length, submitted, exhausted };
}
