import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { fetchLead, MAX_LEAD_ATTEMPTS } from "@/lib/lead-videos";

// Sweeps up lead videos that were saved but never downloaded.
//
// The page fires the download itself right after a link is added, so this only
// picks up the cases where that could not happen: a link pasted from a phone
// on a bad connection, a tab closed mid-download, or a scraper outage. Without
// it a lead would sit as "pending" forever and quietly not be there on the day
// it was wanted.
//
// Run every 15 minutes via the genesis-cron Worker.

/** A fetch still marked in-flight after this long lost its request. */
const STALE_FETCH_MINUTES = 15;

/** yt-dlp is slow and this shares the Worker's budget with everything else. */
const BATCH_SIZE = 5;

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Release leads whose fetch died mid-flight, so they are eligible below.
  const staleBefore = new Date(Date.now() - STALE_FETCH_MINUTES * 60_000).toISOString();
  const { data: stuck } = await db
    .from("lead_videos")
    .select("id")
    .eq("status", "fetching")
    .lt("updated_at", staleBefore)
    .limit(20);

  for (const row of stuck || []) {
    await db.from("lead_videos").update({ status: "pending" }).eq("id", row.id);
  }

  // Never-fetched leads come first; failures are only retried up to the cap so
  // a permanently dead link (deleted reel, private account) stops costing a
  // scraper call every ten minutes forever.
  const { data: pending } = await db
    .from("lead_videos")
    .select("id, user_id, status, attempts")
    .in("status", ["pending", "failed"])
    .eq("archived", 0)
    .order("created_at", { ascending: true })
    .limit(50);

  const rows = (pending || []) as Array<{
    id: string;
    user_id: string;
    status: string;
    attempts: number | null;
  }>;

  const queue = rows
    .filter((r) => r.status === "pending" || (r.attempts ?? 0) < MAX_LEAD_ATTEMPTS)
    .slice(0, BATCH_SIZE);

  let ready = 0;
  let failed = 0;

  for (const row of queue) {
    try {
      const lead = await fetchLead(row.id, row.user_id);
      if (lead.status === "ready") ready++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`[LEADS CRON] ${row.id} threw:`, err);
    }
  }

  return NextResponse.json({
    released: (stuck || []).length,
    attempted: queue.length,
    ready,
    failed,
  });
}
