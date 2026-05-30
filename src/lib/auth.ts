// ============================================
// GENESIS STUDIO — Auth Abstraction Layer
// ============================================
// Custom auth using D1 sessions + JWT tokens.
// Replaces Clerk — all server-side auth flows go through here.

import { cookies, headers } from "next/headers";
import { validateSession, getSessionCookieName } from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";

/**
 * Returns the authenticated user's ID (the clerk_id column for
 * backward compatibility), or null if unauthenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) return null;

    const session = await validateSession(token);
    if (!session) return null;

    // Return the user's clerk_id for backward compatibility with existing DB queries.
    // All existing code does getUserByClerkId(clerkId), so we need to return the
    // clerk_id value stored in the users table.
    const db = getDb();
    const { data: user } = await db
      .from("users")
      .select("clerk_id")
      .eq("id", session.userId)
      .single();

    return user?.clerk_id as string | null;
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user's profile (email, name, avatar).
 * Used only for auto-creating new users on first request.
 * With custom auth, users are created at registration, so this
 * returns the session profile data.
 */
export async function getAuthUserProfile(): Promise<{
  email: string;
  name: string;
  avatarUrl?: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) return null;

    const session = await validateSession(token);
    if (!session) return null;

    // Fetch full profile from DB
    const db = getDb();
    const { data: user } = await db
      .from("users")
      .select("email, name, avatar_url")
      .eq("id", session.userId)
      .single();

    if (!user) return null;

    return {
      email: user.email as string,
      name: user.name as string,
      avatarUrl: user.avatar_url as string | undefined,
    };
  } catch {
    return null;
  }
}
