// ============================================
// GENESIS STUDIO — Weekly growth loop
// ============================================
// Posting once is easy; posting every week is what grows a page. This
// returns the state of the creator's current week from real data — what
// they actually made, captioned and published — plus the single next thing
// worth doing.
//
// It counts videos, not intentions: a checklist you tick yourself is a
// to-do app, and nobody needs another one.

import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { sqlTimestamp } from "@/lib/job-finalizer";

export const dynamic = "force-dynamic";

/** Monday 00:00 in SAST, as the DB stores timestamps. */
function startOfWeek(): Date {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday;
}

export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const db = getDb();
  const weekStart = startOfWeek();
  const since = sqlTimestamp(weekStart);

  const { data: weekVideos } = await db
    .from("videos")
    .select("id, title, created_at, thumbnail_url, url")
    .eq("user_id", user.id)
    .gt("created_at", since)
    .limit(50);

  const made = weekVideos?.length || 0;

  // A caption run leaves a tool job; a branded copy leaves a "(branded)"
  // video. Both are evidence the video was actually finished, not just made.
  const { data: finished } = await db
    .from("generation_jobs")
    .select("id")
    .eq("user_id", user.id)
    .gt("created_at", since)
    .like("prompt", "[tool:%")
    .limit(50);

  const { data: connections } = await db
    .from("social_connections")
    .select("external_id, name")
    .eq("user_id", user.id)
    .eq("provider", "facebook")
    .limit(10);

  const polished = finished?.length || 0;
  const pages = (connections || []).map((c: { external_id: string; name: string | null }) => ({
    id: c.external_id,
    name: c.name,
  }));

  // One next step, chosen from where they actually are.
  let next: { step: string; label: string; href: string; why: string };
  if (made === 0) {
    next = {
      step: "make",
      label: "Make this week's video",
      href: "/dashboard",
      why: "Pick a trending format and make one clip. Everything else follows from having something to post.",
    };
  } else if (polished === 0) {
    next = {
      step: "polish",
      label: "Add sound and captions",
      href: "/gallery",
      why: "Most feeds play on mute. Captions and sound are what turn a clip into something people finish watching.",
    };
  } else if (pages.length === 0) {
    next = {
      step: "connect",
      label: "Connect your Facebook Page",
      href: "/settings",
      why: "Connect once and publishing becomes part of this loop instead of a separate chore.",
    };
  } else {
    next = {
      step: "publish",
      label: "Publish to your Page",
      href: "/gallery",
      why: "Your video is ready. Post it while the trend is still moving.",
    };
  }

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    made,
    polished,
    pages,
    target: 3,
    videos: (weekVideos || []).slice(0, 6),
    next,
  });
}
