// Facebook returns here after the person grants (or denies) access.
// Stores a page token per Page so the weekly loop can publish for them.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db-driver";
import { exchangeCodeForPages, verifyState } from "@/lib/social/facebook-oauth";

export const dynamic = "force-dynamic";

function back(path: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  return NextResponse.redirect(`${base}${path}`);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) return back(`/settings?facebook=denied`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("/settings?facebook=invalid");

  // The state proves this callback belongs to a session we started.
  const userId = verifyState(state);
  if (!userId) return back("/settings?facebook=expired");

  try {
    const { facebookUserId, pages } = await exchangeCodeForPages(code);
    if (pages.length === 0) return back("/settings?facebook=nopages");

    const db = getDb();
    for (const page of pages) {
      // Reconnecting the same Page refreshes its token rather than
      // stacking duplicate rows.
      await db.from("social_connections").delete().eq("user_id", userId).eq("provider", "facebook").eq("external_id", page.id);
      await db.from("social_connections").insert({
        id: randomUUID(),
        user_id: userId,
        provider: "facebook",
        external_id: page.id,
        name: page.name,
        access_token: page.access_token,
        scopes: facebookUserId,
      });
    }

    return back(`/settings?facebook=connected&pages=${pages.length}`);
  } catch (err) {
    console.error("[FACEBOOK] callback failed:", err);
    return back("/settings?facebook=failed");
  }
}
