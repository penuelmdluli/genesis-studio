# Phase 0 — Bucket A Verification

## 2.1 Production Health
| Endpoint | Expected | Actual |
|---|---|---|
| `/` | 200 | 200 |
| `/api/health` | 200 | 200 |
| `/manifest.webmanifest` | 200 | 200 |
| `/api/videos` | 401 | 401 |
| `/api/jobs` | 401 | 401 |
| `/api/health` JSON | `deps: all ok` | `supabase: ok, r2: ok, fal: ok, runpod: ok` |

## 2.2 Bucket A Code
- Sentry config files present: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `next.config.ts` wrapped with `withSentryConfig`
- Plausible script in `src/app/layout.tsx`
- `useTrack()` hook in `src/hooks/use-track.ts`
- `/status` page at `src/app/(dashboard)/status/page.tsx`
- Security headers upgraded (HSTS 2yr+preload, browsing-topics in Permissions-Policy)
- CSP includes Plausible + Sentry domains

Note: Production is still serving pre-Bucket-A code (version `845db6b`). Main was just pushed with Bucket A merge — Vercel auto-deploy in progress. All code verified present on branch.

## 2.3 Code Quality
- Unit tests: **399 passed** across 17 test files (including retry + idempotency tests)
- TypeScript: clean (0 errors)

## Verdict
**PASS** — proceed to Bucket B. Production endpoints healthy, code complete, tests passing.
