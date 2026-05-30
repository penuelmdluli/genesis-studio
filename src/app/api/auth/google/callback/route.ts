import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/auth-custom/google-oauth";
import { createSession, buildSessionCookie } from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";
import { sendWelcomeEmail } from "@/lib/email";
import { sendSlackAlert } from "@/lib/alerts";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";

  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(`${appUrl}/sign-in?error=no_code`);
    }

    // Exchange code for user profile
    const profile = await exchangeGoogleCode(code);
    const db = getDb();

    // Check if user exists by email
    let { data: user } = await db
      .from("users")
      .select("*")
      .eq("email", profile.email.toLowerCase())
      .maybeSingle();

    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      const userId = crypto.randomUUID();
      const clerkId = `google_${profile.googleId}`;

      const { data: newUser, error } = await db.from("users").insert({
        id: userId,
        clerk_id: clerkId,
        email: profile.email.toLowerCase(),
        name: profile.name,
        avatar_url: profile.avatarUrl,
        auth_provider: "google",
        plan: "free",
        credit_balance: 100,
        monthly_credits_used: 0,
        monthly_credits_limit: 100,
      });

      if (error) {
        console.error("[AUTH] Google user creation failed:", error);
        return NextResponse.redirect(`${appUrl}/sign-in?error=creation_failed`);
      }

      user = newUser;

      // Welcome email
      sendWelcomeEmail(profile.email, profile.name).catch((err: unknown) =>
        console.error("[AUTH] Welcome email failed:", err)
      );

      sendSlackAlert({
        level: "info",
        title: "New customer signed up (Google)",
        message: `${profile.name} (${profile.email}) just joined Genesis Studio via Google OAuth.`,
      }).catch(() => {});
    } else if (user.auth_provider === "clerk_legacy" || !user.auth_provider) {
      // Link existing Clerk user to Google auth
      await db
        .from("users")
        .update({
          auth_provider: "google",
          avatar_url: profile.avatarUrl || user.avatar_url,
        })
        .eq("id", user.id);
    }

    // Create session
    const token = await createSession({
      id: user.id as string,
      email: (user.email as string) || profile.email,
      name: (user.name as string) || profile.name,
    });

    const redirectUrl = isNewUser
      ? `${appUrl}/onboarding/first-video`
      : `${appUrl}/dashboard`;

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Set-Cookie", buildSessionCookie(token));

    return response;
  } catch (err) {
    console.error("[AUTH] Google callback error:", err);
    return NextResponse.redirect(`${appUrl}/sign-in?error=oauth_failed`);
  }
}
