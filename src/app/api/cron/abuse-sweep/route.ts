// ============================================
// CRON: auto-suspend account farms
// ============================================
// Sign-up blocking only catches accounts made after the device cookie existed.
// This sweep closes the gap: any device that carries several free accounts gets
// every related account suspended, including ones opened before we started
// recording, which link up through analytics backfill and later sign-ins.
//
// Deliberately conservative, because a wrong suspension costs a real customer:
//   • a paying account is never touched (it has bought credits or a plan)
//   • the owner's own accounts are never touched
//   • the first account on a device is left alone — only the extras go
//   • networks alone never trigger a suspension (offices, campuses, one mobile
//     mast can share a /24), they are surfaced in /admin/abuse for a human

import { NextRequest, NextResponse } from "next/server";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { emailLooksGenerated } from "@/lib/signup-signals";
import { sendSlackAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNER_EMAILS = ["mdlulipenuel@gmail.com", "mdlulispm@gmail.com"];

interface Row {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  credit_balance: number;
  suspended: number;
  paid: number;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }
  initCloudflareEnv();
  const d1 = getD1();
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const { results: pairs } = await d1
    .prepare(
      `SELECT device_id, user_id FROM signup_signals
        WHERE device_id IS NOT NULL AND device_id != '' AND created_at >= ?
        GROUP BY device_id, user_id`
    )
    .bind(since)
    .all<{ device_id: string; user_id: string }>();

  const byDevice = new Map<string, string[]>();
  for (const p of pairs || []) {
    const list = byDevice.get(p.device_id) || [];
    if (!list.includes(p.user_id)) list.push(p.user_id);
    byDevice.set(p.device_id, list);
  }

  const suspended: Array<{ device: string; email: string; reason: string }> = [];
  const skipped: string[] = [];

  for (const [device, userIds] of byDevice) {
    if (userIds.length < 2) continue;
    const placeholders = userIds.map(() => "?").join(",");
    const { results: users } = await d1
      .prepare(
        `SELECT u.id, u.email, u.created_at, u.plan, u.credit_balance, COALESCE(u.suspended,0) suspended,
                (SELECT COUNT(*) FROM credit_transactions t
                  WHERE t.user_id = u.id AND t.amount > 0 AND t.type IN ('pack_purchase','subscription_grant')) paid
           FROM users u WHERE u.id IN (${placeholders})`
      )
      .bind(...userIds)
      .all<Row>();

    const rows = (users || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (rows.length < 2) continue;

    const protectedRow = (r: Row) =>
      OWNER_EMAILS.includes((r.email || "").toLowerCase()) || r.paid > 0 || (r.plan && r.plan !== "free");

    // Everything after the oldest account on this device is a duplicate. Only
    // recent ones: an account that has been open for a fortnight without being
    // caught is treated as real, and left to a human on /admin/abuse.
    const recent = (r: Row) => Date.now() - Date.parse(r.created_at) < 14 * 86_400_000;
    const extras = rows.slice(1).filter((r) => !r.suspended && !protectedRow(r) && recent(r));
    if (!extras.length) continue;

    const generated = rows.filter((r) => emailLooksGenerated(r.email || "")).length;
    const times = rows.map((r) => Date.parse(r.created_at)).filter((n) => !Number.isNaN(n));
    const spanHours = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 3_600_000 : 999;

    // A farm signs up in a burst with throwaway addresses. Several accounts on
    // one device spread over months is a household or an owner's own logins, so
    // account count alone never triggers a suspension.
    const isFarm = generated >= 1 || spanHours < 24 || (rows.length >= 4 && spanHours < 24 * 7);
    if (!isFarm) {
      skipped.push(`${device.slice(0, 8)}: ${rows.length} accounts, looks like a shared device`);
      continue;
    }

    const reason = `auto: ${rows.length} accounts on one device${generated ? `, ${generated} random emails` : ""}${spanHours < 24 ? `, within ${spanHours.toFixed(1)}h` : ""}`;
    for (const r of extras) {
      if (!dryRun) {
        await d1
          .prepare(`UPDATE users SET suspended = 1, suspended_reason = ?, credit_balance = 0 WHERE id = ?`)
          .bind(reason.slice(0, 200), r.id)
          .run();
      }
      suspended.push({ device: device.slice(0, 8), email: r.email, reason });
    }
  }

  if (suspended.length && !dryRun) {
    sendSlackAlert({
      level: "warning",
      title: `Auto-suspended ${suspended.length} farmed account${suspended.length > 1 ? "s" : ""}`,
      message:
        suspended.slice(0, 20).map((s) => `${s.email} (device ${s.device})`).join("\n") +
        `\n\nReview or restore: ${process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai"}/admin/abuse`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, dryRun, devicesChecked: byDevice.size, suspended, skipped });
}
