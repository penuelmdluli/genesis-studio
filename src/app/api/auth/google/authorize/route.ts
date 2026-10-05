import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/auth-custom/google-oauth";

/** Same-site path only, or nothing — never an open redirect. */
function safeNext(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") && v.length <= 512 ? v : null;
}

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const url = getGoogleAuthUrl(state);
    const response = NextResponse.redirect(url);
    // Where to land after Google: carried in a short-lived cookie so a link
    // from an email (e.g. /generate?topup=1) survives the round trip.
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    if (next) {
      response.cookies.set("ivs_next", next, { path: "/", maxAge: 600, httpOnly: true, sameSite: "lax", secure: true });
    }
    return response;
  } catch (err) {
    console.error("[AUTH] Google auth error:", err);
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
    return NextResponse.redirect(`${appUrl}/sign-in?error=oauth_failed`);
  }
}
