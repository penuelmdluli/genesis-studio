# Incident: FAL.AI Down

## Symptoms
- Health check returns `fal: "error"`
- Generation jobs using Seedance/Kling stay queued indefinitely
- Users see "Generation failed" after timeout

## Diagnosis
1. Check FAL status: https://status.fal.ai
2. Check health: `curl -s https://genesisstudio.app/api/health | jq .deps.fal`
3. Check FAL dashboard for rate limits or billing issues

## Fix
1. If FAL outage: wait. Update status page. Users can try RunPod models (Wan 2.2).
2. If rate limited: reduce concurrency, check per-user caps
3. If billing issue: top up FAL account

## Verification
- Health check returns `fal: "ok"`
- Test generation with Seedance Lite succeeds
