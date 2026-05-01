# Production Readiness Scorecard — Baseline (2026-05-01)

| Category | Weight | Score 0-10 | Weighted | Notes |
|---|---|---|---|---|
| Functional correctness | 12% | 6 | 0.72 | Core generation works (FAL). RunPod Wan 2.2 endpoint unhealthy. Onboarding fixed. Some pages lack backends (Intelligence, Edit). |
| Security | 12% | 5 | 0.60 | CSP has unsafe-eval (Clerk-required). Dev routes prod-gated. No secret scanning in CI. No middleware was missing (now fixed). Stripe keys need verification. |
| Reliability | 10% | 4 | 0.40 | No retry helper. No idempotency keys. Credit operations not atomic. Stale job reaper exists (30min timeout). No DLQ for webhooks. |
| Infrastructure & domain | 6% | 6 | 0.36 | Domain live, TLS via Vercel. R2 public access enabled. CORS configured. No custom CDN domain yet. No DKIM/SPF/DMARC verified. |
| Cost control & abuse prevention | 8% | 5 | 0.40 | Per-user daily cap exists (spend-guard). No global daily cap enforcement verified. No anomaly alerts. Owner bypass working. |
| Observability & alerting | 8% | 3 | 0.24 | Health endpoint exists with 4 dep checks. Slack alerts on some events. No Sentry. No structured logging. No status page. No request IDs. |
| Performance | 7% | 5 | 0.35 | Vercel edge deployment. No Lighthouse audit done. No load testing. Videos served from R2 CDN (JNB). Hero poster preload causes warning. |
| Data integrity | 6% | 5 | 0.30 | RLS on core tables. Webhook idempotency table exists. Credit ledger exists. No atomic credit RPCs. Some tables missing RLS. |
| Test coverage | 7% | 1 | 0.07 | Vitest setup exists but minimal tests. No E2E. No CI pipeline. No Playwright. |
| Compliance & tax | 5% | 3 | 0.15 | Privacy/terms pages exist. Cookie consent exists. No DMARC. No data export tested. No POPIA IO named. Tax not documented. |
| Customer support & comms | 5% | 2 | 0.10 | Contact page exists. No support form flow tested. No FAQ. No lifecycle emails verified. Welcome email via Resend configured. |
| Documentation & runbooks | 5% | 2 | 0.10 | README exists. CLAUDE.md/AGENTS.md minimal. No architecture docs. No runbooks. No operator playbook. |
| Accessibility & UX | 4% | 4 | 0.16 | Dark theme. Mobile responsive. No axe-core audit. No skip-to-content. No WCAG audit. |
| Internationalization | 3% | 3 | 0.09 | ZAR pricing via Yoco/PayFast. USD via Stripe. No currency detection by geo. No locale-aware formatting. |
| Disaster recovery | 2% | 1 | 0.02 | Supabase PITR likely enabled (default). No backup verification. No DR drills. No documented RTO/RPO. |

**WEIGHTED TOTAL: 40.6 / 100**

Target: 85/100. Gap: 44.4 points.

## Top priorities to close the gap:
1. **Test coverage** (+6 points possible) — CI + E2E suite
2. **Observability** (+5 points) — Sentry, structured logging, status page
3. **Reliability** (+5 points) — Retry helper, atomic credits, idempotency
4. **Security** (+4 points) — Close dev routes harder, CI secret scanning
5. **Documentation** (+3 points) — Architecture, runbooks, operator playbook
6. **Customer support** (+3 points) — FAQ, lifecycle emails, support flow
