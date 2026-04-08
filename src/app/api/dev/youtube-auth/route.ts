/**
 * YouTube OAuth2 Authorization Flow
 *
 * GET /api/dev/youtube-auth — Redirects to Google OAuth consent
 * GET /api/dev/youtube-auth?code=XXX — Exchanges code for refresh token
 *
 * Step 1: Visit /api/dev/youtube-auth to start OAuth flow
 * Step 2: Authorize your Google account
 * Step 3: Copy the refresh_token and add to .env.local as YOUTUBE_REFRESH_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";

const REDIRECT_URI = "http://localhost:3099/api/dev/youtube-auth";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
].join(" ");

export async function GET(req: NextRequest) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env.local first",
      steps: [
        "1. Go to https://console.cloud.google.com",
        "2. Create/select project → Enable YouTube Data API v3",
        "3. Create OAuth 2.0 credentials → Application type: Web application",
        "4. Add redirect URI: " + REDIRECT_URI,
        "5. Copy client_id and client_secret to .env.local",
        "6. Visit this endpoint again",
      ],
    }, { status: 503 });
  }

  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    // Step 1: Redirect to Google OAuth
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return NextResponse.redirect(authUrl.toString());
  }

  // Step 2: Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({
      error: "Token exchange failed",
      details: tokenData,
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Copy the refresh_token below and add it to .env.local as YOUTUBE_REFRESH_TOKEN",
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token?.slice(0, 20) + "...",
    expires_in: tokenData.expires_in,
  });
}
