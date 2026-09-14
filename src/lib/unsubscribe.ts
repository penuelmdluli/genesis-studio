// ============================================
// One-click unsubscribe for marketing emails
// ============================================
// Every marketing email carries a signed link. Opening it (or a mail app's
// one-click unsubscribe button) records the opt-out without signing in; the
// signature stops anyone opting out someone else by guessing ids.

import { getDb } from "@/lib/db-driver";

function secret(): string {
  return process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "";
}

async function sign(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`unsubscribe:${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(mac)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function unsubscribeUrl(appUrl: string, userId: string): Promise<string> {
  return `${appUrl}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${await sign(userId)}`;
}

export async function verifyUnsubscribeToken(userId: string, token: string): Promise<boolean> {
  if (!userId || !token || !secret()) return false;
  const expected = await sign(userId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function setOptOut(userId: string, optedOut: boolean): Promise<void> {
  const db = getDb();
  if (optedOut) {
    const { data } = await db.from("email_optouts").select("user_id").eq("user_id", userId).maybeSingle();
    if (!data) await db.from("email_optouts").insert({ user_id: userId });
  } else {
    await db.from("email_optouts").delete().eq("user_id", userId);
  }
}

export async function isOptedOut(userId: string): Promise<boolean> {
  const { data } = await getDb().from("email_optouts").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}
