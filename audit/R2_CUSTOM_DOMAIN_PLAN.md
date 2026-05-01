# R2 Custom Domain Migration Plan

## Current State
- Videos served from `https://pub-891668ae91a142968457a5383e993020.r2.dev`
- Controlled by `R2_PUBLIC_URL` env var
- CORS configured for genesisstudio.app origin

## Target State
- Videos served from `https://cdn.genesisstudio.app`
- Same R2 bucket, just a nicer URL
- Better branding, shorter URLs, custom cache rules

## Migration Steps

### 1. DNS (Operator — Cloudflare Dashboard)
- R2 → genesis-videos → Settings → Custom Domains → Connect Domain
- Enter: `cdn.genesisstudio.app`
- Ensure DNS record is proxied (orange cloud) — R2 custom domains require this
- Wait for cert provisioning (~2-3 minutes)

### 2. Verify
```bash
curl -I https://cdn.genesisstudio.app/<known-key>.mp4
# Should return 200, Content-Type: video/mp4
```

### 3. Update env var
```bash
vercel env add R2_PUBLIC_URL production --force
# Value: https://cdn.genesisstudio.app
```

### 4. Redeploy
```bash
vercel --prod
```

### 5. Verify end-to-end
- Generate a video
- Check that `<video src>` points to cdn.genesisstudio.app
- Check CORS headers present

## Rollback
If cdn.genesisstudio.app breaks:
1. `vercel env add R2_PUBLIC_URL production --force` → `https://pub-891668ae91a142968457a5383e993020.r2.dev`
2. `vercel --prod`
3. Old URL continues working (R2 public access still enabled)

## Schedule
- Execute during low-traffic window (SA late night / early morning)
- No backfill needed — URLs are env-driven, not stored in DB
- Estimated downtime: 0 (old URL keeps working during transition)
