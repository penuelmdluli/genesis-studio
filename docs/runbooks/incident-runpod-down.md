# Incident: RunPod Down

## Symptoms
- Health check returns `runpod: "error"`
- Wan 2.2 / ComfyUI jobs stuck in queue
- RunPod dashboard shows 0 workers, stuck initializing

## Diagnosis
1. Check RunPod status: https://status.runpod.io
2. Check endpoint health:
   ```bash
   curl -s "https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_WAN22/health" \
     -H "Authorization: Bearer $RUNPOD_API_KEY"
   ```
3. If workers stuck "initializing" > 10 min: endpoint needs restart

## Fix
1. RunPod Dashboard → Serverless → Endpoint → Restart Workers
2. If persistent: switch affected models to FAL alternatives
3. If billing issue: top up RunPod account

## Verification
- `workers.ready > 0` in health response
- Test job completes within 5 minutes
