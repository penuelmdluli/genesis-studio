# ComfyUI Gradual Rollout Runbook

## Rollout Schedule

| Hour | Free Tier % | Creator Tier % | Action |
|------|------------|---------------|--------|
| 0 | 25% | 0% | Set `COMFYUI_FREE_TIER_PERCENTAGE=25` |
| 6 | 50% | 0% | If Slack quiet, set to 50 |
| 12 | 100% | 0% | If Slack quiet, set to 100 |
| 60 | 100% | 100% | If 48h clean, set `COMFYUI_CREATOR_TIER_PERCENTAGE=100` |

## Definition of "Slack Quiet"

ALL three conditions must be true for the prior window:

1. **Zero ERROR alerts** in the window
2. **Fewer than 3 WARN alerts** in the window
3. **Average ComfyUI cost per generation under $0.10**

If ANY condition breaches: **HOLD at current percentage and investigate.**

## How to Check Cost Per Generation

```bash
# In Upstash Redis console or CLI:
GET spend:runpod-comfyui:YYYY-MM-DD
```

Divide the daily spend by the number of ComfyUI generations (check Supabase):
```sql
SELECT COUNT(*) FROM production_scenes
WHERE provider = 'runpod-comfyui'
AND created_at > NOW() - INTERVAL '6 hours';
```

## How to Change Percentage

In Vercel dashboard > Settings > Environment Variables:

1. Edit `COMFYUI_FREE_TIER_PERCENTAGE` (or `COMFYUI_CREATOR_TIER_PERCENTAGE`)
2. Set to new value (25, 50, or 100)
3. Save
4. Redeploy: click "Redeploy" on latest production deployment

Changes take effect immediately on next cold start (~30s).

## How Percentage Routing Works

Uses deterministic MD5 hash of `userId` mod 100. The same user always
gets the same provider at the same percentage. This means:
- No A/B flicker (user doesn't switch between providers between requests)
- Increasing percentage strictly adds users (never removes existing ones)
- 25% → 50% means the original 25% stay on ComfyUI + 25% more join

## Emergency Rollback

Set `COMFYUI_FREE_TIER_PERCENTAGE=0` and `COMFYUI_CREATOR_TIER_PERCENTAGE=0`.
Or set `COMFYUI_PROVIDER_ENABLED=false` to disable entirely.
See `docs/runbooks/comfyui-rollback.md` for full procedure.
