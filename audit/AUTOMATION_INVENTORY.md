# Automation Inventory — 2026-05-02

## Vercel Cron Jobs (9 active in vercel.json)

| Path | Schedule | Purpose | Spends Credits? | Posts to Social? | Customer-Facing? |
|---|---|---|---|---|---|
| /api/cron/content-pipeline | 0 5,13 * * * (2x daily) | Fetches trends, generates video/audio via RunPod/FAL, posts to Facebook/YouTube | **YES** | **YES** | No — internal content automation |
| /api/cron/process-mbs-queue | */1 * * * * (every min) | Submits FAL Kling I2V jobs, polls completion, posts to Facebook | **YES** | **YES** | No — MBS automation |
| /api/cron/process-fallbacks | */1 * * * * (every min) | Resubmits failed ComfyUI jobs to RunPod Wan 2.2 | **YES** | No | No — internal retry |
| /api/cron/recover-scenes | */5 * * * * (every 5 min) | Polls RunPod for Brain Studio scene status, uploads to R2 | No (polls only) | No | **Yes** — completes user Brain productions |
| /api/cron/discover-content | */30 * * * * (every 30 min) | Discovers dance content from creators for MBS queue | No | No | No — MBS discovery |
| /api/cron/vet-candidates | */15 * * * * (every 15 min) | AI vision check on candidates for brand safety | No | No | No — MBS vetting |
| /api/cron/cleanup-storage | 0 3 * * * (daily 3am) | Deletes expired R2 files per retention policy | No | No | No — housekeeping |
| /api/cron/dunning | 0 9 * * * (daily 9am) | Retries failed payments | No | No | Yes — payment recovery |
| /api/cron/purge-stale | 0 */6 * * * (every 6h) | Cleans stuck queue items, fails timed-out assemblies | No | No | **Yes** — prevents stuck jobs |

## Additional Cron Routes (exist but NOT in vercel.json — not scheduled)

| Route | Purpose | Notes |
|---|---|---|
| auto-rebalance | Reloads content seed topics based on performance | Not scheduled |
| auto-seed | Maintains minimum pending seed queue items | Not scheduled |
| fetch-insights | Fetches Facebook Insights metrics | Not scheduled |
| outcome-tracker | Evaluates AI decision quality | Not scheduled |
| run-analysis | Intelligence analysis on post performance | Not scheduled |
| retention | Sends retention/winback emails | Not scheduled |

## Credit-Burning Summary
- **3 crons actively spend FAL/RunPod credits:** content-pipeline, process-mbs-queue, process-fallbacks
- **2 crons post to Facebook:** content-pipeline, process-mbs-queue
- **2 crons are customer-facing:** recover-scenes (Brain production), purge-stale (stuck job cleanup)
- **Rest are safe:** housekeeping, analytics, discovery (no generation, no posting)
