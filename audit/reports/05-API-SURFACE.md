# Genesis Studio — API Surface

**Audit date:** 2026-04-25

---

## Total: 90+ route files, ~124 HTTP endpoints

### Core Generation & Jobs

| Method | Path | Auth | Rate Limited | Purpose | File |
|--------|------|------|-------------|---------|------|
| POST | /api/generate | Clerk | No | Single video generation (T2V/I2V/motion) | src/app/api/generate/route.ts |
| POST | /api/generate-image | Clerk | No | Image generation via FAL FLUX Pro | src/app/api/generate-image/route.ts |
| GET | /api/jobs | Clerk | No | List user's generation jobs | src/app/api/jobs/route.ts |
| GET | /api/jobs/[jobId] | Clerk | No | Job status + metadata | src/app/api/jobs/[jobId]/route.ts |
| POST | /api/jobs/[jobId]/cancel | Clerk | No | Cancel running job | src/app/api/jobs/[jobId]/cancel/route.ts |
| GET | /api/jobs/[jobId]/stream | Clerk | No | SSE job progress stream | src/app/api/jobs/[jobId]/stream/route.ts |
| GET | /api/jobs/queue-position | Clerk | No | Queue position polling | src/app/api/jobs/queue-position/route.ts |

### Brain Studio

| Method | Path | Auth | Rate Limited | Purpose | File |
|--------|------|------|-------------|---------|------|
| POST | /api/brain/plan | Clerk | No | Create production plan (Claude) | src/app/api/brain/plan/route.ts |
| POST | /api/brain/produce | Clerk | No | Execute production | src/app/api/brain/produce/route.ts |
| GET | /api/brain/status | Clerk | No | Poll production + assembly state | src/app/api/brain/status/route.ts |
| POST | /api/brain/cancel | Clerk | No | Cancel production + refund | src/app/api/brain/cancel/route.ts |
| GET | /api/brain/history | Clerk | No | User's production history | src/app/api/brain/history/route.ts |
| GET/POST/DELETE | /api/brain/templates | Clerk | No | Brain templates CRUD | src/app/api/brain/templates/route.ts |
| POST | /api/brain/webhook | None* | No | FAL/RunPod completion callback | src/app/api/brain/webhook/route.ts |
| GET/POST | /api/brain/test-run | Clerk | No | Test production | src/app/api/brain/test-run/route.ts |

### Features (RunPod Hub)

| Method | Path | Auth | Rate Limited | Purpose | File |
|--------|------|------|-------------|---------|------|
| POST | /api/captions | Clerk | No | Generate captions via Whisper | src/app/api/captions/route.ts |
| GET | /api/captions/[jobId] | Clerk | No | Poll caption job | src/app/api/captions/[jobId]/route.ts |
| POST | /api/captions/burn | Clerk | No | Burn captions into video | src/app/api/captions/burn/route.ts |
| POST | /api/voiceover | Clerk | No | Generate TTS voiceover | src/app/api/voiceover/route.ts |
| GET | /api/voiceover/preview | Clerk | No | Preview voiceover | src/app/api/voiceover/preview/route.ts |
| POST | /api/talking-avatar | Clerk | No | Lip-sync avatar generation | src/app/api/talking-avatar/route.ts |
| POST | /api/upscale | Clerk | No | Video upscaling | src/app/api/upscale/route.ts |
| POST | /api/thumbnails | Clerk | No | AI thumbnail generation | src/app/api/thumbnails/route.ts |
| POST | /api/motion-control | Clerk | No | Motion transfer analysis | src/app/api/motion-control/route.ts |

### User & Credits

| Method | Path | Auth | Rate Limited | Purpose | File |
|--------|------|------|-------------|---------|------|
| GET | /api/user | Clerk | No | Get user profile | src/app/api/user/route.ts |
| GET | /api/user/credit-history | Clerk | No | Credit transaction log | src/app/api/user/credit-history/route.ts |
| POST | /api/user/billing-portal | Clerk | No | Stripe billing portal | src/app/api/user/billing-portal/route.ts |
| POST | /api/user/delete-account | Clerk | No | GDPR account deletion | src/app/api/user/delete-account/route.ts |
| GET | /api/user/export | Clerk | No | GDPR data export | src/app/api/user/export/route.ts |
| POST | /api/credits/subscribe | Clerk | No | Stripe subscription checkout | src/app/api/credits/subscribe/route.ts |
| POST | /api/credits/buy-pack | Clerk | No | Stripe one-time credit pack | src/app/api/credits/buy-pack/route.ts |

### Webhooks (External → App)

| Method | Path | Auth | Rate Limited | Purpose | File |
|--------|------|------|-------------|---------|------|
| POST | /api/webhooks/stripe | Stripe sig | No | Subscription events, payments | src/app/api/webhooks/stripe/route.ts |
| POST | /api/webhooks/runpod | RUNPOD_WEBHOOK_SECRET | No | Job completion callbacks | src/app/api/webhooks/runpod/route.ts |
| POST | /api/webhooks/payfast | PayFast sig | No | PayFast payment notifications | src/app/api/webhooks/payfast/route.ts |
| POST | /api/webhooks/paystack | Paystack sig | No | Paystack payment notifications | src/app/api/webhooks/paystack/route.ts |
| POST | /api/webhooks/yoco | Yoco sig | No | Yoco payment notifications | src/app/api/webhooks/yoco/route.ts |

### Cron Jobs (Vercel Cron → App)

| Method | Path | Auth | Schedule | Purpose |
|--------|------|------|----------|---------|
| GET | /api/cron/cleanup-storage | CRON_SECRET | Daily 03:00 | Purge stale R2 files |
| GET | /api/cron/dunning | CRON_SECRET | Daily 09:00 | Failed payment recovery |
| GET | /api/cron/retention | CRON_SECRET | Weekly Mon 10:00 | Email retention campaigns |
| GET | /api/cron/content-pipeline | CRON_SECRET | 2x daily 05:30, 17:30 | Auto content generation |
| GET | /api/cron/fetch-insights | CRON_SECRET | Every 6h | Pull Facebook analytics |
| GET | /api/cron/run-analysis | CRON_SECRET | Every 12h | Performance analysis |
| GET | /api/cron/outcome-tracker | CRON_SECRET | Daily 02:00 | Video performance tracking |
| GET | /api/cron/recover-scenes | CRON_SECRET | Every 5 min | Retry stuck scenes |
| GET | /api/cron/auto-seed | CRON_SECRET | Daily 06:00 | Seed trending content |
| GET | /api/cron/purge-stale | CRON_SECRET | Every 6h | Delete abandoned productions |
| GET | /api/cron/auto-rebalance | CRON_SECRET | Weekly Mon 08:00 | Provider load balancing |

### Explore (Community Feed)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/explore | None | Browse published videos |
| GET | /api/explore/[id] | None | Video details |
| GET | /api/explore/video/[id] | None | Video stream/download |
| POST | /api/explore/like | Clerk | Like a video |
| POST | /api/explore/publish | Clerk | Publish own video |
| POST | /api/explore/recreate | Clerk | Regenerate from explore |

### Admin (Owner-only)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/admin/stats | Owner check | Dashboard stats |
| GET | /api/admin/provider-health | Owner check | Provider status |
| GET | /api/admin/video-health | Owner check | R2 video health |
| POST | /api/admin/audit-videos | Owner check | Scan/fix broken videos |
| POST | /api/admin/refund-broken | Owner check | Batch refund broken |
| GET/POST | /api/admin/force-fail-production | CRON_SECRET | Force-fail wedged production |
| GET/POST | /api/admin/hero-setup | Owner check | Hero poster setup |

### Public API (v1)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/generate | API Key | External video generation |
| GET | /api/v1/status/[jobId] | API Key | External job status |

---

## Flagged Issues

### Routes with no auth that should have auth
- `POST /api/brain/webhook` — No auth verification visible (relies on webhook being secret URL)
- `POST /api/internal/brain` — Explicitly marked "no auth"
- Several `/api/dev/*` endpoints may lack proper auth guards in production

### Routes performing paid external calls without spend guards
- `POST /api/generate` — Has credit deduction but no per-request cost cap beyond plan limits
- `POST /api/brain/produce` — Has credit calculation but no hard dollar cap
- `POST /api/talking-avatar` — Calls FAL.AI, needs credit check verification
- `POST /api/upscale` — Calls FAL.AI, needs credit check verification

### Routes with no rate limiting
- **ALL routes lack rate limiting** — No middleware-level rate limiting found. The `api-budget.ts` file exists but its enforcement is unclear.

### Potential dead endpoints
- `/api/test/comfyui-generation` — Test-only
- `/api/dev/*` — 12 development endpoints that should be disabled in production
- `/api/payments/payfast` — Separate from `/api/webhooks/payfast`, may be redundant
