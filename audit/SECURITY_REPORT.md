# Security Report — 2026-05-01

## Summary
- **P0 Issues Found**: 0
- **P1 Issues Found**: 2 (both accepted/mitigated)
- **P2 Issues Found**: 3
- **P3 Issues Found**: 2

## P1 Issues

### 1. CSP allows `unsafe-inline` and `unsafe-eval`
- **Location**: `next.config.ts:26-27`
- **Risk**: Enables potential XSS via script injection
- **Reason**: Required by Clerk authentication library
- **Status**: Accepted — Clerk dependency constraint
- **Mitigation**: All user input is sanitized via zod. No `dangerouslySetInnerHTML` usage found.

### 2. Sentry lazy-load uses `Function()` dynamically
- **Location**: `src/lib/sentry.ts:17`
- **Risk**: Dynamic code execution
- **Status**: Accepted — hardcoded module name, optional dependency
- **Mitigation**: Module name is hardcoded (`@sentry/nextjs`), not user-controlled

## P2 Issues

### 3. No CSP report-uri directive
- **Recommendation**: Add reporting endpoint to detect violations
- **Status**: Documented for future improvement

### 4. Test secrets in `src/__tests__/setup.ts`
- **Values**: Placeholder strings (sk_test_placeholder, etc.)
- **Risk**: Low — not real credentials, only in test files
- **Recommendation**: Move to `.env.test` file

### 5. Dev routes accessible on staging without auth
- **Production**: Returns 404 (verified)
- **Staging**: Requires CRON_SECRET header
- **Status**: Acceptable — production is secure

## P3 Issues

### 6. Source maps
- **Status**: Safe — Next.js 16 defaults to no public source maps
- **Verified**: No `productionBrowserSourceMaps: true` in config

### 7. .env files
- **Status**: Correctly gitignored via `.env*` pattern
- **Verified**: `git ls-files | grep .env` returns empty

## Verification Checks

| Check | Result |
|---|---|
| SQL injection risk | None found — all queries via Supabase SDK |
| dangerouslySetInnerHTML | None found |
| eval() / Function() in app code | Only in Sentry lazy-loader (accepted) |
| .env in git history | Not checked (would need `gitleaks` scan) |
| Dev routes in production | 404 verified via curl |
| Webhook signature verification | Stripe, RunPod, PayFast, Paystack, Yoco — all present |
| HSTS header | Present: max-age=31536000; includeSubDomains |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |

## Recommendations for Operator
1. Run `gitleaks` scan on full git history to check for leaked secrets
2. Set up GitHub secret scanning (free for public repos)
3. Consider Sentry CSP reporting endpoint when Sentry is installed
4. Review Clerk docs for nonce-based CSP alternative to `unsafe-inline`
