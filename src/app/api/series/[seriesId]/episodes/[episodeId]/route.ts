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
import { getWsPrediction } from "@/lib/wavespeed-tools";
import { submitUpscale } from "@/lib/series/render";
import { assembleEpisode } from "@/lib/series/assemble";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A shot that has been rendering for longer than this is not coming back.
 * Generous on purpose: the reaper once killed a render somebody had paid
 * for, and a stuck row costs nothing while a lost episode costs trust.
 */
const SHOT_TIMEOUT_MS = 45 * 60 * 1000;

interface ShotRow {
  id: string;
  shot_index: number;
  status: string;
  /** "render" while the scene is being made, "upscale" during the finish. */
  stage: string | null;
  provider_ref: string | null;
  clip_url: string | null;
  raw_clip_url: string | null;
  created_at: string;
}

/**
 * Brings still-running shots up to date. This happens on read rather than on
 * a timer because the page is already asking — a separate poller would be a
 * second thing to keep alive for no extra information.
 */
async function refreshShots(
  db: ReturnType<typeof getDb>,
  rows: ShotRow[]
): Promise<void> {
  const pending = rows.filter((r) => r.status === "processing" && r.provider_ref?.startsWith("ws:"));
  if (pending.length === 0) return;

  await Promise.allSettled(
    pending.map(async (row) => {
      const ref = row.provider_ref!.slice(3);
      try {
        const prediction = await getWsPrediction(ref);

        const now = new Date().toISOString().slice(0, 19).replace("T", " ");

        if (prediction.status === "completed") {
          const url = prediction.outputs?.[0];
          if (!url) throw new Error("finished with no video");

          // The scene exists. Now make it match the rest of the episode.
          if (row.stage !== "upscale") {
            try {
              const upscaleRef = await submitUpscale(url);
              row.stage = "upscale";
              row.raw_clip_url = url;
              await db
                .from("series_shots")
                .update({
                  stage: "upscale",
                  raw_clip_url: url,
                  clip_url: url,
                  provider_ref: `ws:${upscaleRef}`,
                  updated_at: now,
                })
                .eq("id", row.id);
              return;
            } catch (err) {
              // A finishing pass that will not start is not worth losing a
              // paid scene over — keep what we have and call it done.
              console.error(`[SERIES] upscale could not start for shot ${row.shot_index}:`, err);
            }
          }

          row.status = "completed";
          row.clip_url = url;
          await db
            .from("series_shots")
            .update({ status: "completed", stage: "done", clip_url: url, updated_at: now })
            .eq("id", row.id);
          return;
        }

        if (prediction.status === "failed") {
          // Same rule: if only the finishing pass failed, the creator still
          // gets the scene they paid for.
          if (row.stage === "upscale" && row.raw_clip_url) {
            row.status = "completed";
            row.clip_url = row.raw_clip_url;
            await db
              .from("series_shots")
              .update({ status: "completed", stage: "done", clip_url: row.raw_clip_url, updated_at: now })
              .eq("id", row.id);
            return;
          }
          row.status = "failed";
          await db
            .from("series_shots")
            .update({ status: "failed", error: (prediction.error || "This scene could not be made").slice(0, 300) })
            .eq("id", row.id);
          return;
        }

        // Still working — unless it has been working far too long.
        const startedAt = Date.parse((row.created_at || "").replace(" ", "T") + "Z");
        if (Number.isFinite(startedAt) && Date.now() - startedAt > SHOT_TIMEOUT_MS) {
          row.status = "failed";
          await db
            .from("series_shots")
            .update({ status: "failed", error: "This scene timed out" })
            .eq("id", row.id);
        }
      } catch (err) {
        // A provider hiccup must not mark a paid shot as failed.
        console.error(`[SERIES] poll failed for shot ${row.shot_index}:`, err);
      }
    })
  );
}

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
    .select("id, shot_index, status, stage, clip_url, raw_clip_url, image_url, provider_ref, error, created_at")
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
    const { data: series } = await db
      .from("series")
      .select("title")
      .eq("id", seriesId)
      .maybeSingle();

    const assembled = await assembleEpisode(
      episodeId,
      user.id,
      episode.title || `Episode ${episode.episode_number}`,
      series?.title || "Series",
      true
    );
    if (assembled && "videoId" in assembled) {
      episode.video_id = assembled.videoId;
      episode.video_url = assembled.url;
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
