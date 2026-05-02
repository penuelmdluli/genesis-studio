# Payment Decline Troubleshooting

## Common SA Card Decline Reasons

| Code | Meaning | User Action |
|---|---|---|
| OR_PMCR_58 | Card issuer declined (generic) | Try a different card, or contact your bank |
| OR_PMCR_51 | Insufficient funds | Top up the card and retry |
| OR_PMCR_05 | Do not honour (bank policy) | Contact your bank or use a different card |
| OR_PMCR_14 | Invalid card number | Re-enter card details carefully |
| OR_PMCR_54 | Expired card | Use a non-expired card |
| OR_PMCR_41 | Lost card | Contact your bank |
| OR_PMCR_43 | Stolen card | Contact your bank |
| 3DS_FAILED | 3D Secure authentication failed | Approve the transaction in your banking app when prompted |
| TIMEOUT | Checkout session expired | Start a new checkout — sessions expire after ~15 minutes |

## Diagnosis Steps (for support)

1. **Ask the user:** What error did they see? Did they reach the Yoco page? Did Google Pay / Apple Pay show an error?
2. **Check the DB:** `select * from webhook_events where provider = 'yoco' order by processed_at desc limit 5` — if empty, the charge was never authorized
3. **Check Yoco Dashboard:** Merchants → Transactions → search by date/amount — look for declined entries
4. **Check Vercel logs:** `vercel logs` → search for `/api/credits/subscribe` or `/api/webhooks/yoco`

## Common Scenarios

### User sees "Payment failed" toast on pricing page
- Yoco redirected to `cancelUrl` with decline
- No charge was made, no credits deducted
- User should try again with a different card

### User completed payment but credits not added
- Check `webhook_events` table for the reference
- If webhook not received: check Yoco Dashboard → Webhooks for failed deliveries → Retry
- If webhook received but credits missing: check `credit_transactions` for the user_id
- Manual fix: grant credits via admin panel or direct DB update

### Google Pay / Apple Pay decline
- `OR_PMCR_58` is the most common — the card behind Google/Apple Pay was declined by the issuing bank
- User should try with a physical card number instead
- Some SA banks don't fully support Google Pay for online payments yet

### International card rejected
- Yoco primarily serves SA market — some international card BINs may be rejected
- Visa/Mastercard from most countries should work
- AMEX support varies
- Alternative: offer USD pricing via Stripe (not yet configured)

## Escalation
- If multiple users report declines on the same day: check Yoco status page
- If Yoco webhooks are consistently failing: see `docs/runbooks/incident-yoco-webhook-failing.md`
- If a user disputes a charge: see `docs/runbooks/procedure-handle-chargeback.md`
