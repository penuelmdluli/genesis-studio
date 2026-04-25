# Genesis Studio Launch Checklist

Target launch: **Thursday 14 May 2026**

## Operator-required actions before launch

### Infrastructure
- [ ] Set up Upstash Redis free tier, populate `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel
- [ ] Set up BetterUptime monitor on `/api/health` (60s interval, alert after 2 failures)
- [ ] Create Slack alerts channel, populate `SLACK_ALERT_WEBHOOK_URL` in Vercel
- [ ] Verify `BRAIN_WEBHOOK_SECRET` / `RUNPOD_WEBHOOK_SECRET` is set in production
- [ ] Verify `FAL_KEY` balance > $50
- [ ] Verify `ANTHROPIC_API_KEY` balance > $20
- [ ] Verify `RUNPOD_API_KEY` is active and `RUNPOD_ENDPOINT_WAN22` is online

### Content
- [ ] Generate 6 hero demo videos using Brain Studio with production credentials
  - Recommended prompts in `src/lib/sample-prompts.ts` (cape-town, night-city, liquid-gold, savanna, data-center, coffee)
  - Upload to R2 under `marketing/hero-{1-6}.mp4`
- [ ] Verify Explore feed has 10+ published videos for social proof

### Legal
- [ ] Finalise Terms of Service via Termly or lawyer
- [ ] Finalise Privacy Policy with POPIA section (South African law)
- [ ] Finalise Acceptable Use Policy
- [ ] Finalise Refund Policy

### Facebook (internal MBS only — not Genesis customer-facing)
- [ ] Verify all 7 `FB_PAGE_TOKEN_*` tokens are valid
- [ ] Mint `FB_PAGE_TOKEN_pop_culture_buzz` if still missing

### Database
- [ ] Run row count SQL query (see audit/reports/02-DATA-MODEL.md) — verify tables exist
- [ ] Verify Supabase backups enabled (daily, 7-day retention minimum)
- [ ] Verify RLS policies are active on users, videos, generation_jobs tables

### DNS & SSL
- [ ] Custom domain `genesisstudio.ai` or similar pointed to Vercel
- [ ] SSL certificate active (auto via Vercel)
- [ ] R2 public URL (`R2_PUBLIC_URL`) resolves correctly

### Payments
- [ ] Stripe webhook endpoint configured: `https://your-domain/api/webhooks/stripe`
- [ ] Stripe price IDs populated for all 3 monthly + 3 annual + 3 credit pack plans
- [ ] Paystack webhook endpoint configured: `https://your-domain/api/webhooks/paystack`
- [ ] Test end-to-end: sign up → subscribe to Creator → generate video → cancel

### Marketing
- [ ] Pre-write launch posts: X/Twitter, LinkedIn, Reddit r/SideProject, Hacker News
- [ ] Product Hunt listing prepared (submit on launch day)
- [ ] Schedule Day 17 soft launch (friends + beta testers)
- [ ] Schedule Day 19 public launch (social media push)

### Final smoke test
- [ ] Sign up new account on production → generate first video → works
- [ ] Run Brain Studio → 6-scene video completes → audio synced
- [ ] Subscribe to Pro via Stripe → credits granted → plan upgraded
- [ ] Cancel subscription → plan reverted → no further charges
- [ ] Test on iPhone Safari + Android Chrome on mobile network
- [ ] Verify `/api/health` returns 200 with `{"status":"ok"}`
- [ ] Verify hidden features don't appear in sidebar
- [ ] Verify `/api/dev/*` routes return 404 in production
- [ ] Hit rate limit (11 generations in 1 minute) → 429 returned
