# Stop The Bleed — Operator Actions

## URGENT — Do These Now

### 1. Set kill switch in Vercel (1 min)
Vercel → Settings → Environment Variables → Add:
- `AUTOMATION_PAUSED` = `true`
- Environments: Production

This stops ALL cron automation immediately after redeploy.

### 2. Redeploy (1 min)
Either merge this branch to main, or from the current production:
Vercel → Deployments → Latest → Redeploy

### 3. Fix the stuck job for goodnessbaloyiberry2@gmail.com (5 min)

In Supabase SQL Editor:
```sql
-- Fail the stuck job
UPDATE generation_jobs
SET status = 'failed',
    error_message = 'Generation timed out — RunPod endpoint unavailable. Credits refunded.',
    completed_at = NOW()
WHERE id = 'dfca19e5-efe6-4aad-9b7b-0835a5293657';

-- Refund the 40 credits
UPDATE users
SET credit_balance = credit_balance + 40
WHERE id = '9988f09a-71d5-4b7e-a93e-d2af9c59b612';

-- Record the refund in ledger
INSERT INTO credit_transactions (user_id, type, amount, balance, description, job_id)
VALUES (
  '9988f09a-71d5-4b7e-a93e-d2af9c59b612',
  'generation_refund',
  40,
  (SELECT credit_balance FROM users WHERE id = '9988f09a-71d5-4b7e-a93e-d2af9c59b612'),
  'Generation timed out — RunPod Wan 2.2 unavailable. Manual refund.',
  'dfca19e5-efe6-4aad-9b7b-0835a5293657'
);
```

After running: user should have 50 credits (back to signup amount).

### 4. Disable Wan 2.2 from free tier model list (code change — in this branch)
Already done in this branch. Free users can no longer select Wan 2.2 since the endpoint is unreliable.

### 5. Check your local machines (5 min)
- Run `crontab -l` (Mac/Linux) or check Task Scheduler (Windows)
- `pm2 list` if PM2 is installed
- Look for anything calling genesisstudio.app APIs or running genesis-scraper
- Pause/stop anything found

### 6. Consider contacting the real user
goodnessbaloyiberry2@gmail.com had two failed generations in a row (both Wan 2.2 timeouts). After refunding, they'll have 50 credits. A brief personal email would build trust:

> Subject: Your Genesis Studio videos — sorry about the wait
>
> Hi there,
>
> I noticed your video generations ran into our RunPod server being slow today.
> I've refunded your credits (you should see 50 back in your account).
>
> Try generating again — our Seedance model is much faster and should work
> perfectly for your baby dance video idea.
>
> — Sabelo, Genesis Studio

## LATER — Re-enabling Automation Selectively

When ready to re-enable specific crons:
1. Set `AUTOMATION_PAUSED=false` in Vercel
2. OR remove the env var entirely (defaults to not paused)
3. Consider re-enabling only safe crons first (cleanup-storage, purge-stale, dunning)
4. Re-enable MBS/content-pipeline only when you have budget allocated for it
