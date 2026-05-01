# STATUS — Phase 1 (Clerk production promotion)

**Date:** 2026-05-01
**Outcome:** ✅ Phase 1 server-side complete. End-to-end browser sign-up
verification still pending (requires interactive user action — see below).

## What was wrong

1. **Production was running on the dev Clerk instance.** Both
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the
   Vercel **production** environment were `pk_test_*` / `sk_test_*`,
   pointing at the dev Clerk app `holy.sunbird-10.lcl.dev`. That's why
   the sign-in widget showed "Development mode" and real customer
   sign-ups went into a throwaway pool.
2. **Clerk's allowed_origins for the prod instance was `null`.**
   Without it, Clerk's edge can refuse browser requests from
   `genesisstudio.app` even after DNS is correct.
3. **DNS was actually fine all along.** All 5 CNAMEs
   (`clerk`, `accounts`, `clkmail`, `clk._domainkey`,
   `clk2._domainkey`) were already present on Cloudflare with correct
   targets and `proxied=false` (grey cloud). The mission's "orange
   cloud is the common cause" theory did not apply.
4. **Clerk's verifier was stuck in 0/5 PENDING.** This was the actual
   bottleneck. There is no public REST endpoint to force re-verify;
   the Backend API exposes nothing under `/v1/instance/refresh*` or
   `/v1/domains/{id}/verify`. Polling on its own did nothing.

## What I changed

| Action | How |
|---|---|
| Set `allowed_origins` on Clerk prod instance | `PATCH /v1/instance` → 204 — added `https://genesisstudio.app` and `https://www.genesisstudio.app` |
| Triggered Clerk redeploy of the prod domain | `POST /v1/instance/change_domain` with body `{"home_url":"https://genesisstudio.app","is_secondary":false}` → 202 Accepted. **This appears to be what kicked Clerk's verifier off PENDING.** Within ~10 minutes the dashboard's DNS configuration flipped to **Verified** and the edge started serving 200 instead of Cloudflare's 1014. |
| Replaced Vercel `CLERK_SECRET_KEY` | `pk_test_aG9s…ldiQ` / `sk_test_uwCX…uJyR` → `pk_live_Y2xlcmsuZ2VuZXNpc3N0dWRpby5hcHAk` / `sk_live_D36g…GG9` |
| Replaced Vercel `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | same |
| Redeployed production | `vercel redeploy https://genesisstudio.app` — Build success, alias re-pointed |

No DNS records were modified. No Cloudflare tokens rotated. No code
changed. No data touched.

## What was verified server-side

| Endpoint | Result |
|---|---|
| `GET https://clerk.genesisstudio.app/v1/environment` | **HTTP 200** — returns full Clerk auth config (id `aac_3CukKFGfenay2l96Ba8FgNpj3X1`, identification strategies include `email_address` + `oauth_google`). |
| `GET https://clerk.genesisstudio.app/v1/client?_clerk_session_id=` | **HTTP 200** — session API responsive |
| `GET https://clerk.genesisstudio.app/npm/@clerk/clerk-js@6/dist/clerk.browser.js` | **HTTP 307** (redirect to CDN). SDK loads. |
| `GET https://genesisstudio.app/sign-in` | **HTTP 200** — page renders with `data-clerk-publishable-key="pk_live_Y2xlcmsu..."` and SDK URL `https://clerk.genesisstudio.app/npm/@clerk/clerk-js@6/dist/clerk.browser.js` |

## What still needs human verification (browser-only steps)

The mission's Phase 1 step 4 has four items. I can confirm steps 1–2
machine-side. Steps 3–4 require an interactive browser session that
my Chrome extension is currently disconnected from.

| Step | Status |
|---|---|
| Sign-in page widget loads with prod key | ✅ confirmed via page source |
| Sign-up with throwaway email → user created in prod Clerk | ⏳ **Please test:** open https://genesisstudio.app/sign-in in incognito, complete sign-up. Check at https://dashboard.clerk.com → Genesis Studio → Production → Users that the new user appears. |
| Sign-in with that user → session persists | ⏳ Same session — sign out, sign back in, navigate to dashboard, confirm auth gate passes |
| Hit credit-gated route → Supabase row created | ⏳ Note: this app has **no Clerk webhook**. User rows are created lazily by `GET /api/user/route.ts` on first dashboard load via `getUserByClerkId` + `createUser`. As long as you can load `/dashboard` after signing up, that route runs and inserts the Supabase row. |

## Side notes / things to watch for in the next 24h

1. **`accounts.genesisstudio.app` SSL cert is still pending.** Clerk
   issues two certs: one for `clerk.*` (used by the SDK — already
   working) and one for `accounts.*` (used by the hosted account
   portal at `/accounts.genesisstudio.app`). Frontend API works
   without the second cert, but the **Account Portal** redirect from
   `<UserButton/>` "Manage Account" may 403 until that cert issues
   (typically minutes-to-hours).
2. **Supabase users created in dev Clerk during the outage** still
   have `clerk_user_id` values from the dev instance. They will not
   resolve when those users return and try to sign in via the
   production instance. If anyone signed up at genesisstudio.app
   between the time dev keys went live and now, they need to either
   sign up again with the same email (new prod Clerk user, new row)
   or have their `clerk_user_id` updated manually to the new prod ID.
3. **Vercel still has `STRIPE_*_PRICE_ID` env vars missing** — Yoco
   is the active payment provider per earlier session work. Not
   blocking sign-in.
4. The 10-minute verification gap between `change_domain` 202
   Accepted and the dashboard flipping to Verified is consistent
   with Clerk's allowlisting rollout schedule. Don't be surprised if
   the API still reports `verified: false` for individual cname_targets
   for hours after the edge actually serves 200 — the API is showing
   stale data that lags the actual edge config.

## Rollback

If sign-up fails for any reason, you can roll Vercel back to the
working dev keys and the form will render again (degraded mode):

```bash
vercel env rm CLERK_SECRET_KEY production --yes
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes
printf 'sk_test_uwCX...uJyR' | vercel env add CLERK_SECRET_KEY production
printf 'pk_test_aG9s...ldiQ' | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel redeploy https://genesisstudio.app
```

(Full keys are in `.env.local`.)

## Phase 2 — not executed

Phase 2 (Supabase Auth + Google fallback) was not started. Phase 1
succeeded. Phase 2 stays as a documented contingency if production
Clerk has further issues.
