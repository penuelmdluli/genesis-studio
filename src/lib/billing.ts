// ============================================
// GENESIS STUDIO — Plan lifecycle (Yoco one-off payments)
// ============================================
// Yoco checkouts are single card payments, so a "monthly" plan is really a
// 31-day entitlement that the customer renews by paying again. This module
// owns that lifecycle: stamping the expiry when a payment lands, reminding the
// customer before it lapses, and downgrading to free when it does.
//
// Credits are never touched here. A customer keeps every credit they paid
// for; only the plan (model access, monthly grant) reverts.

import { getDb } from "@/lib/db-driver";
import { updateUserPlan } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { sendPlanExpiringEmail, sendPlanExpiredEmail } from "@/lib/email";
import { sendSlackAlert } from "@/lib/alerts";

export const PLAN_PERIOD_DAYS = 31;
const REMINDER_DAYS_BEFORE = 3;

export function nextPeriodEnd(from: Date = new Date()): string {
  return new Date(from.getTime() + PLAN_PERIOD_DAYS * 86_400_000).toISOString();
}

interface LapsingUser {
  id: string;
  clerk_id: string;
  email: string;
  name: string;
  plan: string;
  plan_expires_at: string;
}

/**
 * Downgrade every paid plan whose period has ended. Owners are never touched,
 * and neither is anyone without an expiry (grandfathered rows from before
 * this existed — they keep what they have until they next pay).
 */
export async function expireLapsedPlans(): Promise<{ expired: number }> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data } = await db
    .from("users")
    .select("id, clerk_id, email, name, plan, plan_expires_at")
    .neq("plan", "free")
    .lt("plan_expires_at", now)
    .limit(200);

  let expired = 0;
  for (const user of (data || []) as LapsingUser[]) {
    if (!user.plan_expires_at || isOwnerClerkId(user.clerk_id)) continue;
    try {
      await updateUserPlan(user.id, "free");
      await db.from("users").update({ plan_expires_at: null }).eq("id", user.id);
      expired++;
      if (user.email) {
        sendPlanExpiredEmail(user.email, user.name || "Creator", user.plan).catch((err) =>
          console.error("[BILLING] Expired email failed:", err)
        );
      }
      console.log(`[BILLING] Plan lapsed: user ${user.id} ${user.plan} → free`);
    } catch (err) {
      console.error(`[BILLING] Failed to expire plan for ${user.id}:`, err);
    }
  }
  return { expired };
}

/**
 * Remind customers whose plan ends within the next REMINDER_DAYS_BEFORE days.
 * The cron runs once a day and the window is one day wide, so each customer
 * gets exactly one reminder without needing a "reminded" column.
 */
export async function sendRenewalReminders(): Promise<{ reminded: number }> {
  const db = getDb();
  const windowStart = new Date(Date.now() + (REMINDER_DAYS_BEFORE - 1) * 86_400_000).toISOString();
  const windowEnd = new Date(Date.now() + REMINDER_DAYS_BEFORE * 86_400_000).toISOString();
  const { data } = await db
    .from("users")
    .select("id, clerk_id, email, name, plan, plan_expires_at")
    .neq("plan", "free")
    .gte("plan_expires_at", windowStart)
    .lt("plan_expires_at", windowEnd)
    .limit(200);

  let reminded = 0;
  for (const user of (data || []) as LapsingUser[]) {
    if (!user.email || isOwnerClerkId(user.clerk_id)) continue;
    sendPlanExpiringEmail(user.email, user.name || "Creator", user.plan, user.plan_expires_at).catch(
      (err) => console.error("[BILLING] Reminder email failed:", err)
    );
    reminded++;
  }
  return { reminded };
}

/**
 * The generation engine is prepaid. When its balance runs dry every
 * generation fails and is refunded, which looks to a customer like a broken
 * product. Warn the operator well before that point.
 */
export async function checkEngineBalance(thresholdUsd = 10): Promise<{ balanceUsd: number | null }> {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) return { balanceUsd: null };
  try {
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { balanceUsd: null };
    const json = (await res.json()) as { data?: { balance?: number } };
    const balance = json.data?.balance ?? 0;
    if (balance < thresholdUsd) {
      await sendSlackAlert({
        level: balance < 2 ? "critical" : "warning",
        title: balance < 2 ? "Video engine balance EXHAUSTED" : "Video engine balance low",
        message: `Prepaid balance is $${balance.toFixed(2)} (alert threshold $${thresholdUsd}). Every generation fails once it hits $0 — top up now.`,
      }).catch(() => {});
    }
    return { balanceUsd: balance };
  } catch {
    return { balanceUsd: null };
  }
}
