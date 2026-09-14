// ============================================
// GENESIS STUDIO — warn before the video engine runs dry
// ============================================
// Every creator-facing video tool runs on one WaveSpeed account. When its
// balance reaches zero, every one of them stops at once — generation, motion
// control, avatars, Series Studio — and the only sign was a customer hitting
// "temporarily at capacity" and getting refunded.
//
// It reached zero once without anybody noticing until a test happened to
// fail. A balance endpoint already existed, but only answered when somebody
// thought to ask it. This asks every half hour and emails the owner while
// there is still time to top up, not after the tools have gone dark.
//
// Alerts are throttled per level, so a low balance does not send an email
// every thirty minutes for a day.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { notifyOwner, type OwnerSeverity } from "@/lib/owner-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Where the warnings start. A single Series Studio episode costs roughly $3
 * at the provider, so $15 is a handful of episodes of headroom — enough to
 * act on, not so high it cries wolf.
 */
const LOW_USD = 15;

/** How long before the same level may alert again. */
const RESEND_AFTER_MS: Record<OwnerSeverity, number> = {
  info: 24 * 60 * 60 * 1000,
  warning: 6 * 60 * 60 * 1000,
  critical: 2 * 60 * 60 * 1000,
};

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }

  const key = envString("WAVESPEED_API_KEY");
  if (!key) return NextResponse.json({ skipped: "no provider key" });

  let balance: number;
  try {
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return NextResponse.json({ error: `balance check HTTP ${res.status}` }, { status: 502 });
    const json = (await res.json()) as { data?: { balance?: number } };
    balance = Number(json.data?.balance ?? 0);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (balance >= LOW_USD) {
    return NextResponse.json({ balance, ok: true });
  }

  const severity: OwnerSeverity = balance <= 0 ? "critical" : "warning";
  const db = getDb();
  const alertKey = "wavespeed-balance";

  const { data: last } = await db
    .from("ops_alerts")
    .select("last_sent_at, last_level")
    .eq("key", alertKey)
    .maybeSingle();

  const lastAt = last?.last_sent_at ? Date.parse(String(last.last_sent_at).replace(" ", "T") + "Z") : 0;
  // A worse level always gets through immediately; the same level waits.
  const escalated = last?.last_level !== "critical" && severity === "critical";
  if (!escalated && lastAt && Date.now() - lastAt < RESEND_AFTER_MS[severity]) {
    return NextResponse.json({ balance, severity, throttled: true });
  }

  const empty = balance <= 0;
  const sent = await notifyOwner({
    severity,
    subject: empty
      ? "Video tools are DOWN — WaveSpeed balance is $0"
      : `WaveSpeed balance low: $${balance.toFixed(2)}`,
    title: empty ? "Every video tool has stopped" : "Top up soon",
    body: empty
      ? "<p>The WaveSpeed balance has reached <strong>$0</strong>. Generate, Motion Control, AI Avatar, Creator Tools and Series Studio all run on it and are refusing new work right now.</p><p>Customers are being refunded automatically, but nothing they start will complete until the account is topped up.</p>"
      : `<p>The WaveSpeed balance is down to <strong>$${balance.toFixed(2)}</strong>. Every video tool stops the moment it reaches zero.</p><p>A Series Studio episode costs about $3 at the provider, so this is only a few episodes of headroom.</p>`,
    details: [
      ["Balance", `$${balance.toFixed(2)}`],
      ["Warning threshold", `$${LOW_USD}`],
      ["Checked", new Date().toISOString()],
    ],
    ctaLabel: "Top up WaveSpeed",
    ctaHref: "https://wavespeed.ai/dashboard/billing",
  }).catch(() => false);

  const { data: exists } = await db.from("ops_alerts").select("key").eq("key", alertKey).maybeSingle();
  const row = { last_sent_at: sqlNow(), last_level: severity, last_value: balance };
  if (exists) await db.from("ops_alerts").update(row).eq("key", alertKey);
  else await db.from("ops_alerts").insert({ key: alertKey, ...row });

  return NextResponse.json({ balance, severity, alerted: sent });
}
