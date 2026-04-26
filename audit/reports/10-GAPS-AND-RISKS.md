# Genesis Studio — Gaps & Risks

**Audit date:** 2026-04-25

---

## CRITICAL (blocks launch or causes data loss)

### C1. No Rate Limiting on Any API Route
- **Problem:** Zero rate limiting across all 90+ API routes. Any user or bot can hammer expensive endpoints.
- **Evidence:** No rate limiting middleware in `src/middleware.ts` (file doesn't exist). No rate limit headers in responses. `api-budget.ts` exists but enforcement is unclear.
- **Risk:** A single malicious user could trigger thousands of $0.50 Veo 3.1 generations in minutes, costing hundreds in GPU fees.
- **Fix scope:** 1 day — add rate limiting middleware using Clerk user ID + IP-based limits.

### C2. No middleware.ts for Auth Enforcement
- **Problem:** Auth is enforced per-route in individual handlers, not via middleware. Easy to forget on new routes.
- **Evidence:** `src/middleware.ts` does not exist. Dashboard layout uses `useAuth()` client-side, but API routes must check auth individually.
- **Risk:** New API routes could be accidentally deployed without auth. `/api/internal/brain` already has no auth.
- **Fix scope:** 4 hours — create `middleware.ts` with Clerk's `authMiddleware()` protecting `/api/*` and `/dashboard/*`.

### C3. Brain Webhook Has No Auth Verification
- **Problem:** `POST /api/brain/webhook` accepts completion callbacks with no signature verification or secret check.
- **Evidence:** `src/app/api/brain/webhook/route.ts` — no `RUNPOD_WEBHOOK_SECRET` or equivalent check found.
- **Risk:** Anyone who discovers the URL can fake scene completions, corrupt production state, or trigger assembly with malicious video URLs.
- **Fix scope:** 2 hours — add webhook secret verification.

### C4. Dev Routes Exposed in Production
- **Problem:** 12 `/api/dev/*` routes are deployed to production. Several perform expensive operations (posting to Facebook, running analysis, migrations).
- **Evidence:** Routes exist under `src/app/api/dev/` with no production gate beyond ad-hoc owner checks.
- **Risk:** If auth is weak or absent on any dev route, production data could be modified or expensive operations triggered.
- **Fix scope:** 4 hours — add environment check (`VERCEL_ENV !== "production"`) or owner-only gate to all dev routes.

### C5. Free Tier Has No Daily Spend Cap in Dollars
- **Problem:** Free tier has plan limits (5 gens/day, 50 credits/month) but no hard dollar cap. If limits are bypassed via a bug, costs accrue.
- **Evidence:** `PLAN_LIMITS.free.maxGenerationsPerDay = 5` in `profitability.ts:213` — but this is checked in generation route, not enforced globally.
- **Risk:** Low probability but high impact — a credit ledger bug could allow unlimited free generations.
- **Fix scope:** 4 hours — add a global daily spend cap per user enforced at the credit deduction level.

---

## HIGH (will hurt soon after launch)

### H1. No Observability / Structured Logging
- **Problem:** All logging is `console.log/error/warn`. No structured logging, no log aggregation, no tracing.
- **Evidence:** `src/lib/sentry.ts` exists but no evidence of active Sentry integration. No OpenTelemetry. No Datadog/LogDNA.
- **Risk:** When something breaks in production, debugging will be extremely difficult. No alerting on failures.
- **Fix scope:** 1 day — integrate Vercel's built-in logging + Sentry error tracking.

### H2. No Health Check Alerting
- **Problem:** `/api/health` exists but no external monitoring service pings it.
- **Evidence:** No uptime monitoring configuration found.
- **Risk:** Outages could go unnoticed until users report them.
- **Fix scope:** 1 hour — set up BetterUptime/UptimeRobot.

### H3. Facebook Page Tokens May Expire
- **Problem:** 7 Facebook page tokens stored as env vars with no automatic refresh logic.
- **Evidence:** `FB_PAGE_TOKEN_*` vars in `src/lib/intelligence/fb-insights-fetcher.ts:14-20`. No token refresh flow found.
- **Risk:** Tokens expire → content pipeline stops → no auto-posting → engagement drops.
- **Fix scope:** 4 hours — implement token refresh flow or document manual renewal process.

### H4. Assembly State Machine Complexity
- **Problem:** The `AssemblyState` type has 25+ fields tracking a multi-phase state machine in a JSONB column. Any state corruption halts assembly.
- **Evidence:** `src/types/index.ts:505-553` — phases: mmaudio → merge_audio → speed_adjust → concat → compose_audio → sound_premix → mix_final → trim_final → burn_captions → normalize → done.
- **Risk:** Serverless cold starts, timeouts, or concurrent polls could corrupt state. `pollErrorCount` mitigates but doesn't prevent all cases.
- **Fix scope:** 1 week — consider simplifying to local-only assembly (which is already the active path).

### H5. BullMQ/Redis Declared But Unused
- **Problem:** `bullmq` and `ioredis` in package.json but no queue workers exist. This is dead weight.
- **Evidence:** `package.json:24-25`. No queue consumer files found anywhere in the codebase.
- **Risk:** Confusing for new developers. Adds ~2MB to node_modules. `REDIS_URL` env var suggests infrastructure that doesn't exist.
- **Fix scope:** 30 minutes — remove from dependencies, remove REDIS_URL from env.

### H6. Duplicate Migration File
- **Problem:** `20260412_intelligence_tables.sql` appears to be a duplicate of `supabase-migration-intelligence.sql`.
- **Evidence:** Both files exist with similar content.
- **Risk:** Could cause migration errors if both are applied.
- **Fix scope:** 30 minutes — verify and remove the duplicate.

---

## MEDIUM (technical debt that compounds)

### M1. Heroic Single Files
- **Problem:** Several files exceed 500 lines with high complexity.
- **Evidence:**
  - `src/lib/genesis-brain/assembly.ts` — 2,723 lines
  - `src/lib/genesis-brain/audio.ts` — 1,605 lines
  - `src/lib/genesis-brain/orchestrator.ts` — 1,160 lines
  - `src/lib/genesis-brain/planner.ts` — 1,154 lines
  - `src/lib/constants.ts` — 776 lines
- **Risk:** Hard to review, test, and maintain. Bug density increases with file size.
- **Fix scope:** 1 week — extract into focused modules.

### M2. No Integration Tests
- **Problem:** Unit tests exist (vitest) but no integration tests that hit real endpoints or databases.
- **Evidence:** Test files are mocked (`src/__tests__/setup.ts` mocks all env vars).
- **Risk:** Unit tests pass but production breaks (mock/prod divergence).
- **Fix scope:** 1 week — add integration test suite.

### M3. Dead Code: CogVideoX (comingSoon)
- **Problem:** CogVideoX model is registered in constants with `comingSoon: true` but has a RunPod endpoint configured.
- **Evidence:** `src/lib/constants.ts:87` — `comingSoon: true`.
- **Risk:** Low — just clutters the model registry. Could confuse users if the UI shows it.
- **Fix scope:** 15 minutes — remove or hide.

### M4. Dead Code: FAL Assembly Path
- **Problem:** The FAL-based assembly pipeline is disabled behind `if (false as boolean)`.
- **Evidence:** `src/lib/genesis-brain/assembly.ts:99` — explicit dead code.
- **Risk:** 2,600+ lines of assembly code that aren't executed. Maintenance burden.
- **Fix scope:** If local assembly is permanent, remove FAL path. If temporary, document why it's disabled.

### M5. Multiple Payment Integrations Without Unified Testing
- **Problem:** 4 payment processors (Stripe, PayFast, Paystack, Yoco) with independent webhook handlers.
- **Evidence:** Separate webhook routes for each, separate verification logic.
- **Risk:** Edge cases in one processor (duplicate webhooks, partial failures) could leak credits or fail silently.
- **Fix scope:** 1 day — unified payment webhook test suite.

### M6. No CSP Reporting
- **Problem:** Content-Security-Policy is set but has no `report-uri` or `report-to` directive.
- **Evidence:** `next.config.ts:27` — comprehensive CSP but no reporting endpoint.
- **Risk:** CSP violations in production go undetected.
- **Fix scope:** 1 hour — add report-uri endpoint.

---

## LOW (nice-to-haves)

### L1. Footer Links to Potentially Placeholder Pages
- **Evidence:** Footer links to `/docs`, `/tutorials`, `/blog`, `/changelog` — these static pages may have minimal content.
- **Risk:** Bad UX for users who click through to empty pages.

### L2. No Bundle Analysis
- **Evidence:** No bundle analyzer configured. Framer Motion (86KB gzipped) and Zustand store (~5000 lines) could be split.
- **Risk:** Slower page loads, especially on mobile in South Africa (target market).

### L3. `@ffmpeg-installer/ffmpeg` Binary on Vercel
- **Evidence:** `serverExternalPackages` config in `next.config.ts:7` to include FFmpeg binary.
- **Risk:** Serverless function cold starts are slower with large binaries. Memory constraints for long videos.

### L4. South African Load Shedding Feature
- **Evidence:** EskomSePush integration, load shedding banner.
- **Risk:** Very niche feature. If API key expires, banner errors could appear.

### L5. PWA Service Worker
- **Evidence:** `public/sw.js` + `manifest.json` registered.
- **Risk:** If SW caching is misconfigured, users could see stale content.
