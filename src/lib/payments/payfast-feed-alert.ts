// ============================================
// GENESIS STUDIO — throttled alert for the PayFast transaction feed
// ============================================
// The reconciliation cron runs every 5 minutes. When PayFast's Transaction
// History API fails, it used to email the owner on EVERY run — dozens of
// "Payment reconciliation is failing" mails a day for one outage.
//
// Since 2026-11-19 PayFast's edge answers every live /transactions/history
// call with a plain HTML "403 Forbidden" page before auth even runs (other
// endpoints on api.payfast.co.za still answer with JSON). That is upstream,
// not our credentials, and ITNs still settle payments.
//
// So: one email when the feed breaks, a reminder at most once a day while it
// stays broken, and one "recovered" email when it works again. State lives
// in ops_alerts (same table as the WaveSpeed balance throttle).

import { getDb } from "@/lib/db-driver";
import { notifyOwner } from "@/lib/owner-notify";

const ALERT_KEY = "payfast-feed";
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** PayFast's edge (not its API) refused the request: an HTML 403 page, not PayFast's JSON. */
export function isUpstreamBlock(msg: string): boolean {
  return /\b403\b/.test(msg) && /<!doctype html|<html|403 forbidden/i.test(msg);
}

async function readState(): Promise<{ lastAt: number; level: string | null }> {
  const { data } = await getDb()
    .from("ops_alerts")
    .select("last_sent_at, last_level")
    .eq("key", ALERT_KEY)
    .maybeSingle();
  const lastAt = data?.last_sent_at ? Date.parse(String(data.last_sent_at).replace(" ", "T") + "Z") : 0;
  return { lastAt: Number.isFinite(lastAt) ? lastAt : 0, level: (data?.last_level as string) ?? null };
}

async function writeState(level: string): Promise<void> {
  const db = getDb();
  const row = { last_sent_at: sqlNow(), last_level: level, last_value: 0 };
  const { data: exists } = await db.from("ops_alerts").select("key").eq("key", ALERT_KEY).maybeSingle();
  if (exists) await db.from("ops_alerts").update(row).eq("key", ALERT_KEY);
  else await db.from("ops_alerts").insert({ key: ALERT_KEY, ...row });
}

/** Call when the feed failed. Emails at most once per 24 h per outage. */
export async function reportPayFastFeedFailure(msg: string): Promise<{ alerted: boolean }> {
  const blocked = isUpstreamBlock(msg);
  const level = blocked ? "blocked" : "failing";
  const state = await readState().catch(() => ({ lastAt: 0, level: null as string | null }));
  const alreadyDown = state.level === "blocked" || state.level === "failing";
  if (alreadyDown && state.lastAt && Date.now() - state.lastAt < REMIND_AFTER_MS) {
    return { alerted: false };
  }

  const short = msg.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  await notifyOwner({
    severity: "warning",
    subject: blocked
      ? "PayFast is blocking its transaction-history API (backup sweep paused)"
      : "PayFast transaction feed is failing (backup sweep paused)",
    title: blocked ? "PayFast history API blocked upstream" : "PayFast transaction feed unreachable",
    body: blocked
      ? "PayFast's edge is returning an HTML <strong>403 Forbidden</strong> page for the Transaction History API. This is on PayFast's side (credentials are never reached) and also affects TradeRadar on the same merchant account.<br><br>Payment notifications (ITN) still credit payments as normal; only the 5-minute backup sweep is paused. Check the PayFast dashboard for any payment that has not been credited. You will get one reminder a day while this lasts, and one email when it recovers."
      : `The 5-minute backup sweep could not read the PayFast transaction history. Payment notifications (ITN) still credit payments; check the PayFast dashboard for anything not credited. You will get one reminder a day while this lasts, and one email when it recovers.<br><br><code>${short}</code>`,
    details: [["Error", short], ["Checked", new Date().toISOString()]],
    ctaLabel: "Open PayFast dashboard",
    ctaHref: "https://my.payfast.io",
  }).catch(() => false);
  await writeState(level).catch(() => {});
  return { alerted: true };
}

/** Call when the feed worked. Sends one "recovered" email after an outage. */
export async function reportPayFastFeedOk(): Promise<void> {
  const state = await readState().catch(() => null);
  if (!state || (state.level !== "blocked" && state.level !== "failing")) return;
  await notifyOwner({
    severity: "info",
    subject: "PayFast transaction feed recovered",
    title: "PayFast backup sweep is running again",
    body: "The Transaction History API answers again, so the 5-minute sweep is settling any payment whose notification was missed.",
  }).catch(() => false);
  await writeState("ok").catch(() => {});
}
