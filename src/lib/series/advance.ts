// ============================================
// SERIES STUDIO — move one episode forward
// ============================================
// Everything that turns submitted shots into a finished episode: collect
// what the providers have finished, put back what failed for a passing
// reason, mark the episode done, and join the shots.
//
// Shared by the episode page (GET .../episodes/<id>) and the background
// cron (/api/cron/series-progress). It used to live only in the page, so an
// episode moved forward only while its creator had the tab open: on
// 2026-10-06 ten finished shots sat at the provider for 45 minutes, then
// stuck in "retrying" where nothing would ever pick them up again.

import { getDb } from "@/lib/db-driver";
import type { Shot } from "@/lib/series/writer";
import { refreshShots, SHOT_SELECT, type ShotRow } from "@/lib/series/progress";
import { retryFailedShots } from "@/lib/series/retry";
import { startAssembly, collectAssembly, isAssembled } from "@/lib/series/assemble";

export interface EpisodeRow {
  id: string;
  series_id: string;
  user_id: string;
  episode_number: number;
  title: string | null;
  synopsis: string | null;
  status: string;
  script: string | null;
  video_id: string | null;
  video_url: string | null;
  assembly_job: string | null;
}

export interface AdvanceResult {
  shots: Shot[];
  cliffhanger: string;
  shotRows: ShotRow[];
  done: number;
  failed: number;
}

/**
 * @param brandMark whether our mark goes on the joined episode (free tier
 *   and the operator's own work); a paying creator's episode stays clean.
 */
export async function advanceEpisode(episode: EpisodeRow, brandMark: boolean): Promise<AdvanceResult> {
  const db = getDb();
  const seriesId = episode.series_id;
  const episodeId = episode.id;

  let shots: Shot[] = [];
  let cliffhanger = "";
  try {
    const parsed = JSON.parse(episode.script || "{}") as { shots?: Shot[]; cliffhanger?: string };
    shots = parsed.shots || [];
    cliffhanger = parsed.cliffhanger || "";
  } catch {
    // A corrupt script should show an empty episode, not crash the page.
  }

  const loadShots = async () => {
    const { data } = await db
      .from("series_shots")
      .select(SHOT_SELECT)
      .eq("episode_id", episodeId)
      .order("shot_index", { ascending: true })
      .limit(20);
    return (data || []) as ShotRow[];
  };

  const shotRows = await loadShots();
  await refreshShots(db, shotRows);

  // Any scene that failed for a passing reason is put back in, without the
  // creator having to notice or ask. Capped, so a genuinely bad shot does not
  // loop. "retrying" counts too: a shot whose resubmission died half-way sits
  // in that state, and only retryFailedShots knows how to rescue it.
  if (shotRows.some((s) => s.status === "failed" || s.status === "retrying")) {
    const { data: seriesRow } = await db
      .from("series")
      .select("language, character_description, character_name, genre")
      .eq("id", seriesId)
      .maybeSingle();
    if (seriesRow) {
      await retryFailedShots(episodeId, seriesId, episode.user_id, shots, seriesRow);
      const refreshed = await loadShots();
      shotRows.length = 0;
      shotRows.push(...refreshed);
    }
  }

  const done = shotRows.filter((s) => s.status === "completed").length;
  const failed = shotRows.filter((s) => s.status === "failed").length;

  // The episode is finished the moment nothing is still moving.
  if (shotRows.length > 0 && done + failed === shotRows.length && episode.status === "rendering") {
    const finalStatus = done > 0 ? "completed" : "failed";
    await db.from("series_episodes").update({ status: finalStatus }).eq("id", episodeId);
    episode.status = finalStatus;
  }

  // Join the shots into something watchable, once, as soon as they are all
  // in. Guarded on video_id rather than on status so a second poll mid-join
  // cannot start another one.
  if (!episode.video_id && episode.status === "completed" && done >= 2) {
    const { data: series } = await db.from("series").select("title, genre").eq("id", seriesId).maybeSingle();
    if (episode.assembly_job) {
      // A join is already running. Collect it if it has finished.
      const result = await collectAssembly(
        episodeId,
        episode.user_id,
        episode.assembly_job,
        episode.title || `Episode ${episode.episode_number}`,
        series?.title || "Series",
        done
      );
      if (isAssembled(result)) {
        episode.video_id = result.videoId;
        episode.video_url = result.url;
      }
    } else {
      // Nothing running: start one. It finishes on a later poll.
      await startAssembly(episodeId, episode.user_id, true, undefined, brandMark ? "ivideostudio.ai" : null, series?.genre || null);
    }
  }

  return { shots, cliffhanger, shotRows, done, failed };
}
