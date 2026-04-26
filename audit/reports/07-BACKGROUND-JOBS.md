# Genesis Studio — Background Jobs

**Audit date:** 2026-04-25

---

## Vercel Cron Jobs (from vercel.json)

11 cron jobs configured:

| Path | Schedule | What it does | Failure mode |
|------|----------|-------------|--------------|
| `/api/cron/cleanup-storage` | Daily 03:00 UTC | Purge stale R2 files (expired videos, orphaned uploads) | Storage bloat accumulates |
| `/api/cron/dunning` | Daily 09:00 UTC | Retry failed subscription payments, send dunning emails | Revenue leakage from failed payments |
| `/api/cron/retention` | Weekly Mon 10:00 UTC | Send retention/re-engagement emails to inactive users | Users churn without intervention |
| `/api/cron/content-pipeline` | 2x daily 05:30, 17:30 UTC | Full automated content pipeline: trending → script → generate → post | Auto-posting stops |
| `/api/cron/fetch-insights` | Every 6h | Pull Facebook page analytics (views, engagement) | Intelligence system data goes stale |
| `/api/cron/run-analysis` | Every 12h | Analyze content performance, extract patterns | AI learning stops |
| `/api/cron/outcome-tracker` | Daily 02:00 UTC | Track AI decision outcomes, update formulas | Feedback loop broken |
| `/api/cron/recover-scenes` | **Every 5 min** | Retry stuck Brain Studio scenes (queued >30s without job ID) | Productions hang indefinitely |
| `/api/cron/auto-seed` | Daily 06:00 UTC | Auto-seed trending topics into content queue | Content pipeline has no input |
| `/api/cron/purge-stale` | Every 6h | Delete abandoned/failed productions and scenes | DB bloat, stale records |
| `/api/cron/auto-rebalance` | Weekly Mon 08:00 UTC | Rebalance provider load across tiers | Uneven provider utilization |

### Authentication
All cron routes should validate `CRON_SECRET` from the `Authorization` header. Vercel automatically sends this.

### Critical Cron: `recover-scenes` (every 5 min)
This is the **orphaned scene reconciler** the operator flagged. It:
1. Finds production scenes stuck in "queued" status with no `runpod_job_id`
2. Checks if they've been stuck for >30 seconds
3. Resubmits them via `resubmitStuckScenes()` in `orchestrator.ts:722`
4. Handles the case where Vercel's `after()` callback dies mid-execution

**Verification:** The code path from `recover-scenes` → `resubmitStuckScenes()` is properly wired. The function correctly:
- Filters for scenes where `status === "queued" && !runpodJobId`
- Waits 30s before attempting resubmission (gives original `after()` time)
- Resubmits to the correct provider (FAL or RunPod) based on model
- Handles both FAL and RunPod resubmission paths

---

## BullMQ / Redis Queue

**Status: DECLARED BUT LIKELY UNUSED**

- `bullmq` ^5.73.0 and `ioredis` ^5.10.1 are in `package.json` dependencies
- `REDIS_URL` is in `.env.example`
- **No queue worker implementation found** in the codebase
- **No queue consumer or processor files** found
- The app uses direct API calls + webhooks + cron polling instead of a message queue

This appears to be a planned dependency that was never implemented. The codebase uses:
- Vercel cron jobs for scheduled work
- RunPod webhooks for job completion
- FAL queue API (built into FAL SDK) for async video generation
- Direct polling for status checks

**Recommendation:** Consider removing `bullmq` and `ioredis` from dependencies if not planned for near-term use. They add ~2MB to the bundle.

---

## Webhook-Based Background Processing

### RunPod Webhook (`/api/webhooks/runpod`)
- **Trigger**: RunPod calls back when a serverless job completes
- **What it does**: Updates job status, downloads video, uploads to R2, creates Video record, handles Brain Studio scene completion → triggers assembly
- **Auth**: `RUNPOD_WEBHOOK_SECRET` header verification
- **Failure mode**: Jobs complete on RunPod but app never knows → videos lost, credits not refunded

### Stripe Webhook (`/api/webhooks/stripe`)
- **Trigger**: Stripe events (checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted, etc.)
- **What it does**: Updates user plan, grants credits, handles cancellations
- **Auth**: Stripe signature verification via `STRIPE_WEBHOOK_SECRET`
- **Failure mode**: Payments succeed but credits not granted, plan not upgraded

### Brain Webhook (`/api/brain/webhook`)
- **Trigger**: FAL/RunPod completion for Brain Studio scenes
- **What it does**: Updates scene status, triggers assembly when all scenes complete
- **Auth**: UNKNOWN — no explicit auth verification found in the webhook route
- **Failure mode**: Scenes complete but assembly never triggers

---

## Assembly Polling

The Brain Studio assembly uses a state machine pattern:
- Client polls `GET /api/brain/status` every few seconds
- Server checks `assembly_state` JSONB in productions table
- Each poll advances the state machine (check FAL jobs, submit next phase)
- Phases: mmaudio → merge_audio → speed_adjust → concat → compose_audio → sound_premix → mix_final → trim_final → burn_captions → normalize → done
- `pollErrorCount` tracks consecutive errors; after 5, production fails
- `mmaudioPollCount` tracks MMAudio stuck cycles; force-fallback to silent after N

This is essentially a serverless state machine driven by client polling — a creative solution for Vercel's stateless environment.
