// ============================================
// GENESIS STUDIO — Session Management
// ============================================
// JWT-based sessions stored in Cloudflare KV.
// Uses Web Crypto for signing — Workers-compatible.

import { getDb } from "@/lib/db-driver";

const SESSION_COOKIE_NAME = "gs_session";
const SESSION_DURATION_DAYS = 7;

// HMAC key for signing session tokens
let _signingKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (_signingKey) return _signingKey;

  const secret = process.env.SESSION_SECRET || process.env.CLERK_SECRET_KEY || "genesis-studio-dev-secret";
  const encoder = new TextEncoder();
  _signingKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return _signingKey;
}

export interface SessionPayload {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  exp: number;
}

/**
 * Create a new session for a user.
 * Returns the session token (to be set as a cookie).
 */
export async function createSession(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  // Store session in D1
  const db = getDb();
  await db.from("sessions").insert({
    id: sessionId,
    user_id: user.id,
    expires_at: expiresAt.toISOString(),
  });

  // Create signed token
  const payload: SessionPayload = {
    sessionId,
    userId: user.id,
    email: user.email,
    name: user.name,
    exp: expiresAt.getTime(),
  };

  return await signToken(payload);
}

/**
 * Validate a session token and return the payload.
 * Returns null if invalid or expired.
 */
export async function validateSession(
  token: string
): Promise<SessionPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Check expiry
  if (Date.now() > payload.exp) {
    // Clean up expired session
    await destroySession(payload.sessionId);
    return null;
  }

  // Verify session still exists in D1
  const db = getDb();
  const { data: session } = await db
    .from("sessions")
    .select("id")
    .eq("id", payload.sessionId)
    .single();

  if (!session) return null;

  return payload;
}

/**
 * Destroy a session (logout).
 */
export async function destroySession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.from("sessions").delete().eq("id", sessionId);
}

/**
 * Get the session cookie name.
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Build Set-Cookie header value for a session token.
 */
export function buildSessionCookie(token: string): string {
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Build Set-Cookie header to clear the session.
 */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// --- Token signing ---

async function signToken(payload: SessionPayload): Promise<string> {
  const key = await getSigningKey();
  const encoder = new TextEncoder();

  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const message = `${header}.${body}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${message}.${sig}`;
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const key = await getSigningKey();
    const encoder = new TextEncoder();
    const message = `${parts[0]}.${parts[1]}`;

    // Decode signature
    const sigBytes = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(message)
    );

    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1])) as SessionPayload;
    return payload;
  } catch {
    return null;
  }
}
