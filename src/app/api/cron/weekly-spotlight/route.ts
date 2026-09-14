// ============================================
// Weekly Feature of the Week email
// ============================================
// Triggered every 15 minutes by genesis-cron; does nothing outside the send
// window (Tuesday to Thursday, 10:00–14:00 SAST). Each user gets one email a
// week about the feature they are most likely to want: something new, or
// something they haven't used and haven't been sent before.
//
// Safe to run repeatedly: a send is recorded in email_sends before the next
// user, and a user already sent this week's campaign is skipped. Spends no
// generation credit.
//
//   ?dry=1                 preview who would get what, send nothing
//   ?test=you@example.com  send this week's email to one address now
//   ?force=1               ignore the day/time window (still one per user a week)

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { sendFeatureSpotlightEmail, type SpotlightEmail } from "@/lib/email";
import { pickSpotlight, spotlightSubject, spotlightUrl, spotlightWeek, type Spotlight, type UsageSignal } from "@/lib/feature-spotlight";
import { sentByUser, spotlightCampaign, usageByUser } from "@/lib/spotlight-server";
import { unsubscribeUrl } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const START = process.env.SPOTLIGHT_EMAIL_START || "2026-09-22";
const DAILY_CAP = Number(process.env.SPOTLIGHT_DAILY_CAP || 90);
const BATCH = 35;

function inWindow(now: number): boolean {
  const sast = new Date(now + 2 * 60 * 60 * 1000);
  const day = sast.getUTCDay(); // 2 Tue, 3 Wed, 4 Thu
  const hour = sast.getUTCHours();
  return day >= 2 && day <= 4 && hour >= 10 && hour < 14;
}

type Row = { id: string; email: string; name: string | null; created_at: string };

function buildEmail(appUrl: string, s: Spotlight, week: string, segment: SpotlightEmail["segment"], now: number): SpotlightEmail {
  return {
    subject: spotlightSubject(s, now),
    preheader: s.preheader,
    emoji: s.emoji,
    title: s.title,
    hook: s.hook,
    benefits: s.benefits,
    idea: s.idea,
    cta: s.cta,
    ctaHref: spotlightUrl(appUrl, s, "email", week),
    cost: s.cost,
    poster: s.poster,
    hasVideo: !!s.video,
    segment,
    inviteHref: `${appUrl}/invite?utm_source=ivs&utm_medium=email&utm_campaign=spotlight-${week}&utm_content=invite`,
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const dry = q.get("dry") === "1";
  const test = q.get("test");
  const force = q.get("force") === "1";
  const now = Date.now();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const { key: week } = spotlightWeek(now);
  const db = getDb();

  if (!dry && !test) {
    if (new Date(now).toISOString().slice(0, 10) < START) return NextResponse.json({ skipped: `starts ${START}` });
    if (!force && !inWindow(now)) return NextResponse.json({ skipped: "outside send window", week });
  }

  const [usage, sent] = await Promise.all([usageByUser(), sentByUser()]);
  const { data: sessions } = await db.from("sessions").select("user_id, last_active_at").limit(50000);
  const lastActive = new Map<string, string>();
  for (const s of (sessions || []) as Array<{ user_id: string; last_active_at: string | null }>) {
    const prev = lastActive.get(s.user_id);
    if (s.last_active_at && (!prev || s.last_active_at > prev)) lastActive.set(s.user_id, s.last_active_at);
  }

  const segmentOf = (u: Row): SpotlightEmail["segment"] => {
    const used = usage.get(u.id);
    if (!used || used.size === 0) return "new";
    const seen = lastActive.get(u.id);
    const at = seen ? Date.parse(seen.includes("T") ? seen : `${seen.replace(" ", "T")}Z`) : 0;
    return now - at > 14 * DAY_MS ? "inactive" : "active";
  };
  const pickFor = (u: Row): Spotlight =>
    pickSpotlight({ used: usage.get(u.id) as Set<UsageSignal> | undefined, alreadySent: sent.get(u.id) || [], now });

  // One address, right now.
  if (test) {
    const { data: u } = await db.from("users").select("id, email, name, created_at").eq("email", test).maybeSingle();
    const row: Row = (u as Row) || { id: "test", email: test, name: "Creator", created_at: new Date(now).toISOString() };
    const s = pickFor(row);
    const email = buildEmail(appUrl, s, week, segmentOf(row), now);
    const r = await sendFeatureSpotlightEmail(test, row.name || "Creator", email, await unsubscribeUrl(appUrl, row.id));
    return NextResponse.json({ ...r, test, week, feature: s.id, subject: email.subject, segment: segmentOf(row) });
  }

  const { data: users } = await db.from("users").select("id, email, name, created_at").not("email", "is", null).limit(20000);
  const { data: optouts } = await db.from("email_optouts").select("user_id");
  const out = new Set(((optouts || []) as Array<{ user_id: string }>).map((o) => o.user_id));
  const doneThisWeek = new Set<string>();
  const { data: weekRows } = await db.from("email_sends").select("user_id").like("campaign", `spotlight:${week}:%`).limit(50000);
  for (const r of (weekRows || []) as Array<{ user_id: string }>) doneThisWeek.add(r.user_id);

  const due = ((users || []) as Row[]).filter(
    (u) =>
      u.email &&
      !out.has(u.id) &&
      !doneThisWeek.has(u.id) &&
      // Brand-new accounts are still in the welcome flow.
      now - Date.parse(u.created_at.includes("T") ? u.created_at : `${u.created_at.replace(" ", "T")}Z`) > 2 * DAY_MS
  );

  if (dry) {
    return NextResponse.json({
      week,
      due: due.length,
      preview: due.slice(0, 50).map((u) => ({ email: u.email, feature: pickFor(u).id, segment: segmentOf(u) })),
    });
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const { data: todayRows } = await db.from("email_sends").select("id").like("campaign", "spotlight:%").gte("sent_at", today).limit(10000);
  let budget = Math.max(0, DAILY_CAP - (todayRows?.length || 0));
  if (budget === 0) return NextResponse.json({ skipped: "daily cap reached", week, remaining: due.length });

  const started = Date.now();
  let sentCount = 0;
  const failures: string[] = [];
  for (const u of due) {
    if (sentCount >= BATCH || budget <= 0 || Date.now() - started > 45_000) break;
    const s = pickFor(u);
    const email = buildEmail(appUrl, s, week, segmentOf(u), now);
    if (sentCount > 0) await new Promise((r) => setTimeout(r, 600));
    let r = await sendFeatureSpotlightEmail(u.email, u.name || "Creator", email, await unsubscribeUrl(appUrl, u.id));
    if (!r.ok && /429|rate/i.test(r.error || "")) {
      await new Promise((res) => setTimeout(res, 1500));
      r = await sendFeatureSpotlightEmail(u.email, u.name || "Creator", email, await unsubscribeUrl(appUrl, u.id));
    }
    if (r.ok) {
      sentCount++;
      budget--;
      await db.from("email_sends").insert({ id: crypto.randomUUID(), user_id: u.id, campaign: spotlightCampaign(week, s.id) });
    } else {
      failures.push(`${u.email}: ${r.error || "unknown"}`);
    }
  }

  return NextResponse.json({ week, sent: sentCount, failures, remaining: Math.max(0, due.length - sentCount) });
}
