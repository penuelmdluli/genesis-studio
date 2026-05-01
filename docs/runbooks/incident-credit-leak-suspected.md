# Incident: Credit Leak Suspected

## Symptoms
- Users report credits disappearing without matching video output
- `credit_transactions` total debits exceed expected generation count
- Dashboard balance doesn't match SUM of transactions

## Diagnosis
1. Run: `SELECT user_id, SUM(amount) as total_debits FROM credit_transactions WHERE amount < 0 AND created_at > now() - interval '24 hours' GROUP BY user_id ORDER BY total_debits ASC LIMIT 20;`
2. Cross-reference each user's debits with `generation_jobs` — every debit should have a matching job ID
3. Look for orphaned debits: `SELECT ct.* FROM credit_transactions ct LEFT JOIN generation_jobs gj ON ct.job_id = gj.id WHERE ct.amount < 0 AND gj.id IS NULL AND ct.created_at > now() - interval '7 days';`
4. Check for duplicate debits on the same job: `SELECT job_id, COUNT(*) FROM credit_transactions WHERE amount < 0 GROUP BY job_id HAVING COUNT(*) > 1;`

## Fix
- If orphaned debits found: credit affected users back with a `type = 'refund'` transaction
- If duplicate debits: remove the duplicate row and adjust balance
- Deploy a fix to the code path that created the orphan/duplicate

## Verification
- Re-run the orphan and duplicate queries — expect zero rows
- Confirm affected users' balances now match `SUM(amount)` from `credit_transactions`
