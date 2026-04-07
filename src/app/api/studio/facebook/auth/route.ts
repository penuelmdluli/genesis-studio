import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

export async function GET() {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!appId || !redirectUri) {
      return NextResponse.json(
        { error: "Facebook app not configured" },
        { status: 500 }
      );
    }

    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_engagement",
      "publish_video",
    ].join(",");

    const oauthUrl =
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;

    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error("[Studio] Facebook auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
