// ============================================
// ABUSE DETECTION — device, network and email signals at sign-up
// ============================================
//
// Free credits cost us real generation spend, so one person farming accounts
// is a direct loss. Three independent signals, because any single one is easy
// to defeat:
//
//   device_id   a first-party cookie that outlives logout and new accounts.
//               Beaten by incognito or clearing cookies.
//   ip_prefix   /24 (or /48 on v6), so a phone that reconnects still matches.
//               Beaten by mobile data switching, shared by offices and campuses.
//   fingerprint UA + language + platform. Coarse, and survives cleared cookies.
//
// Any one match on its own can be an innocent household; two together on fresh
// accounts minutes apart is a farm. Signals are recorded on every register and
// login, so accounts keep linking themselves together after the fact.

import { NextRequest } from "next/server";
import { getD1 } from "@/lib/d1";

export const DEVICE_COOKIE = "ivs_did";
/** Accounts allowed per device/network before free credits stop. */
export const FREE_CREDIT_ACCOUNT_LIMIT = 2;
const WINDOW_DAYS = 30;

export interface Signals {
  deviceId: string;
  ip: string;
  ipPrefix: string;
  country: string;
  asn: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string;
}

function clean(v: string | null | undefined, max: number): string {
  return (v || "").toString().slice(0, max);
}

/** /24 for IPv4, /48 for IPv6: the same person reconnecting usually stays inside it. */
export function ipPrefixOf(ip: string): string {
  if (!ip) return "";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::/48";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : "";
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Read the device cookie, or mint one. Returns the value plus a Set-Cookie when new. */
export function deviceCookie(req: NextRequest): { deviceId: string; setCookie: string | null } {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) return { deviceId: existing, setCookie: null };
  const deviceId = crypto.randomUUID();
  // httpOnly so page scripts cannot read or forge it; a year, so a returning
  // farmer is still recognised next week.
  const setCookie = `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  return { deviceId, setCookie };
}

export async function signalsFrom(req: NextRequest, deviceId: string): Promise<Signals> {
  const ip = clean(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), 45);
  const userAgent = clean(req.headers.get("user-agent"), 300);
  const acceptLanguage = clean(req.headers.get("accept-language"), 100);
  let asn = "";
  try {
    const cf = (req as unknown as { cf?: { asn?: number; asOrganization?: string } }).cf;
    if (cf?.asn) asn = `AS${cf.asn}${cf.asOrganization ? ` ${cf.asOrganization}` : ""}`.slice(0, 80);
  } catch {
    // request.cf is not available in every runtime; the other signals still stand.
  }
  return {
    deviceId,
    ip,
    ipPrefix: ipPrefixOf(ip),
    country: clean(req.headers.get("cf-ipcountry"), 4),
    asn,
    userAgent,
    acceptLanguage,
    fingerprint: await sha256(`${userAgent}|${acceptLanguage}|${clean(req.headers.get("sec-ch-ua-platform"), 40)}`),
  };
}

/** Throwaway-looking address: random local part, or a name followed by filler digits. */
export function emailLooksGenerated(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() || "";
  if (local.length < 5) return false;
  const letters = local.replace(/[^a-z]/g, "");
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  // Real words carry vowels; "ncrmk", "jqtvx" and "wguwmerr" do not.
  const vowelStarved = letters.length >= 5 && vowels / letters.length < 0.25;
  const randomWithDigits = /^[a-z]{4,10}\d{3,4}$/.test(local) && vowels / Math.max(1, letters.length) < 0.4;
  return vowelStarved || randomWithDigits;
}

export interface RelatedAccounts {
  byDevice: string[];
  byIp: string[];
  byFingerprint: string[];
}

/** Other accounts that used the same device, network or fingerprint recently. */
export async function relatedAccounts(s: Signals, excludeUserId?: string): Promise<RelatedAccounts> {
  const d1 = getD1();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const pull = async (column: string, value: string): Promise<string[]> => {
    if (!value) return [];
    const { results } = await d1
      .prepare(
        `SELECT DISTINCT user_id FROM signup_signals
          WHERE ${column} = ? AND created_at >= ? AND user_id != ?`
      )
      .bind(value, since, excludeUserId || "")
      .all<{ user_id: string }>();
    return (results || []).map((r) => r.user_id);
  };
  const [byDevice, byIp, byFingerprint] = await Promise.all([
    pull("device_id", s.deviceId),
    pull("ip_prefix", s.ipPrefix),
    pull("fingerprint", s.fingerprint),
  ]);
  return { byDevice, byIp, byFingerprint };
}

export interface Risk {
  score: number;
  reasons: string[];
  /** True when the evidence is strong enough to withhold free credits. */
  denyFreeCredits: boolean;
  /** True when the account should be blocked outright, not merely credit-starved. */
  autoBlock: boolean;
}

export function scoreRisk(s: Signals, email: string, related: RelatedAccounts): Risk {
  const reasons: string[] = [];
  let score = 0;

  const devices = new Set(related.byDevice).size;
  const ips = new Set(related.byIp).size;
  const prints = new Set(related.byFingerprint).size;

  if (devices >= 1) {
    score += 50 * Math.min(devices, 3);
    reasons.push(`${devices} other account${devices > 1 ? "s" : ""} on this device`);
  }
  if (ips >= FREE_CREDIT_ACCOUNT_LIMIT) {
    score += 25 * Math.min(ips, 4);
    reasons.push(`${ips} other accounts on this network`);
  }
  if (prints >= FREE_CREDIT_ACCOUNT_LIMIT && devices === 0) {
    // Same browser build and language, different cookie: cleared storage or incognito.
    score += 20;
    reasons.push(`${prints} other accounts with an identical browser fingerprint`);
  }
  if (emailLooksGenerated(email)) {
    score += 30;
    reasons.push("email address looks machine-generated");
  }
  if (!s.userAgent) {
    score += 20;
    reasons.push("no browser user agent (scripted sign-up)");
  }

  // Blocking is reserved for evidence a household cannot innocently produce:
  // the same device plus a throwaway address, a third account on one device,
  // or a scripted sign-up. A family sharing one phone loses the free credits
  // but keeps the account, and the owner can restore it in one click.
  const autoBlock =
    (devices >= 1 && emailLooksGenerated(email)) ||
    devices >= 2 ||
    (devices >= 1 && !s.userAgent) ||
    score >= 130;

  return { score, reasons, denyFreeCredits: devices >= 1 || score >= 80, autoBlock };
}

export async function recordSignals(
  userId: string,
  event: "register" | "login",
  s: Signals,
  risk?: Risk
): Promise<void> {
  try {
    await getD1()
      .prepare(
        `INSERT INTO signup_signals
           (id, user_id, event, device_id, ip, ip_prefix, country, asn, user_agent, accept_language, fingerprint, risk_score, risk_reasons)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        event,
        s.deviceId,
        s.ip,
        s.ipPrefix,
        s.country,
        s.asn,
        s.userAgent,
        s.acceptLanguage,
        s.fingerprint,
        risk?.score ?? 0,
        risk?.reasons.join("; ") || null
      )
      .run();
  } catch (err) {
    // Never block a sign-up because logging failed.
    console.error("[ABUSE] recordSignals failed:", err);
  }
}
