# Genesis Studio — E2E Test Results

**Audit date:** 2026-04-25
**Total audit cost:** $0.00 (no live provider tests run)

---

## Test Status

**E2E provider tests were NOT executed during this audit.**

### Reason
Running live provider tests would incur real costs ($3-8 estimated) and the operator should approve these charges before execution. The test scripts are provided below for the operator to run at their discretion.

---

## Provider Test Framework (Ready to Run)

The following tests should be run to validate each integration:

### Video Generation Providers

| Provider | Endpoint | Estimated Cost | Test Script |
|----------|----------|----------------|-------------|
| RunPod Wan 2.2 | `RUNPOD_ENDPOINT_WAN22` | ~$0.06 | `audit/scripts/e2e-test-providers.ts` |
| FAL Kling 2.6 | `fal-ai/kling-video/v2.6/pro/text-to-video` | ~$0.18 | `audit/scripts/e2e-test-providers.ts` |
| FAL Seedance 1.5 | `fal-ai/bytedance/seedance/v1/pro/text-to-video` | ~$0.10 | `audit/scripts/e2e-test-providers.ts` |
| FAL Kling 3.0 | `fal-ai/kling-video/v3/pro/text-to-video` | ~$0.25 | `audit/scripts/e2e-test-providers.ts` |
| FAL Veo 3.1 | `fal-ai/veo3` | ~$0.50 | SKIP (expensive) |

### Audio/TTS Providers

| Provider | Endpoint | Estimated Cost | Test Script |
|----------|----------|----------------|-------------|
| Edge TTS | Local (msedge-tts) | $0.00 | `audit/scripts/e2e-test-tts.ts` |
| FAL ElevenLabs | `fal-ai/elevenlabs/tts/multilingual-v2` | ~$0.01 | `audit/scripts/e2e-test-tts.ts` |
| FAL Kokoro | `fal-ai/kokoro/american-english` | ~$0.01 | `audit/scripts/e2e-test-tts.ts` |

### Storage

| Test | Target | Cost | Script |
|------|--------|------|--------|
| R2 Upload | Cloudflare R2 | $0.00 | `audit/scripts/e2e-test-storage.ts` |
| R2 Verify | Cloudflare R2 | $0.00 | `audit/scripts/e2e-test-storage.ts` |

### Auto-Posting (Dry-Run)

| Platform | Test | Cost | Script |
|----------|------|------|--------|
| Facebook | Token validation | $0.00 | `audit/scripts/e2e-test-auto-posting.ts` |
| YouTube | Token validation | $0.00 | `audit/scripts/e2e-test-auto-posting.ts` |

---

## Code-Level Verification Results

The following was verified by reading code, not by running tests:

### Storage (`persistExternalVideo`)
- **Retry logic**: 3 attempts with exponential backoff (500ms, 1s, 4s) — `src/lib/storage.ts:164-205`
- **Fast-fail on expiry**: Returns immediately on 403/404/410 — `src/lib/storage.ts:174`
- **Size validation**: Rejects files < 5000 bytes — `src/lib/storage.ts:182`
- **Timeout**: 90s hard timeout via AbortController — `src/lib/storage.ts:169`
- **Status: LOOKS CORRECT** in code review

### Credit Deduction
- **Atomic deduction**: Uses `.gte()` filter to prevent double-spend — `src/lib/credits.ts:58`
- **Refund on failure**: Brain Studio refunds credits on assembly failure — `src/lib/genesis-brain/assembly.ts:42-70`
- **Owner bypass**: Owner accounts skip deduction but costs still tracked — `src/lib/credits.ts:15`
- **Status: LOOKS CORRECT** in code review

### Webhook Verification
- **Stripe**: Signature verified via `stripe.webhooks.constructEvent()` — `src/app/api/webhooks/stripe/route.ts:47`
- **RunPod**: `RUNPOD_WEBHOOK_SECRET` checked — `src/app/api/webhooks/runpod/route.ts:13`
- **PayFast**: Signature verification logic present — `src/lib/payments/payfast.ts`
- **Brain webhook**: **NO AUTH VERIFICATION FOUND** — `src/app/api/brain/webhook/route.ts`

---

## Recommended Test Execution Order

1. **R2 Storage test** (free, validates infrastructure)
2. **Edge TTS test** (free, validates local assembly pipeline)
3. **Auto-posting dry-run** (free, validates social tokens)
4. **RunPod Wan 2.2** (~$0.06, validates primary model)
5. **FAL Seedance 1.5** (~$0.10, validates FAL integration)
6. **FAL Kling 2.6** (~$0.18, validates Hollywood tier)

Total estimated cost for recommended tests: **~$0.35**
