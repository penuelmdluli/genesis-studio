# Incident: R2 Storage Down

## Symptoms
- Videos fail to play (CORS errors or 5xx from R2)
- Health check returns `r2: "error"`
- Uploads fail during generation completion

## Diagnosis
1. Check Cloudflare status: https://cloudflarestatus.com
2. Check R2 health: `curl -sI https://pub-891668ae91a142968457a5383e993020.r2.dev/`
3. Check CORS: `curl -sI -H "Origin: https://genesisstudio.app" https://pub-891668ae91a142968457a5383e993020.r2.dev/<known-key>.mp4 | grep Access-Control`

## Fix
1. If Cloudflare outage: wait. Existing videos in browser cache still work.
2. If CORS broken: re-apply rules from `audit/r2-cors.json` via Cloudflare Dashboard
3. If public access disabled: re-enable via Dashboard → R2 → genesis-videos → Settings → Public Access

## Verification
- `curl -sI https://pub-891668ae91a142968457a5383e993020.r2.dev/<key>.mp4` returns 200
- CORS header present for genesisstudio.app origin
- Video plays in browser
