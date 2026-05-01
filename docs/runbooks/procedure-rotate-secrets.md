# Procedure: Rotate Secrets

## Secret Inventory

| Secret | Provider | Rotation Steps |
|---|---|---|
| CLERK_SECRET_KEY | Clerk Dashboard → API Keys | Generate new key → update Vercel → redeploy → verify auth works |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard → Settings → API | Generate new → update Vercel → redeploy |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY | Cloudflare Dashboard → R2 → Manage API Tokens | Create new token → update Vercel → verify R2 health → delete old token |
| FAL_KEY | fal.ai Dashboard → API Keys | Generate new → update Vercel → redeploy |
| RUNPOD_API_KEY | RunPod Dashboard → Settings → API Keys | Generate new → update Vercel → redeploy |
| STRIPE_SECRET_KEY | Stripe Dashboard → Developers → API Keys | Roll key (Stripe supports dual-active during rotation) |
| STRIPE_WEBHOOK_SECRET | Stripe Dashboard → Webhooks → Signing secret | Update endpoint → get new secret → update Vercel |
| YOCO_SECRET_KEY | Yoco Dashboard → API Keys | Generate new → update Vercel |
| CRON_SECRET | Self-managed | Generate UUID → update Vercel → redeploy |
| FB_PAGE_TOKEN_* | Facebook Graph API | Long-lived tokens expire in 60 days; refresh via Graph API exchange |

## Steps
1. Generate new secret in provider dashboard
2. `vercel env add <KEY> production --force` with new value
3. `vercel --prod` to redeploy
4. `curl -s https://genesisstudio.app/api/health` to verify
5. Delete/revoke old secret in provider dashboard
6. Update `audit/SECRET_ROTATION.md` with rotation date

## Schedule
- Quarterly rotation for all keys
- Immediate rotation if any key suspected compromised
