# Disaster Recovery Drills — 2026-05-01

## DR.1 — Database Lost
**Procedure:** Supabase PITR restore to new project
**Target RTO:** 30 min | **Target RPO:** 1 hour (continuous PITR)
**Status:** Procedure documented in `docs/runbooks/procedure-restore-from-backup.md`
**Drill status:** OPERATOR ACTION REQUIRED — run the actual restore drill per B3 instructions
**Key steps:**
1. Supabase Dashboard → Backups → PITR → select timestamp
2. Restore to new project (never overwrite production)
3. Verify table counts match production
4. Swap connection strings if original is unrecoverable

## DR.2 — R2 Bucket Wiped
**Procedure:** Re-upload from source providers (FAL/RunPod URLs in job records)
**Target RTO:** 2 hours | **Target RPO:** Varies (some videos may be unrecoverable if provider URLs expired)
**Mitigation:** Job records in Supabase contain original provider URLs. Re-download and re-upload for any video whose R2 key is missing.
**Drill status:** Procedure documented. No actual wipe drill needed (destructive).

## DR.3 — Vercel Deploy Broken
**Procedure:** Vercel Dashboard → Deployments → Previous good → Promote to Production
**Target RTO:** 5 min | **Target RPO:** 0 (no data loss — only code rollback)
**Drill status:** HIGH CONFIDENCE — Vercel rollback is a dashboard click. No destructive drill needed.
**Alternative:** `vercel rollback` CLI command

## DR.4 — Stripe Webhook Backlog
**Procedure:** Stripe Dashboard → Webhooks → Failed events → Resend all
**Target RTO:** 15 min | **Target RPO:** 0 (Stripe retains events for 30 days)
**Idempotency verified:** `webhook_events` table prevents double-processing
**Drill status:** Procedure documented in `docs/runbooks/incident-stripe-webhook-failing.md`

## DR.5 — Secret Leak
**Procedure:** Rotate in provider dashboard → update Vercel env → force redeploy → audit for unauthorized use
**Target RTO:** 15 min (detection to rotation)
**Drill status:** Procedure documented in `docs/runbooks/procedure-rotate-secrets.md`
**Key steps:**
1. Revoke/roll the leaked key immediately in provider dashboard
2. `vercel env add <KEY> production --force` with new value
3. `vercel --prod` to redeploy
4. Audit provider dashboard for unauthorized API calls during exposure window

## Summary

| Scenario | Target RTO | Target RPO | Drill Status |
|---|---|---|---|
| Database lost | 30 min | 1 hour | Procedure documented |
| R2 wiped | 2 hours | Varies | Procedure documented |
| Broken deploy | 5 min | 0 | High confidence |
| Stripe backlog | 15 min | 0 | Procedure documented |
| Secret leak | 15 min | N/A | Procedure documented |
