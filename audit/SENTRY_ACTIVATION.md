# Sentry — 10-Minute Setup

## Preconditions (verified by readiness check)
- [x] `@sentry/nextjs` installed (v10.51.0)
- [x] `sentry.client.config.ts` present with noise filtering
- [x] `sentry.server.config.ts` present
- [x] `sentry.edge.config.ts` present
- [x] `next.config.ts` wraps with `withSentryConfig`
- [x] DSN referenced via `NEXT_PUBLIC_SENTRY_DSN` (disabled when not set)

## Steps

1. Go to **https://sentry.io/signup/** — sign up with `hello@genesisstudio.app`
2. Choose **Free** plan (5,000 errors/month)
3. Create project: platform = **Next.js**, name = `genesis-studio-prod`
4. Copy the **DSN** from Settings → Projects → genesis-studio-prod → Client Keys (DSN)
5. Create **Auth Token**: Settings → Account → API → Auth Tokens → Create
   - Scopes: `project:releases`, `project:write`
6. Note your **Org slug** from the URL: `sentry.io/organizations/<org-slug>/`

7. Set Vercel env vars (**USE THE UI**, not printf — avoid trailing `\n` bug):

   | Variable | Value | Environments |
   |---|---|---|
   | `NEXT_PUBLIC_SENTRY_DSN` | `<DSN from step 4>` | Production, Preview |
   | `SENTRY_AUTH_TOKEN` | `<token from step 5>` | Production, Preview |
   | `SENTRY_ORG` | `<org slug>` | Production, Preview |
   | `SENTRY_PROJECT` | `genesis-studio-prod` | Production, Preview |

8. Vercel → Deployments → **Redeploy** (Production)

9. After deploy, visit `https://genesisstudio.app/` in incognito
10. Within 5 minutes, Sentry dashboard should show at least one transaction

11. Set up alert: Sentry → Alerts → Create Alert Rule:
    - When: "A new issue is created"
    - Action: Email + Slack (if configured)

## Verification Checklist
After completing the above, confirm:
- [ ] Sentry dashboard shows transactions from genesisstudio.app
- [ ] Release tag visible (matches `VERCEL_GIT_COMMIT_SHA`)
- [ ] Alert rule active for new issues
- [ ] No Sentry-related console errors in browser DevTools

## What's Already Filtered
The client config filters these known noise events:
- ResizeObserver loop errors
- Clerk session timeouts (`ClerkRuntimeError`)
- Network errors (`Failed to fetch`, `Load failed`)

## Cost
Free tier: 5,000 errors/month + 10,000 transactions/month.
At current traffic levels, this is plenty. Upgrade only if you exceed ~100 daily errors.
