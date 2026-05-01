# Procedure: Clear Stuck Jobs

## Symptoms
- Users report "stuck on generating" for >10 minutes
- `/api/jobs?status=processing` shows jobs older than 30 minutes

## Automated Reaper
The `/api/cron/purge-stale` cron (every 6 hours) automatically:
- Fails jobs processing > 30 minutes
- Refunds credits for failed jobs

## Manual Clear
```sql
-- Find stuck jobs
SELECT id, user_id, model_id, status, created_at,
       extract(epoch from now() - created_at)/60 as age_minutes
FROM generation_jobs
WHERE status IN ('queued', 'processing')
  AND created_at < now() - interval '30 minutes'
ORDER BY created_at;

-- Fail and refund (run in Supabase SQL editor)
UPDATE generation_jobs
SET status = 'failed',
    error_message = 'Manually cleared - stuck job',
    completed_at = now()
WHERE id = '<job_id>';
```

Then refund via admin panel or direct DB update to `users.credit_balance`.

## Prevention
- Monitor RunPod endpoint health: `curl -s https://api.runpod.ai/v2/<endpoint>/health -H "Authorization: Bearer $RUNPOD_API_KEY"`
- If workers stuck initializing > 10 min, the endpoint needs a restart in RunPod dashboard
