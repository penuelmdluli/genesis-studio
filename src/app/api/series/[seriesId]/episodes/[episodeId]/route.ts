// ============================================
// SERIES STUDIO — one episode: the script, and how the shots are doing
// ============================================
// GET /api/series/<id>/episodes/<episodeId>
//
// Returns the written script (so a creator can read their own episode in
// their own language before spending anything on it) alongside the state of
// every shot once rendering has started. Reading it also moves the episode
// forward (lib/series/advance.ts); the series-progress cron does the same
// for episodes whose creator has closed the page.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { renderCost } from "@/lib/series/pricing";
import { styleForGenre, styleSpec } from "@/lib/series/style";
import { advanceEpisode, type EpisodeRow } from "@/lib/series/advance";

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

  // The genre sets the look, and with it the price quoted for the scenes.
  const { data: seriesMeta } = await db.from("series").select("genre").eq("id", seriesId).maybeSingle();
  const seriesGenre: string | null = seriesMeta?.genre || null;

  // Our mark goes on free-tier episodes and on the operator's own, which is
  // how anyone who sees a shared episode learns where it was made. A paying
  // creator's work stays clean — that is what they upgraded for.
  const brandMark = isOwnerClerkId(clerkId) || user.plan === "free";
  const ep = episode as EpisodeRow;
  const { shots, cliffhanger, shotRows, done, failed } = await advanceEpisode(ep, brandMark);

  return NextResponse.json({
    episode: {
      id: ep.id,
      episodeNumber: ep.episode_number,
      title: ep.title,
      synopsis: ep.synopsis,
      status: ep.status,
      cliffhanger,
      videoId: ep.video_id || null,
      videoUrl: ep.video_url || null,
    },
    shots,
    cost: renderCost(shots, styleSpec(styleForGenre(seriesGenre)).blockbuster),
    progress: shotRows.length ? { total: shotRows.length, done, failed } : null,
    rendered: shotRows,
  });
}
