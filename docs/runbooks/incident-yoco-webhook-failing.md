# Incident: Yoco Webhook Failing

## Symptoms
- Users complete checkout but credits not added
- Yoco Dashboard → Webhooks shows failed deliveries
- `webhook_events` table missing recent entries for provider=yoco

## Diagnosis
1. Yoco Dashboard → Developers → Webhooks → check delivery status
2. Check Vercel logs for `/api/webhooks/yoco` errors
3. Verify `YOCO_WEBHOOK_SECRET` matches Yoco dashboard signing secret
4. Check signature computation: HMAC-SHA256 of raw body with webhook secret

## Fix
1. If secret mismatch: update `YOCO_WEBHOOK_SECRET` in Vercel → redeploy
2. If route error: fix code, deploy, then replay failed events from Yoco dashboard
3. Yoco Dashboard → Webhooks → Failed events → Retry

## Manual Credit Grant (emergency)
```sql
UPDATE users SET credit_balance = credit_balance + <amount> WHERE id = '<user_id>';
INSERT INTO credit_transactions (user_id, type, amount, balance, description)
VALUES ('<user_id>', 'admin_adjustment', <amount>,
  (SELECT credit_balance FROM users WHERE id = '<user_id>'),
  'Manual grant — Yoco webhook failure recovery');
```

## Verification
- Yoco shows successful webhook delivery
- User's credit balance updated
- `webhook_events` table has the event recorded (provider=yoco)

## SA-Specific Notes
- Yoco webhooks may have higher latency than Stripe during Eskom load-shedding
- 3DS challenges can delay the webhook by 30-60 seconds (normal)
- SA bank refunds take 5-10 business days — set user expectations
