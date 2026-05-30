import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/auth-custom/google-oauth";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[AUTH] Google auth error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
    return NextResponse.redirect(`${appUrl}/sign-in?error=oauth_failed`);
  }
}
