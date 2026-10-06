// ============================================
// SERIES STUDIO — finish episodes nobody is watching
// ============================================
// GET /api/cron/series-progress   (cron secret; every 5 minutes)
//
// An episode used to move forward only while its creator had the page open,
// so anyone who pressed Film and closed the tab came back to shots finished
// at the provider but never collected, or stuck in "retrying" for good.
// This runs the same step the page runs (lib/series/advance.ts) for every
// episode still rendering, or finished but not yet joined.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { isOwnerClerkId } from "@/lib/credits";
import { advanceEpisode, type EpisodeRow } from "@/lib/series/advance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Kept small: each episode polls up to a dozen provider jobs. */
const PER_RUN = 4;

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const { data: rendering } = await db
    .from("series_episodes")
    .select("*")
    .eq("status", "rendering")
    .order("created_at", { ascending: true })
    .limit(PER_RUN);
  const { data: unjoined } = await db
    .from("series_episodes")
    .select("*")
    .eq("status", "completed")
    .is("video_id", null)
    .order("created_at", { ascending: true })
    .limit(PER_RUN);

  const episodes = [...((rendering || []) as EpisodeRow[]), ...((unjoined || []) as EpisodeRow[])].slice(0, PER_RUN);
  const out: Array<{ id: string; status: string; done: number; failed: number; total: number; video: boolean }> = [];

  for (const ep of episodes) {
    try {
      const { data: owner } = await db.from("users").select("clerk_id, plan").eq("id", ep.user_id).maybeSingle();
      const brandMark = !owner || isOwnerClerkId(owner.clerk_id) || owner.plan === "free";
      const r = await advanceEpisode(ep, brandMark);
      out.push({ id: ep.id, status: ep.status, done: r.done, failed: r.failed, total: r.shotRows.length, video: !!ep.video_url });
    } catch (err) {
      console.error(`[SERIES-PROGRESS] ${ep.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ advanced: out.length, episodes: out });
}
