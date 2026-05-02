# Yoco SA-Specific Edge Cases

## 3DS / Secure Payments
- **Mandatory in SA** — all card payments go through 3D Secure challenge
- Yoco handles this automatically in their hosted checkout
- Webhook delivery may be delayed 30-60s while user completes 3DS
- Code handles this correctly — webhook is async, not dependent on redirect timing

## Currency
- **ZAR only** — Yoco processes in South African Rand
- International users cannot pay via Yoco (will need Stripe or PayPal for USD)
- Current pricing page shows ZAR amounts for all plans
- No multi-currency support yet — future consideration

## Refund Timing
- SA banks take **5-10 business days** for refund processing
- Yoco processes the refund immediately on their side
- User's bank statement shows pending refund
- Set user expectations via email and in-app messaging

## International Cards
- Yoco's default behavior may **reject some international card BINs**
- Visa/Mastercard from most countries should work
- AMEX support depends on Yoco merchant setup
- Document in FAQ: "If your card is rejected, try a different card or contact support"

## Yoco Fee Structure
- Transaction fee: ~2.6% + R1.50 per transaction (verify current rates)
- No monthly fee on standard plan
- Payouts: daily or weekly to SA bank account
- Different from Stripe's 2.9% + $0.30 — slightly cheaper for ZAR transactions

## Load Shedding Considerations
- Yoco's infrastructure is SA-based — may have micro-downtime during severe load shedding
- Webhook retries handle transient failures
- Status page should list Yoco as a monitored component

## Compliance
- Yoco is a **South African company** — simpler POPIA compliance than US-based Stripe
- No cross-border data transfer for payment processing (stays in SA)
- Yoco is PASA-licensed (Payment Association of South Africa)
- PCI DSS compliant — Genesis Studio never touches card numbers

## Chargebacks
- Yoco's chargeback process differs from Stripe's dispute flow
- Notification via email to merchant
- Evidence submission window: 10 business days
- Genesis Studio should auto-suspend account on chargeback notification
- See `docs/runbooks/procedure-handle-chargeback.md`
