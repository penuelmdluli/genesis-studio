# Yoco Integration Map — 2026-05-01

## Overview
Yoco is the **primary** payment provider for Genesis Studio (South African market, ZAR). PayFast and Paystack are configured as fallbacks. Stripe keys are placeholder — NOT used.

## API Key Validation
- **Key prefix:** `sk_live_` — LIVE mode confirmed
- **API response:** `https://payments.yoco.com/api/checkouts` returns structured error (405) with valid requestId — key is authenticated
- **Webhook secret:** `YOCO_WEBHOOK_SECRET` set with `whsec_*` prefix

## Integration Points

### Files
| File | Purpose |
|---|---|
| `src/lib/payments/yoco.ts` | Yoco provider class — checkout creation, payment verification, webhook handling |
| `src/lib/payments/index.ts` | Provider registry — Yoco is first (highest priority) |
| `src/lib/payments/webhook-handler.ts` | Shared webhook processing — idempotency, amount verification, credit granting |
| `src/lib/payments/payfast.ts` | PayFast fallback provider |
| `src/lib/payments/paystack.ts` | Paystack fallback provider (African markets) |
| `src/app/api/webhooks/yoco/route.ts` | Webhook endpoint — receives Yoco events |
| `src/app/api/credits/buy-pack/route.ts` | Credit pack purchase — creates Yoco checkout |
| `src/app/api/credits/subscribe/route.ts` | Subscription checkout — creates Yoco checkout |
| `src/app/(dashboard)/pricing/page.tsx` | Pricing page — displays ZAR pricing, initiates checkout |

### Env Vars
| Variable | Status | Value (prefix) |
|---|---|---|
| `YOCO_SECRET_KEY` | Live | `sk_live_*` |
| `YOCO_WEBHOOK_SECRET` | Set | `whsec_*` |
| `STRIPE_SECRET_KEY` | Placeholder | `sk_test_placeholder` |
| `STRIPE_WEBHOOK_SECRET` | Placeholder | `whsec_placeholder` |

## Webhook Security Audit

| Check | Status | Evidence |
|---|---|---|
| Signature verification | **PASS** | `crypto.createHmac("sha256", webhookSecret)` at `yoco.ts:99-103` |
| Idempotency | **PASS** | `isDuplicateWebhook()` checks `webhook_events` table at `webhook-handler.ts:26-39` |
| Amount verification | **PASS** | `verifyPaymentAmount()` with 5% tolerance at `webhook-handler.ts:68-103` |
| User existence check | **PASS** | DB lookup before credit grant at `webhook-handler.ts:156-168` |
| Replay protection | **PARTIAL** | Relies on idempotency key, no explicit timestamp check |
| Returns 200 only after durable write | **PASS** | Credits granted + webhook recorded before response |

## Payment Flow
1. User clicks "Subscribe" or "Buy Credits" on pricing page
2. API creates Yoco checkout via `POST /api/checkouts` with amount, successUrl, metadata
3. User redirected to Yoco-hosted checkout page
4. After payment, Yoco redirects to `successUrl` and sends webhook
5. Webhook handler: verify signature → check idempotency → verify amount → grant credits → record event
6. User sees credits in dashboard

## ZAR Pricing
All plans priced in ZAR (South African Rand). Amounts defined in `src/lib/constants.ts` → `PLANS[].priceZAR`.
