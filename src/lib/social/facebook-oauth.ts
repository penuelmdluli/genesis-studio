// ============================================
// GENESIS STUDIO — Facebook Login for creators' own Pages
// ============================================
// Everything here concerns a CUSTOMER's Facebook Page, not the operator's.
// The operator's pages keep using the hard-coded FB_PAGE_TOKEN_* secrets;
// this is the path that has to survive Meta's App Review, so it follows
// their rules exactly:
//
//   - Page tokens are obtained through Facebook Login with the person's
//     consent, never shared between accounts.
//   - Meta's data-deletion and deauthorize callbacks are honoured, which
//     means we must be able to find and delete a connection by Facebook
//     user id — so that id is stored alongside the page.
//   - A short-lived token is exchanged for a long-lived one immediately;
//     page tokens derived from a long-lived user token do not expire, which
//     is what makes unattended weekly posting possible.
//
// Scopes requested (all require App Review before they work for anyone
// outside the app's own testers):
//   pages_show_list        — list the Pages they admin
//   pages_manage_posts     — publish to a Page
//   pages_read_engagement  — read back views and reactions

import crypto from "crypto";
import { envString } from "@/lib/env";

const GRAPH = "https://graph.facebook.com/v25.0";

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
].join(",");

export function facebookConfigured(): boolean {
  return !!(envString("FACEBOOK_APP_ID") && envString("FACEBOOK_APP_SECRET"));
}

function appId(): string {
  const v = envString("FACEBOOK_APP_ID");
  if (!v) throw new Error("FACEBOOK_APP_ID is not configured");
  return v;
}

function appSecret(): string {
  const v = envString("FACEBOOK_APP_SECRET");
  if (!v) throw new Error("FACEBOOK_APP_SECRET is not configured");
  return v;
}

export function redirectUri(): string {
  const base = envString("NEXT_PUBLIC_APP_URL") || "https://ivideostudio.ai";
  return `${base}/api/auth/facebook/callback`;
}

/** Where to send someone to grant access. `state` is CSRF protection. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(),
    state,
    scope: FACEBOOK_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v25.0/dialog/oauth?${params.toString()}`;
}

/** A state value we can verify came from us without storing anything. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", appSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string, maxAgeMs = 15 * 60 * 1000): string | null {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", appSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  const [userId, ts] = payload.split(".");
  if (!userId || !ts || Date.now() - Number(ts) > maxAgeMs) return null;
  return userId;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

/** Code → long-lived user token → the Pages they administer. */
export async function exchangeCodeForPages(code: string): Promise<{
  facebookUserId: string;
  pages: FacebookPage[];
}> {
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: appId(),
      client_secret: appSecret(),
      redirect_uri: redirectUri(),
      code,
    })}`
  );
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || `Token exchange failed (${tokenRes.status})`);
  }

  // Short-lived tokens last about an hour. Page tokens derived from a
  // long-lived user token do not expire, which is what unattended posting
  // needs — so exchange before reading the page list.
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId(),
      client_secret: appSecret(),
      fb_exchange_token: tokenJson.access_token,
    })}`
  );
  const longJson = (await longRes.json()) as { access_token?: string };
  const userToken = longJson.access_token || tokenJson.access_token;

  const meRes = await fetch(`${GRAPH}/me?fields=id&access_token=${encodeURIComponent(userToken)}`);
  const me = (await meRes.json()) as { id?: string };

  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`
  );
  const pagesJson = (await pagesRes.json()) as { data?: FacebookPage[]; error?: { message: string } };
  if (!pagesRes.ok) {
    throw new Error(pagesJson.error?.message || `Could not read your Pages (${pagesRes.status})`);
  }

  return { facebookUserId: me.id || "", pages: pagesJson.data || [] };
}

/**
 * Meta signs its callbacks. An unverified signed_request must never be
 * acted on — anyone could otherwise delete another account's connections.
 */
export function parseSignedRequest(signed: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signed.split(".");
  if (!encodedSig || !payload) return null;

  const expected = crypto.createHmac("sha256", appSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(encodedSig, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
