// Server side of Feature of the Week: what each user already uses, what we
// already sent them, and the pick that follows from both.

import { getDb } from "@/lib/db-driver";
import { pickSpotlight, spotlightById, spotlightWeek, type Spotlight, type UsageSignal } from "@/lib/feature-spotlight";

/** email_sends campaign id for one user's weekly spotlight: "spotlight:2026-09-21:ai-singer". */
export function spotlightCampaign(week: string, featureId: string): string {
  return `spotlight:${week}:${featureId}`;
}

const MODEL_SIGNAL: Record<string, UsageSignal> = {
  "mimic-motion": "motion",
  "ai-singer": "singer",
};

/** Usage signals for many users at once (one query per table). */
export async function usageByUser(userIds?: string[]): Promise<Map<string, Set<UsageSignal>>> {
  const db = getDb();
  const out = new Map<string, Set<UsageSignal>>();
  const add = (u: string, s: UsageSignal) => {
    if (!out.has(u)) out.set(u, new Set());
    out.get(u)!.add(s);
  };

  let jobs = db.from("generation_jobs").select("user_id, model_id, type").eq("status", "completed").limit(20000);
  if (userIds?.length === 1) jobs = jobs.eq("user_id", userIds[0]);
  const { data: jobRows } = await jobs;
  for (const j of (jobRows || []) as Array<{ user_id: string; model_id: string; type: string }>) {
    const signal = MODEL_SIGNAL[j.model_id] || (j.type === "motion" ? "motion" : "generate");
    add(j.user_id, signal);
  }

  let series = db.from("series").select("user_id").limit(20000);
  if (userIds?.length === 1) series = series.eq("user_id", userIds[0]);
  const { data: seriesRows } = await series;
  for (const s of (seriesRows || []) as Array<{ user_id: string }>) add(s.user_id, "series");

  return out;
}

/** Feature ids already emailed, per user, oldest first. */
export async function sentByUser(userId?: string): Promise<Map<string, string[]>> {
  let q = getDb().from("email_sends").select("user_id, campaign, sent_at").like("campaign", "spotlight:%").order("sent_at", { ascending: true }).limit(50000);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const out = new Map<string, string[]>();
  for (const r of (data || []) as Array<{ user_id: string; campaign: string }>) {
    const id = r.campaign.split(":")[2];
    if (!id) continue;
    if (!out.has(r.user_id)) out.set(r.user_id, []);
    out.get(r.user_id)!.push(id);
  }
  return out;
}

/** This week's feature for one signed-in user. */
export async function spotlightForUser(userId: string, now = Date.now()): Promise<{ week: string; spotlight: Spotlight }> {
  const [usage, sent] = await Promise.all([usageByUser([userId]), sentByUser(userId)]);
  const { key } = spotlightWeek(now);
  const alreadySent = sent.get(userId) || [];
  // If this week's email already went out, the popup shows the same feature.
  const { data: weekSend } = await getDb()
    .from("email_sends")
    .select("campaign")
    .eq("user_id", userId)
    .like("campaign", `spotlight:${key}:%`)
    .maybeSingle();
  if (weekSend?.campaign) {
    const id = String(weekSend.campaign).split(":")[2];
    const s = spotlightById(id);
    if (s) return { week: key, spotlight: s };
  }
  return { week: key, spotlight: pickSpotlight({ used: usage.get(userId), alreadySent, now }) };
}
