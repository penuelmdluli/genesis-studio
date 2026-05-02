# Bucket B — Execution Log

## B1 — R2 Custom Domain CSP Prep
Status: Code complete, awaiting operator DNS action
Files changed:
- `next.config.ts` — added `cdn.genesisstudio.app` to CSP `img-src`, `media-src`, `connect-src`
- `next.config.ts` — added `cdn.genesisstudio.app` to images.remotePatterns
Evidence: No hardcoded `pub-891668ae` URLs found in src/ (grep returned empty)

## B2 — Stripe Validation
Status: Code complete
Files changed:
- `scripts/validate-stripe.ts` — validation script for live/test keys, prices, webhooks
Webhook hardening verified:
- Signature verification: present (`constructEvent` at line 44)
- Idempotency: `isStripeEventProcessed()` checks `webhook_events` table before processing
- Handles: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`, `charge.dispute.created`

## B3 — Supabase Backup
Status: Documented, awaiting operator verification
Action: Operator confirms PITR is enabled in Supabase dashboard

## B4 — Lighthouse
Status: Awaiting deploy to run audit
Action: Operator runs Chrome Lighthouse on production pages post-deploy
