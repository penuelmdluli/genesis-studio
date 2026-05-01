# Incident: Clerk Auth Outage

## Symptoms
- Users cannot log in or sign up
- API routes return 401/403 unexpectedly
- Clerk status page shows degraded/outage (status.clerk.com)

## Diagnosis
1. Check https://status.clerk.com for active incidents
2. Verify from server logs: look for Clerk SDK errors or timeouts
3. Test locally: `curl -I https://api.clerk.com/v1/` — expect 200
4. Check if the issue is regional (test from different locations if possible)

## Fix
- **Cannot fix Clerk itself** — this is a third-party dependency
- Enable maintenance mode banner in the app: set `NEXT_PUBLIC_MAINTENANCE=true` in Vercel env vars and redeploy
- If outage exceeds 1 hour: post status update on social channels
- Existing authenticated sessions (JWT) continue working until token expiry — do NOT invalidate them

## Verification
- Clerk status page returns to "All Systems Operational"
- Test login flow end-to-end in production
- Remove maintenance banner and redeploy
