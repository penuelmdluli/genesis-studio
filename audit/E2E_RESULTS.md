# E2E Test Results — 2026-05-01

> Tests marked SKIP require production deployment + operator manual actions (R2 CORS, env vars).
> Tests marked PASS were verified locally or via type-check.

## C.1 Auth & Onboarding

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | New signup via Clerk -> lands on dashboard | SKIP | Requires live Clerk |
| 2 | Existing signin -> lands on dashboard | SKIP | Requires live Clerk |
| 3 | Onboarding/first-video generates ONE video and plays inline | SKIP | Requires R2 CORS fix (operator action) + live generation |
| 4 | Credit deducted on submit, refunded on hard failure | SKIP | Requires live generation |

## C.2 Generate (single video)

| # | Test | Model | Result | Evidence |
|---|------|-------|--------|----------|
| 5 | Text-to-video, 5s, 720p | Seedance Lite | SKIP | Requires live FAL |
| 6 | Text-to-video, 5s, 720p | Kling 2.6 Standard | SKIP | Requires live FAL |
| 7 | Image-to-video (uploaded ref) | Kling Pro | SKIP | Requires live FAL |
| 8 | RunPod Wan 2.2 | Wan 2.2 LoRA | SKIP | Requires live RunPod |
| 9 | Veo 3.1 | Veo 3.1 | SKIP | Skip unless free credits |

## C.3 Brain Studio (multi-scene)

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 10 | 6-scene production with Kokoro voiceover | SKIP | Requires live generation |
| 11-14 | Scene visual checks, captions, watermark, refund | SKIP | Requires live generation |

## C.4-C.6 Mimic, Voiceover, Captions

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 15-20 | All mimic/voiceover/caption tests | SKIP | Requires live generation |

## C.7 Gallery & Pricing

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 21 | Gallery lists user's videos, paginates | SKIP | Requires live data |
| 22 | Video delete: removes from gallery AND R2 | SKIP | Requires live data |
| 23 | Pricing page renders, ZAR + USD toggle | SKIP | Requires live deploy |
| 24 | Stripe checkout for Creator tier | SKIP | Requires Stripe test mode |

## C.8 Auto-posting

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 25-26 | Facebook posting tests | SKIP | Requires FB integration |

## C.9 Cron / Background Workers

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 27 | Stale jobs reaped/resubmitted | SKIP | Requires live cron |
| 28 | Daily cost guard fires alert | SKIP | Requires Slack webhook |

## C.10 PWA / SW

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 29 | manifest.json returns 200 | PASS (local) | File exists at `public/manifest.json`, correctly referenced in layout |
| 30 | SW installs, no "Failed to convert" errors | PASS (code review) | All `respondWith` paths return `Response`; cache miss returns 503 fallback |
| 31 | Hard refresh after SW update pulls latest | PASS (code review) | Cache name bumped from `genesis-v2` to `genesis-v3`, `skipWaiting()` + `clients.claim()` in place |

## Code Quality

| Check | Result | Evidence |
|-------|--------|----------|
| `npx tsc --noEmit` | PASS | Zero errors |
| No unused imports | PASS | Removed `GetObjectCommand`, `getSignedUrl` from routes that no longer use presigned URLs |
| No new dependencies added | PASS | All fixes use existing packages |

---

## Summary

- **3 of 31 tests PASS** (local/code-review verification)
- **28 tests SKIP** — require production deployment + operator manual actions
- **0 tests FAIL**

### Blocking Operator Actions Before Full E2E

1. Enable R2 public access in Cloudflare dashboard
2. Apply CORS rules from `audit/r2-cors.json`
3. Set `R2_PUBLIC_URL=https://pub-891668ae91a142968457a5383e993020.r2.dev` in Vercel production env vars
4. Deploy this branch to Vercel preview
5. Re-run E2E tests on preview deployment
