# Bucket B — Operator Actions

## B1 — R2 Custom Domain (15 min)

1. Cloudflare Dashboard → R2 → `genesis-videos` bucket → Settings → Custom Domains → Connect Domain
2. Enter: `cdn.genesisstudio.app`
3. Confirm DNS record shows orange cloud (proxied) — required for R2 custom domains
4. Wait ~3 min for cert provisioning (Status: Pending → Active)
5. Verify: `curl -I https://cdn.genesisstudio.app/<any-known-key>.mp4` returns 200
6. Verify CORS: `curl -I -H "Origin: https://genesisstudio.app" https://cdn.genesisstudio.app/<key>.mp4` shows `Access-Control-Allow-Origin`
7. Update Vercel env var (Production + Preview):
   - `R2_PUBLIC_URL` = `https://cdn.genesisstudio.app`
   - Use Vercel UI directly (avoid printf/echo to prevent trailing `\n`)
8. Redeploy from Vercel dashboard
9. Verify video plays on production from new domain
10. After 24h confirmed working: optionally remove legacy `pub-*.r2.dev` from CSP (not urgent)

CSP already allows `cdn.genesisstudio.app` in `img-src`, `media-src`, and `connect-src`.

## B2 — Stripe Validation (10 min)

1. Run locally: `source .env.local && npx tsx scripts/validate-stripe.ts`
2. Verify output shows:
   - Mode: LIVE (or TEST if intentionally staging)
   - Active prices match what's on the pricing page
   - Webhook endpoint URL is `https://genesisstudio.app/api/webhooks/stripe`
   - Webhook status is "enabled"
3. In Stripe Dashboard → Developers → Webhooks:
   - Confirm endpoint receives events successfully (check recent deliveries)
   - Confirm signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel

## B3 — Supabase Backup Verification (5 min)

1. Supabase Dashboard → Project → Database → Backups
2. Confirm PITR (Point-in-Time Recovery) is enabled
3. Note retention window (should be ≥ 7 days)
4. If PITR requires Pro plan upgrade: document cost and decide

## B4 — Lighthouse (post-deploy, 10 min)

1. Open Chrome DevTools → Lighthouse → Mobile preset
2. Run on: `/`, `/pricing`, `/dashboard`, `/generate`, `/gallery`
3. Capture Performance score for each
4. Target: Landing + Pricing ≥ 90, Dashboard pages ≥ 80
