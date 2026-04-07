import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      const errorDesc = searchParams.get("error_description") || "Unknown error";
      return NextResponse.redirect(
        new URL(`/studio/setup?error=${encodeURIComponent(errorDesc)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

    // Step 1: Exchange code for short-lived token
    const tokenUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${appSecret}` +
      `&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[Studio] Facebook token exchange error:", tokenData.error);
      return NextResponse.redirect(
        new URL(
          `/studio/setup?error=${encodeURIComponent(tokenData.error.message)}`,
          request.url
        )
      );
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange short-lived for long-lived token
    const longTokenUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortLivedToken}`;

    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json();

    if (longTokenData.error) {
      console.error(
        "[Studio] Facebook long-lived token error:",
        longTokenData.error
      );
      return NextResponse.redirect(
        new URL(
          `/studio/setup?error=${encodeURIComponent(longTokenData.error.message)}`,
          request.url
        )
      );
    }

    const longLivedToken = longTokenData.access_token;

    // Step 3: Fetch managed pages
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("[Studio] Facebook pages fetch error:", pagesData.error);
      return NextResponse.redirect(
        new URL(
          `/studio/setup?error=${encodeURIComponent(pagesData.error.message)}`,
          request.url
        )
      );
    }

    const pages: FacebookPage[] = (pagesData.data || []).map(
      (p: { id: string; name: string; access_token: string }) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
      })
    );

    // Redirect to setup page with encoded pages data
    const encodedPages = encodeURIComponent(JSON.stringify(pages));
    return NextResponse.redirect(
      new URL(`/studio/setup?pages=${encodedPages}`, request.url)
    );
  } catch (error) {
    console.error("[Studio] Facebook callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/studio/setup?error=${encodeURIComponent("Internal server error")}`,
        request.url
      )
    );
  }
}
