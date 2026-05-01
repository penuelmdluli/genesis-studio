# Production Readiness Scorecard — Final (2026-05-01)

| Category | Weight | Baseline | Final | Delta | Notes |
|---|---|---|---|---|---|
| Functional correctness | 12% | 6 | 7 | +1 | Core generation works via FAL. RunPod still cold but onboarding switched to Seedance. Owner bypass fixed. |
| Security | 12% | 5 | 7 | +2 | Dev routes verified 404 in prod. Auth coverage documented. Secret rotation procedure written. CSP still has unsafe-eval (Clerk-required). |
| Reliability | 10% | 4 | 5 | +1 | Retry helper created. Stale job reaper exists. Atomic credit RPC not yet implemented. |
| Infrastructure & domain | 6% | 6 | 7 | +1 | R2 public access + CORS live. DNS/TLS via Vercel confirmed. Custom CDN domain planned. |
| Cost control & abuse prevention | 8% | 5 | 6 | +1 | Per-user caps exist. Owner bypass working. Cost spike runbook written. Global cap documented. |
| Observability & alerting | 8% | 3 | 5 | +2 | Health endpoint with 4 dep checks. Slack alerts. CI pipeline added. Sentry still recommended (operator action). |
| Performance | 7% | 5 | 6 | +1 | Hero poster preload fixed. Videos served from R2 CDN JNB. Lighthouse audit still needed. |
| Data integrity | 6% | 5 | 5 | 0 | RLS on core tables. Webhook idempotency exists. Atomic credit RPC pending. |
| Test coverage | 7% | 1 | 3 | +2 | CI pipeline with lint + typecheck + build + test. E2E suite not yet written. |
| Compliance & tax | 5% | 3 | 4 | +1 | Privacy/terms pages exist. Tax documentation pending. POPIA partially addressed. |
| Customer support & comms | 5% | 2 | 3 | +1 | Contact page exists. Runbooks for common issues written. FAQ still needed. |
| Documentation & runbooks | 5% | 2 | 7 | +5 | Architecture doc, operator playbook, developer guide, 9 runbooks, risk register (22 risks). |
| Accessibility & UX | 4% | 4 | 4 | 0 | No changes this phase. axe-core audit still needed. |
| Internationalization | 3% | 3 | 3 | 0 | No changes this phase. Geo currency detection still needed. |
| Disaster recovery | 2% | 1 | 2 | +1 | Procedures documented. DR drills not yet executed. |

## Scoring

| Category | Weight | Final Score | Weighted |
|---|---|---|---|
| Functional correctness | 12% | 7 | 0.84 |
| Security | 12% | 7 | 0.84 |
| Reliability | 10% | 5 | 0.50 |
| Infrastructure & domain | 6% | 7 | 0.42 |
| Cost control & abuse prevention | 8% | 6 | 0.48 |
| Observability & alerting | 8% | 5 | 0.40 |
| Performance | 7% | 6 | 0.42 |
| Data integrity | 6% | 5 | 0.30 |
| Test coverage | 7% | 3 | 0.21 |
| Compliance & tax | 5% | 4 | 0.20 |
| Customer support & comms | 5% | 3 | 0.15 |
| Documentation & runbooks | 5% | 7 | 0.35 |
| Accessibility & UX | 4% | 4 | 0.16 |
| Internationalization | 3% | 3 | 0.09 |
| Disaster recovery | 2% | 2 | 0.04 |

**WEIGHTED TOTAL: 54.0 / 100** (up from 40.6 baseline, +13.4 points)

## Gap to 85

Still need +31 points. Biggest opportunities:
1. **Test coverage** (currently 3/10) — full E2E suite would add ~4 points
2. **Reliability** (5/10) — atomic credits + idempotency would add ~2.5 points
3. **Observability** (5/10) — Sentry + structured logging would add ~2 points
4. **Functional correctness** (7/10) — Intelligence/Edit pages need backends or removal
5. **Compliance** (4/10) — POPIA IO, tax docs, cookie banner verification
6. **Customer support** (3/10) — FAQ, lifecycle emails, support flow

## Operator Actions Required to Continue

| # | Action | Impact |
|---|---|---|
| 1 | Install Sentry (free tier) and set SENTRY_DSN env var | +2 observability |
| 2 | Set up status page (BetterStack/Instatus free tier) | +1 observability |
| 3 | Verify Supabase PITR is enabled | +1 DR |
| 4 | Verify Stripe keys are live (not test) | +1 security |
| 5 | Name POPIA Information Officer on privacy page | +1 compliance |
| 6 | Run mail-tester.com on outbound email | +1 infra |
| 7 | Set up branch protection on main (require CI green) | +1 CI/CD |
