# Scorecard — Real Evidence (2026-05-01)

Based ONLY on executed verifications, not projections.

| Category | Weight | Score | Evidence |
|---|---|---|---|
| Functional correctness | 12% | 7 | Production health 200. Explore feed works. Video playback via R2 CDN verified. Generation works (Seedance). Auth flow works. Stripe placeholder. |
| Security | 12% | 7 | HSTS present. CSP present. X-Frame-Options DENY. Dev routes 404 in prod (curl verified). Auth redirect on protected routes (E2E verified). Stripe is placeholder. |
| Reliability | 10% | 6 | Retry helper exists (16 unit tests pass). Idempotency exists (6 tests pass). Health endpoint checks 4 deps. Stale job reaper in cron. No atomic credit RPCs yet. |
| Infrastructure & domain | 6% | 7 | R2 public access + CORS verified. CDN migration CSP prepped. DNS/TLS via Vercel. Email via Resend (keys present). DKIM/SPF not verified by mail-tester. |
| Cost control & abuse | 8% | 6 | Per-user daily cap exists (spend-guard). Owner bypass working. No global cap enforcement verified. |
| Observability & alerting | 8% | 6 | Health endpoint returns JSON with 4 dep checks (verified by curl + E2E). Sentry SDK installed but DSN not set (operator action). Slack alerts configured. Plausible script in code. |
| Performance | 7% | 8 | Lighthouse: Landing 85, Pricing 98, Explore 97 (real runs, JSON files in audit/). SEO 100 on all pages. BP 92-100. |
| Data integrity | 6% | 6 | RLS on core tables. Webhook idempotency via `webhook_events` table (code reviewed). Credit ledger exists. No atomic RPC. |
| Test coverage | 7% | 7 | 399 unit tests pass. 55/102 E2E pass, 44 skip (auth-gated), 0 fail. CI pipeline exists. Playwright configured. |
| Compliance & tax | 5% | 7 | Privacy page loads (E2E pass). Terms page loads (E2E pass). Cookie banner works (E2E pass). TAX.md and COMPLIANCE.md written. POPIA IO not named. |
| Customer support & comms | 5% | 5 | Contact page loads (E2E pass). Docs page accessible (E2E pass). FAQ written (docs/FAQ.md). No lifecycle emails verified. |
| Documentation & runbooks | 5% | 9 | 20 runbooks. Architecture with Mermaid. Dev guide. Operator playbook. Risk register (22 risks). All present and Genesis-specific (spot-checked). |
| Accessibility & UX | 4% | 7 | Lighthouse A11y 88-94 (real scores). Coming-soon banners on unreleased features. Mobile tests pass (4/4). |
| Internationalization | 3% | 5 | Pricing shows currency (E2E pass). lang=en set (E2E pass). No "Invalid Date" (E2E pass). No geo-based currency detection. |
| Disaster recovery | 2% | 5 | 5 DR scenarios documented with RTO/RPO. Procedures written. No actual restore drill executed (requires operator). Vercel rollback = 1 click. |

## Weighted Total

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Functional correctness | 12% | 7 | 0.84 |
| Security | 12% | 7 | 0.84 |
| Reliability | 10% | 6 | 0.60 |
| Infrastructure & domain | 6% | 7 | 0.42 |
| Cost control & abuse | 8% | 6 | 0.48 |
| Observability & alerting | 8% | 6 | 0.48 |
| Performance | 7% | 8 | 0.56 |
| Data integrity | 6% | 6 | 0.36 |
| Test coverage | 7% | 7 | 0.49 |
| Compliance & tax | 5% | 7 | 0.35 |
| Customer support & comms | 5% | 5 | 0.25 |
| Documentation & runbooks | 5% | 9 | 0.45 |
| Accessibility & UX | 4% | 7 | 0.28 |
| Internationalization | 3% | 5 | 0.15 |
| Disaster recovery | 2% | 5 | 0.10 |
| **TOTAL** | **100%** | | **6.55 → 65.5/100** |

## Honest Assessment

**Real scorecard: 65.5/100** (baseline was 40.6, delta +24.9)

This is lower than the previous projected 73.3 because:
1. Stripe is placeholder (impacts functional, security, payments scores)
2. Sentry DSN not set (observability lower without real error tracking)
3. Backup drill not executed (DR scored on documentation, not execution)
4. 44 E2E tests skipped (test coverage score capped)
5. No lifecycle emails verified (customer support lower)

## To reach 85/100 — specific actions

| Action | Score Impact | Effort |
|---|---|---|
| Set up Sentry DSN in Vercel | +2 observability | 10 min |
| Set up Stripe (real keys, products, webhook) | +3 functional, +2 security | 30 min |
| Run backup drill (actual PITR restore) | +4 DR | 45 min |
| Create test accounts + run 44 skipped E2E | +2 test coverage | 2 hours + $12 |
| Set up Plausible account | +1 observability | 10 min |
| Verify DKIM/SPF via mail-tester | +1 infrastructure | 15 min |
| Name POPIA IO on privacy page | +0.5 compliance | 5 min |
| **Total** | **+15.5** | **~4 hours** |

65.5 + 15.5 = **81** — still 4 points short of 85. The remaining gap is in reliability (atomic credit RPCs) and customer support (lifecycle emails) — each requiring dedicated development sessions.
