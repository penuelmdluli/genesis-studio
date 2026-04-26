# ComfyUI Rollback Runbook

**When to use:** ComfyUI provider is producing errors, broken videos, or runaway costs in production. You need to revert to FAL providers immediately.

**Time to execute:** ~2 minutes.

## Step 1: Disable the provider (30 seconds)

In Vercel:
1. Go to Settings > Environment Variables
2. Find `COMFYUI_PROVIDER_ENABLED`
3. Edit > set to `false` > Save
4. Click "Redeploy" on the latest production deployment

OR via CLI (faster):
```bash
vercel env rm COMFYUI_PROVIDER_ENABLED production
vercel env add COMFYUI_PROVIDER_ENABLED production
# (paste: false)
vercel --prod
```

## Step 2: Verify FAL is taking traffic (60 seconds)

1. Open production app, trigger a generation as a Free or Creator tier user
2. Check Slack `#all-genesis-alerts` for next generation log
3. Confirm log shows `provider: fal` (not `runpod-comfyui`)

## Step 3: Announce rollback (30 seconds)

Post in Slack alerts channel:
> COMFYUI ROLLED BACK at [timestamp]. All tiers now on FAL. Investigating: [one-line reason].

## Step 4: Investigate (no time limit)

Check in this order:
1. Slack alerts for the last 1 hour — what was the error pattern?
2. RunPod endpoint logs: https://runpod.io/console/serverless/[endpoint-id]/logs
3. Supabase `production_scenes` table — query failures by error type:
   ```sql
   SELECT error_message, COUNT(*) FROM production_scenes
   WHERE status = 'failed' AND created_at > NOW() - INTERVAL '2 hours'
   GROUP BY error_message ORDER BY count DESC;
   ```
4. Vercel function logs for `/api/brain/*`

## Step 5: Re-enable when fixed

Same as Step 1 but set `COMFYUI_PROVIDER_ENABLED=true`. Test with a single generation against your own user account before re-announcing in Slack.

## Automatic circuit breaker

If ComfyUI daily spend exceeds `COMFYUI_DAILY_SPEND_CAP_USD` (default $25), the provider router automatically bypasses ComfyUI and routes to FAL until midnight UTC. A Slack alert fires when this happens. No manual intervention needed for cost-related issues.

## Cost recovery (if applicable)

If a bug caused runaway RunPod spend, file support ticket at https://runpod.io/support with:
- Endpoint ID
- Time window of buggy behavior
- Estimated wasted spend
- Workflow JSON that triggered the loop

RunPod has historically refunded clearly-buggy GPU spend within 48h.
