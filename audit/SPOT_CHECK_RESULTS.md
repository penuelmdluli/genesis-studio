# Spot Check Results — 2026-05-01

## 1.1 CI Pipeline
**PASS** — Has push+PR triggers, lint, typecheck, build, test. Node 22 pinned. npm cache. No stubs.

## 1.2 Helpers + Tests
**FLAG: HELPERS_UNTESTED** — `retry.ts` (60 lines) and `idempotency.ts` (116 lines) exist with real logic. BUT no `tests/unit/` directory exists. No test files for either helper.

## 1.3 Runbooks
**PASS** — 20 runbooks, 562 total lines. Some shorter (19-20 lines) but content is Genesis-specific: real R2 URLs, real dashboard paths, actual curl commands with `pub-891668ae91a142968457a5383e993020.r2.dev`, `genesisstudio.app` references. Not generic templates.

## 1.4 Risk Register
**PASS** — 24 pipe rows (22 risks + header + separator). 7 Genesis-specific references (FAL, RunPod, POPIA, Facebook token, cold starts, R2, Clerk).

## 1.5 Coming Soon Banners
**PASS** — Only on Intelligence and Edit pages (intentionally unreleased features) plus a Veo mention in pricing (correct — Veo not yet enabled). No core features hidden behind banners.

## 1.6 Compliance & Tax
**PASS** — COMPLIANCE.md has 11 POPIA/SA-specific mentions including Information Officer, sub-processor list, 72-hour breach notification. TAX.md has 8 SA VAT references including R1M threshold and 15% rate.

## 1.7 Operator Actions
**PASS** — 111 lines, 16 actions documented. Some lack exact dashboard URLs but are actionable (e.g., "Log into Supabase dashboard → Database → Backups"). Adequate for operator to execute.

## 1.8 Architecture Diagram
**FLAG: ARCHITECTURE_NO_DIAGRAM** — Uses ASCII code-block diagram, not Mermaid. The ASCII diagram is readable and covers Next.js, Clerk, Supabase, FAL, RunPod, R2, Stripe, Facebook. Functional but not renderable as a graph.

## 1.9 Production Health
**PASS** — All endpoints responding correctly:
- `/` → 200
- `/api/health` → 200
- `/manifest.webmanifest` → 200
- `/api/videos` → 401 (correct, no auth)
- `/api/jobs` → 401 (correct, no auth)

## Verdict
**PASS with 2 flags to remediate:**
1. `HELPERS_UNTESTED` — Write unit tests for retry.ts and idempotency.ts
2. `ARCHITECTURE_NO_DIAGRAM` — Replace ASCII art with Mermaid diagram

Proceeding to Phase 2.0 remediation, then Bucket A.
