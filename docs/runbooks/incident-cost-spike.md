# Incident: Cost Spike

## Symptoms
- Slack alert: hourly spend > 3x 7-day average
- FAL.AI or RunPod dashboard shows unexpected charges

## Diagnosis
1. Check `/admin/costs` (or query `cost_daily` view)
2. Identify top user by spend: `select user_id, sum(usd_cost) from cost_ledger where created_at > now() - interval '1 hour' group by user_id order by 2 desc limit 10`
3. Check if user is legitimate or abusing

## Fix
1. If abuse: suspend user in Clerk dashboard
2. If bug: set `GLOBAL_DAILY_USD_CAP=0` to pause all generation temporarily
3. Deploy fix
4. Reset cap: `GLOBAL_DAILY_USD_CAP=50`

## Verification
- Cost rate returns to normal
- Legitimate users can generate again

## Escalation
- If >$100 unexpected: contact FAL.AI/RunPod support for potential refund
