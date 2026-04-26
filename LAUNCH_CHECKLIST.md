# Genesis Studio Launch Checklist

Target launch: **Thursday 14 May 2026**

## Hardening (DONE)

- [x] Cost circuit breaker — ComfyUI auto-fallback to FAL at $25/day cap
- [x] Generation idempotency — 1-hour dedupe via Upstash Redis
- [x] Rollback runbook — `docs/runbooks/comfyui-rollback.md`
- [x] Upstash Redis — verified PONG + rate limiter working
- [x] Slack alerts — verified with env markers (PROD/PREVIEW/LOCAL)
- [x] Auth proxy — Clerk proxy.ts with public/protected route matcher
- [x] Rate limiting — Upstash distributed + in-memory per-instance
- [x] Daily spend cap — per-user USD cap at credit deduction level
- [x] Dev routes gated — all /api/dev/* return 404 in production
- [x] Intelligence routes — owner-only guard

## Operator-required before launch

### Infrastructure
- [x] Set up Upstash Redis free tier — DONE
- [x] Create Slack alerts channel — DONE
- [ ] Populate `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SLACK_ALERT_WEBHOOK_URL` in **Vercel dashboard** (currently in .env.local only)
- [ ] Set up BetterUptime monitor on `/api/health` (60s interval, alert after 2 failures)
- [ ] Verify `RUNPOD_WEBHOOK_SECRET` is set in production
- [ ] Verify `FAL_KEY` balance > $50
- [ ] Verify `ANTHROPIC_API_KEY` balance > $20
- [ ] Verify `RUNPOD_API_KEY` is active and `RUNPOD_ENDPOINT_WAN22` is online

### Content
- [ ] Generate 6 hero demo videos using Brain Studio with production credentials
- [ ] Verify Explore feed has 10+ published videos for social proof

### Legal
- [ ] Finalise Terms of Service via Termly or lawyer
- [ ] Finalise Privacy Policy with POPIA section (South African law)
- [ ] Finalise Acceptable Use Policy
- [ ] Finalise Refund Policy

### Facebook (internal MBS only)
- [ ] Verify all 7 `FB_PAGE_TOKEN_*` tokens are valid
- [ ] Mint `FB_PAGE_TOKEN_pop_culture_buzz` if still missing

### Database
- [ ] Run row count SQL query (see audit/reports/02-DATA-MODEL.md)
- [ ] Verify Supabase backups enabled (daily, 7-day retention minimum)
- [ ] Verify RLS policies are active on users, videos, generation_jobs tables

### DNS & SSL
- [ ] Custom domain pointed to Vercel
- [ ] SSL certificate active (auto via Vercel)
- [ ] R2 public URL resolves correctly

### Payments
- [ ] Stripe webhook endpoint configured for production domain
- [ ] Stripe price IDs populated for all plans + credit packs
- [ ] Paystack webhook endpoint configured
- [ ] Test end-to-end: sign up > subscribe > generate > cancel

### Marketing
- [ ] Pre-write launch posts: X/Twitter, LinkedIn, Reddit, HN
- [ ] Product Hunt listing prepared
- [ ] Schedule soft launch (friends + beta testers)
- [ ] Schedule public launch (social media push)

### Final smoke test
- [ ] Sign up new account on production > generate first video
- [ ] Run Brain Studio > 6-scene video completes > audio synced
- [ ] Subscribe to Pro via Stripe > credits granted
- [ ] Cancel subscription > plan reverted
- [ ] Test on iPhone Safari + Android Chrome on mobile
- [ ] Verify `/api/health` returns 200
- [ ] Verify hidden features don't appear in sidebar
- [ ] Verify `/api/dev/*` routes return 404 in production
- [ ] Hit rate limit (11 gens in 1 min) > 429 returned
