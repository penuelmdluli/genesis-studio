// ============================================
// GENESIS STUDIO — Google OAuth 2.0
// ============================================
// Handles the OAuth authorization code flow with Google.
// Workers-compatible — uses only fetch and Web Crypto.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate the Google OAuth authorization URL.
 * The user is redirected here to sign in with Google.
 */
export function getGoogleAuthUrl(state?: string): string {
  const { clientId, redirectUri } = getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  if (state) params.set("state", state);

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens and user profile.
 */
export async function exchangeGoogleCode(code: string): Promise<{
  email: string;
  name: string;
  avatarUrl?: string;
  googleId: string;
}> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
  };

  // Fetch user profile
  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  const profile = (await profileRes.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
    verified_email?: boolean;
  };

  return {
    email: profile.email,
    name: profile.name || profile.email.split("@")[0],
    avatarUrl: profile.picture,
    googleId: profile.id,
  };
}
