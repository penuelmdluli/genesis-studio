# Stop The Bleed Report — 2026-05-02

## Automations Paused

| System | Type | Spends Credits? | Posts Social? | Disabled How | Re-enable How |
|---|---|---|---|---|---|
| content-pipeline | Vercel cron (2x daily) | YES (RunPod+FAL) | YES (Facebook+YouTube) | Killswitch | Set AUTOMATION_PAUSED=false |
| process-mbs-queue | Vercel cron (every 1 min) | YES (FAL Kling) | YES (Facebook) | Killswitch | Same |
| process-fallbacks | Vercel cron (every 1 min) | YES (RunPod) | No | Killswitch | Same |
| discover-content | Vercel cron (every 30 min) | No | No | Killswitch | Same |
| vet-candidates | Vercel cron (every 15 min) | No | No | Killswitch | Same |
| recover-scenes | Vercel cron (every 5 min) | No | No | Killswitch | Same |
| cleanup-storage | Vercel cron (daily 3am) | No | No | Killswitch | Same |
| dunning | Vercel cron (daily 9am) | No | No | Killswitch | Same |
| purge-stale | Vercel cron (every 6h) | No | No | Killswitch | Same |

**Master kill switch:** `AUTOMATION_PAUSED=true` in Vercel env. One var pauses all 12 cron routes.

**Customer-facing crons also paused:** `recover-scenes` and `purge-stale` are needed for Brain Studio and stuck job cleanup. These should be re-enabled first when ready.

## Real Users Audited

| User | Created | Status | Action |
|---|---|---|---|
| goodnessbaloyiberry2@gmail.com | 2026-05-02 | STUCK JOB | Refund 40 credits + fail stuck job + contact user |
| iteverycode@gmail.com | 2026-05-01 | Clean | None (operator test account) |

## Key Finding: Wan 2.2 Is Killing Real Users

Both of the real user's attempts used Wan 2.2 (RunPod). The endpoint has been cold/dead since May 1. The stale job reaper (purge-stale) runs every 6 hours and catches jobs >30 min old — but the user's current job slipped through because it was submitted between reaper runs.

**Immediate mitigation:** This branch does NOT remove Wan 2.2 from the model list — that's a separate code change. The operator should guide the user to use Seedance 1.5 instead.

## Credit Ledger Inconsistency

The credit system deducts from `users.credit_balance` directly but doesn't always write to `credit_transactions`. Only refunds are reliably logged. This means:
- Signup grants: NOT in ledger
- Generation charges: NOT in ledger
- Refunds: YES in ledger

**This is not a data loss issue** — the balance is arithmetically correct. But it makes auditing difficult. P1 fix for a future session: ensure every credit change writes to both `users.credit_balance` AND `credit_transactions`.

## Cost Impact

- **3 crons burning credits every minute:** process-mbs-queue + process-fallbacks (every 1 min each) + content-pipeline (2x daily)
- Estimated daily automation spend: variable, depends on MBS queue depth and fallback volume
- After pause: $0 from automation. Only real user generations spend credits.

## Operator Actions

See `audit/STOP_THE_BLEED_OPERATOR_ACTIONS.md` — 6 actions, ~15 min total.
