# Procedure: Deploy to Production

## Normal Deploy (via merge)
1. PR to `main` triggers Vercel auto-deploy
2. Wait for build (~60s)
3. Verify: `curl -s https://genesisstudio.app/api/health | jq .`
4. Check version matches latest commit: `.version` field

## Manual Deploy (hotfix)
```bash
cd genesis-studio
git checkout main && git pull
vercel --prod
```

## Rollback
1. Vercel Dashboard → Deployments → find last-known-good → Promote to Production
2. Or CLI: `vercel rollback`
3. Verify health check returns old version hash
