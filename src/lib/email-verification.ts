// ============================================
// Email verification — free credits wait for a real inbox
// ============================================
// Signed link, no table: the token carries the user id and an expiry, and the
// signature stops anyone verifying an address they do not own. The same HMAC
// shape as the unsubscribe links, which have been in production for months.

const TTL_DAYS = 7;

function secret(): string {
  return process.env.EMAIL_VERIFY_SECRET || process.env.CRON_SECRET || "";
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`verify-email:${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(mac)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verificationUrl(appUrl: string, userId: string): Promise<string> {
  const expires = Date.now() + TTL_DAYS * 86_400_000;
  const token = await sign(`${userId}.${expires}`);
  return `${appUrl}/api/auth/verify-email?u=${encodeURIComponent(userId)}&e=${expires}&t=${token}`;
}

export async function verifyToken(userId: string, expires: string, token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!userId || !expires || !token || !secret()) return { ok: false, reason: "missing" };
  const exp = Number(expires);
  if (!Number.isFinite(exp)) return { ok: false, reason: "malformed" };
  if (Date.now() > exp) return { ok: false, reason: "expired" };

  const expected = await sign(`${userId}.${exp}`);
  if (expected.length !== token.length) return { ok: false, reason: "bad signature" };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, reason: "bad signature" };
}
