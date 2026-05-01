# Remediation Plan — 2026-05-01

## P0 (Blockers — production broken or unsafe)

| # | Issue | Phase | Est. |
|---|---|---|---|
| P0-1 | Dev routes accessible in production (gated by CRON_SECRET but should 404) | D.1 | 15m |
| P0-2 | Stripe keys need verification (may be placeholder) | D.2 | 10m |
| P0-3 | Recovery branch files reverted on main (proxy.ts, sample-prompts, etc.) | C | Done |

## P1 (Critical — real user hits within a week)

| # | Issue | Phase | Est. |
|---|---|---|---|
| P1-1 | No CI/CD pipeline — broken code can ship to production | J | 30m |
| P1-2 | No error tracking (Sentry) — errors are invisible | H | 20m |
| P1-3 | No structured logging — debugging is impossible | H | 20m |
| P1-4 | Credit operations not atomic — race condition risk | F | 30m |
| P1-5 | No retry helper for external API calls | F | 15m |
| P1-6 | RunPod Wan 2.2 endpoint unhealthy — jobs time out | G | 10m |
| P1-7 | Intelligence/Edit pages have no backend — confusing UX | P | 10m |
| P1-8 | Hero poster preload warning on every non-landing page | I | 5m |

## P2 (Important — quality and trust)

| # | Issue | Phase | Est. |
|---|---|---|---|
| P2-1 | No E2E test suite | K | 2h |
| P2-2 | No status page | E/H | 15m |
| P2-3 | No FAQ/help center | N | 30m |
| P2-4 | No architecture documentation | O | 20m |
| P2-5 | No runbooks | O | 1h |
| P2-6 | DKIM/SPF/DMARC not verified | E | 15m |
| P2-7 | No data export verification | M | 15m |
| P2-8 | Unused deps (postgres, jsdom) | cleanup | 5m |
| P2-9 | CSP report-uri missing | D | 5m |

## P3 (Polish)

| # | Issue | Phase | Est. |
|---|---|---|---|
| P3-1 | Lighthouse audit needed | I | 20m |
| P3-2 | axe-core accessibility audit | P | 15m |
| P3-3 | Currency detection by geo | L | 15m |
| P3-4 | Low-bandwidth mode | I | 20m |

## Execution order:
P0-1 → P0-2 → P1-1 → P1-8 → P1-7 → P1-5 → P1-2 → P1-3 → P1-4 → P2-8 → P2-1 (partial) → docs
