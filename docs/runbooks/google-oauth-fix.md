# Google OAuth — Re-enabling Properly

Google OAuth was disabled on 2026-05-02 because the integration was not working
in production. This runbook documents how to fix it correctly.

## Likely Root Cause

Most common reasons Clerk's Google OAuth fails in production:

1. **OAuth consent screen not configured in Google Cloud Console.**
   - Navigate to console.cloud.google.com → APIs & Services → OAuth consent screen
   - App must be in "Testing" or "In production" status
   - Test users must be added if status is "Testing"

2. **Redirect URI mismatch.**
   - Clerk dashboard → SSO Connections → Google → copy the Authorized Redirect URI
   - Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs
   - The URI must match exactly (including trailing slash)

3. **Production domain not added to Google OAuth client.**
   - genesisstudio.app and clerk.genesisstudio.app must be in Authorized JavaScript origins

## Fix Steps

1. Test the OAuth flow on a Clerk preview/test environment first
2. Capture the exact error in Clerk dashboard → Logs
3. Cross-reference against Google Cloud Console → APIs & Services → Credentials
4. Once flow works in test, change `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` to `true` in Vercel
5. Redeploy and test on a real production sign-up

## Verification

A clean Google OAuth flow on a test account, completing in <30 seconds, landing
on the dashboard with a populated user profile.
