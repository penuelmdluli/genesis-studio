# Bucket A — Operator Actions

All code is committed. These are the manual steps to activate each feature.

---

## A1 — Sentry Error Tracking (10 min)

1. Go to https://sentry.io/signup/
2. Sign up (Free plan — 5,000 errors/month)
3. Create project: platform = **Next.js**, name = `genesis-studio-prod`
4. Copy the **DSN** from Settings → Client Keys (DSN)
5. Generate an **Auth Token**: Settings → Account → API → Auth Tokens → Create
   - Scopes: `project:releases`, `project:write`
6. Note your **Org slug** and **Project slug**
7. Add to Vercel → Settings → Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SENTRY_DSN` = `<DSN from step 4>`
   - `SENTRY_AUTH_TOKEN` = `<token from step 5>`
   - `SENTRY_ORG` = `<org slug>`
   - `SENTRY_PROJECT` = `genesis-studio-prod`
8. Redeploy from Vercel dashboard
9. Set up alert: Sentry → Alerts → Create Alert → "First seen" → send to email

---

## A2 — Status Page (15 min)

1. Go to https://instatus.com/signup (Free tier)
2. Create page: name = **Genesis Studio Status**, subdomain = `genesis-studio`
3. Add components:
   - API
   - Video Generation (FAL)
   - Video Generation (RunPod)
   - Authentication (Clerk)
   - Database (Supabase)
   - Storage (R2)
   - Payments (Stripe)
4. Set up monitoring:
   - URL: `https://genesisstudio.app/api/health`
   - Method: GET, Expected: 200
   - Frequency: every 5 minutes
   - Auto-create incident on 2 consecutive failures
5. Subscribe yourself to email updates
6. Post a test incident, then resolve it

An internal `/status` page already exists at `https://genesisstudio.app/status` (shows dep health in real-time).

---

## A3 — Plausible Analytics (10 min)

1. Go to https://plausible.io/register (30-day free trial, then $9/mo for 10k pageviews)
2. Add site: domain = `genesisstudio.app`, timezone = `Africa/Johannesburg`
3. The tracking script is already in the code — it will auto-activate once the domain is registered
4. Set up goals (custom events):
   - `signup_completed`
   - `first_generation_completed`
   - `checkout_completed`
   - `pricing_viewed`
5. Set up funnels:
   - Signup: `signup_started` → `signup_completed` → `first_generation_completed`
   - Revenue: `pricing_viewed` → `checkout_started` → `checkout_completed`
6. Optional: enable weekly email reports

---

## A4 — Email Auth (DKIM/SPF/DMARC) (25 min)

Resend is already configured in the codebase. DNS records needed:

1. Go to Resend dashboard → Domains → `genesisstudio.app`
2. Copy the DNS records Resend provides
3. Add in Cloudflare DNS (all records **DNS-only / grey cloud**, NOT proxied):
   - **SPF**: TXT `@` → `v=spf1 include:_spf.resend.com ~all`
   - **DKIM**: CNAME `resend._domainkey` → `<value from Resend>`
   - **DMARC**: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:dmarc@genesisstudio.app; fo=1`
4. Wait 5-10 min for propagation
5. Click "Verify DNS Records" in Resend → all green
6. Test: Send from the app, then check score at https://www.mail-tester.com/ → target ≥ 9/10

---

## A5 — Security Headers Verification (5 min)

Headers are already set in the code. After deploy:

1. Run: `curl -I https://genesisstudio.app/`
2. Confirm these headers are present:
   - `strict-transport-security: max-age=63072000; includeSubDomains; preload`
   - `content-security-policy` (long value)
   - `x-content-type-options: nosniff`
   - `x-frame-options: DENY`
   - `referrer-policy: strict-origin-when-cross-origin`
   - `permissions-policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
3. Run https://securityheaders.com/?q=genesisstudio.app → target grade **A** or **A+**
4. If any CSP errors in browser console, screenshot and report

---

## Summary

| # | Action | Code Done | Operator Time | Scorecard Impact |
|---|---|---|---|---|
| A1 | Sentry | Yes | 10 min | +3 observability |
| A2 | Status page | Yes | 15 min | +3 observability |
| A3 | Plausible | Yes | 10 min | +2 observability |
| A4 | Email auth | Partial | 25 min | +4 infrastructure |
| A5 | Security headers | Yes | 5 min (verify) | +3 security |
| **Total** | | | **65 min** | **+15 projected** |
