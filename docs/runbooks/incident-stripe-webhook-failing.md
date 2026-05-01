# Incident: Stripe Webhook Failing

## Symptoms
- Users complete checkout but credits not added
- Stripe Dashboard → Webhooks shows failed deliveries
- `webhook_events` table missing recent entries

## Diagnosis
1. Stripe Dashboard → Developers → Webhooks → check delivery status
2. Check Vercel logs for `/api/webhooks/stripe` errors
3. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard signing secret

## Fix
1. If secret mismatch: update `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy
2. If route error: fix code, deploy, then replay failed events from Stripe dashboard
3. Stripe Dashboard → Webhooks → Failed events → Retry all

## Manual Credit Grant (emergency)
```sql
-- In Supabase SQL editor
UPDATE users SET credit_balance = credit_balance + <amount> WHERE id = '<user_id>';
INSERT INTO credit_transactions (user_id, type, amount, balance, description)
VALUES ('<user_id>', 'admin_adjustment', <amount>, 
  (SELECT credit_balance FROM users WHERE id = '<user_id>'),
  'Manual grant — Stripe webhook failure recovery');
```

## Verification
- Stripe shows successful webhook delivery
- User's credit balance updated
- `webhook_events` table has the event recorded
