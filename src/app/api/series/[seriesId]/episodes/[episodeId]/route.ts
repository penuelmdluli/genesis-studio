// ============================================
// SERIES STUDIO — one episode: the script, and how the shots are doing
// ============================================
// GET /api/series/<id>/episodes/<episodeId>
//
// Returns the written script (so a creator can read their own episode in
// their own language before spending anything on it) alongside the state of
// every shot once rendering has started.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { renderCost } from "@/lib/series/pricing";
import type { Shot } from "@/lib/series/writer";
import { refreshShots, SHOT_SELECT, type ShotRow } from "@/lib/series/progress";
import { startAssembly, collectAssembly, isAssembled } from "@/lib/series/assemble";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const { seriesId, episodeId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const db = getDb();
  const { data: episode } = await db
    .from("series_episodes")
    .select("*")
    .eq("id", episodeId)
    .maybeSingle();

  if (!episode || episode.user_id !== user.id || episode.series_id !== seriesId) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  let shots: Shot[] = [];
  let cliffhanger = "";
  try {
    const parsed = JSON.parse(episode.script || "{}") as { shots?: Shot[]; cliffhanger?: string };
    shots = parsed.shots || [];
    cliffhanger = parsed.cliffhanger || "";
  } catch {
    // A corrupt script should show an empty episode, not crash the page.
  }

  const { data: rendered } = await db
    .from("series_shots")
    .select(SHOT_SELECT)
    .eq("episode_id", episodeId)
    .order("shot_index", { ascending: true })
    .limit(20);

  const shotRows = (rendered || []) as ShotRow[];
  await refreshShots(db, shotRows);

  const done = shotRows.filter((s) => s.status === "completed").length;
  const failed = shotRows.filter((s) => s.status === "failed").length;

  // The episode is finished the moment nothing is still moving. Recorded
  // here so a creator who closes the tab still comes back to a finished
  // episode rather than one stuck on "rendering" forever.
  if (shotRows.length > 0 && done + failed === shotRows.length && episode.status === "rendering") {
    const finalStatus = done > 0 ? "completed" : "failed";
    await db.from("series_episodes").update({ status: finalStatus }).eq("id", episodeId);
    episode.status = finalStatus;
  }

  // Join the shots into something watchable, once, as soon as they are all
  // in. Guarded on video_id rather than on status so a reload mid-assembly
  // cannot start a second one, and so an episode finished before this
  // existed still gets assembled the next time it is opened.
  if (!episode.video_id && episode.status === "completed" && done >= 2) {
    if (episode.assembly_job) {
      // A join is already running. Collect it if it has finished.
      const { data: series } = await db.from("series").select("title").eq("id", seriesId).maybeSingle();
      const result = await collectAssembly(
        episodeId,
        user.id,
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
      await startAssembly(episodeId, user.id, true);
    }
  }

  return NextResponse.json({
    episode: {
      id: episode.id,
      episodeNumber: episode.episode_number,
      title: episode.title,
      synopsis: episode.synopsis,
      status: episode.status,
      cliffhanger,
      videoId: episode.video_id || null,
      videoUrl: episode.video_url || null,
    },
    shots,
    cost: renderCost(shots),
    progress: shotRows.length ? { total: shotRows.length, done, failed } : null,
    rendered: shotRows,
  });
}
