# Operator Playbook

## Daily Checks (5 min)
1. `curl -s https://genesisstudio.app/api/health | jq .` — all deps "ok"
2. Check Slack #alerts for overnight errors
3. Glance at Vercel dashboard — any failed deploys or cron errors
4. Check RunPod dashboard — are GPU endpoints healthy (workers > 0)?

## Weekly Checks (15 min)
1. Supabase Dashboard → check storage usage, row counts
2. FAL.AI Dashboard → check spend for the week
3. RunPod Dashboard → check GPU hours consumed
4. Stripe Dashboard → check revenue, failed payments, disputes
5. Review any support tickets or contact form submissions
6. Check Facebook page token expiry (60-day cycle)

## Monthly Checks (30 min)
1. Review cost trends — is per-user cost sustainable?
2. Check for secret rotation candidates (quarterly schedule)
3. Review npm audit for new vulnerabilities
4. Update dependencies (patch versions only; test before deploy)
5. Review user growth metrics
6. Check R2 storage usage and clean up orphaned files
7. Verify DKIM/SPF still passing (mail-tester.com)
8. Review POPIA compliance if any new data collection added

## Emergency Contacts
- Vercel: status.vercel.com
- Supabase: status.supabase.com
- Cloudflare: cloudflarestatus.com
- FAL.AI: Discord (invite in dashboard)
- RunPod: Discord / support@runpod.io
- Stripe: stripe.com/support
- Clerk: clerk.com/support
