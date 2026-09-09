# iVideo Studio — Phase 0 Audit

**Date:** 2026-09-09 · **Scope:** read-only discovery, no application code changed
**Repo:** `genesis-studio` · **Live:** https://ivideostudio.ai

---

## 0. Correction to the brief

Five premises in the task brief do not match the deployed system. They change the work in Phases 1–4, so they are stated first.

| Brief says | Actually | Evidence | Consequence |
|---|---|---|---|
| Next.js on **Vercel** | **Cloudflare Workers** via OpenNext | No `vercel.json`; `wrangler.toml` + `open-next.config.ts`; `scripts/deploy-cloudflare.sh` runs `opennextjs-cloudflare deploy` | "Vercel cron" (Phase 2.4) does not exist. Crons run from a separate `genesis-cron` Worker (`workers/wrangler.toml`, `workers/cron-handler.js`) on a fixed schedule map. The reaper must be added there. Workers have no 10s/60s function limit — CPU-time limits behave differently. |
| **Clerk** auth | **Custom D1 sessions + JWT** | `src/lib/auth.ts` header: "Custom auth using D1 sessions + JWT tokens. Replaces Clerk". `src/lib/auth-custom/session.ts` | "Clerk role-gated `/admin`" (Phase 4.2) and "Clerk redirect URLs" (Phase 3.3) do not apply. `clerk_id` survives only as a **column name** for backward compatibility. `/api/webhooks/clerk` is dead. |
| **Supabase Postgres** | **Cloudflare D1 (SQLite)** | `src/lib/db-driver.ts` returns `createD1Client()`. `src/lib/d1.ts` is a Supabase-shaped façade over D1 | The Phase 2 schema DDL is Postgres (`uuid`, `numeric`, `timestamptz`, `references`) and must be rewritten for SQLite. **The Supabase project in `.env.local` no longer resolves in DNS** (`quliaphgimytmqkwadqu.supabase.co` → NXDOMAIN) — those env vars are dead weight. |
| **Yoco** payments | **Yoco (ZAR) + Paystack (USD)** | `src/app/(dashboard)/pricing/page.tsx:97` — `currency === "ZAR" ? "yoco" : "paystack"` | Paystack is half the checkout surface and is **broken in production** — see F3. |
| RunPod IDs are **hardcoded** | They are **env vars that are stale**, and **all endpoints are scaled to zero** | See §4 and §8 | De-hardcoding fixes nothing on its own. The fix is boot validation + a live health gate + not routing there at all. |

Everything below is measured against the deployed Worker and the production D1 database, not inferred from source.

---

## 1. Route inventory

**169 API routes, 46 pages, 0 server actions.** Full per-route table is impractical at this size; the material findings:

### Reference analysis

| | Count |
|---|---|
| Routes statically referenced from `src/`, `workers/` or `scripts/` | 117 |
| Routes with **no static reference** | 52 |

The 52 break down as:

**Not orphans — called externally or dynamically (13).** Do not delete.
`webhooks/yoco`, `webhooks/paystack`, `webhooks/stripe`, `webhooks/runpod`, `webhooks/runpod-comfyui`, `webhooks/slack-interaction`, `webhooks/clerk` (called by providers); `lead-videos/[id]/fetch`, `jobs/[jobId]/cancel`, `jobs/[jobId]/stream`, `studio/videos/[videoId]/status`, `videos/[videoId]/rate`, `videos/[videoId]/post-to-pages` (template-literal paths the matcher cannot see).

**Cron routes not wired to any schedule (5).** They exist, are auth-gated, and never run: `cron/auto-rebalance`, `cron/fetch-insights`, `cron/outcome-tracker`, `cron/retention`, `cron/run-analysis`. Either wire them into `workers/cron-handler.js` or delete them. Right now they are neither running nor obviously dead, which is the worst state.

**Genuinely unreferenced, admin/dev/test surface (34).** Includes `admin/stats`, `admin/provider-health`, `admin/video-health`, `admin/refund-broken`, `admin/force-fail-production`, `admin/audit-videos`, `dev/migrate`, `dev/reassemble`, `test/comfyui-generation`, `explore/migrate`, `explore/publish`, `explore/recreate`, `payments/payfast`, `mimic/generate`, `mimic/status/[jobId]`.

> **Note for Phase 4:** `/api/admin/stats`, `/api/admin/provider-health` and `/api/admin/video-health` **already exist** and are unreferenced by any UI. Phase 4.2 should mount a dashboard onto these, not write new ones.

### Credit-debiting routes (26)

Every route calling `deductCredits`/`refundCredits`: `generate`, `v1/generate`, `generate-image`, `motion-control`, `mimic/generate`, `music-video/generate`, `product-ads/generate`, `react-studio`, `ai-singer/generate`, `talking-avatar`, `talking-avatar/enhance`, `thumbnails`, `upscale`, `voiceover`, `captions`, `captions/burn`, plus refund-only paths in `jobs/[jobId]`, `jobs/[jobId]/cancel`, `webhooks/runpod`, `cron/check-mimic`, `cron/check-singer`, `cron/check-stuck-jobs`, `dev/reconcile`, and three admin routes.

**26 independent debit paths, no shared transaction, no idempotency, no escrow.** This is the surface Phase 2 has to cover — it is much wider than "the generate route".

---

## 2. Generation path map

There are **six** distinct paths from user action to video. Production traffic uses the first two.

### Path A — `/api/generate` (primary, 176 jobs, all the failure data)

```
UI /generate  →  POST /api/generate
  ├─ estimateCreditCost()
  ├─ deductCredits()            ← DEBIT HAPPENS HERE, jobId = ""
  ├─ createJob()                ← job row created AFTER the debit
  └─ dispatch on model.provider
       ├─ provider === "fal"  → submitVideoJob()  [lib/provider-router.ts]
       │                          └─ WaveSpeed → FAL
       │                          └─ on 403/Forbidden/balance:
       │                                usedFallback = true, actualModelId = "wan-2.2"
       │                                ↓ FALLS THROUGH TO RUNPOD
       └─ provider !== "fal" || usedFallback
                              → submitRunPodJob()  [lib/runpod.ts]
                                 └─ RUNPOD_ENDPOINT_WAN22 → 404 (endpoint deleted)
  →  status polled by GET /api/jobs/[jobId]  +  cron/check-stuck-jobs
```

**This is the bug.** `src/app/api/generate/route.ts:149` says it plainly: *"FAL auto-fallback: if FAL fails (balance exhausted, forbidden), retry on RunPod Wan 2.2."* The failover destination has not existed for months.

### Path B — `/api/motion-control` (second-largest volume, 41 jobs)

Separate dispatch entirely: `lib/motion-control.ts` → WaveSpeed → RunPod (flag-gated off) → FAL. Does **not** use `provider-router.ts`. Has its own duration guard, its own cost model, its own refund logic.

### Path C — `/api/v1/generate` (public API, key-authed)

`src/app/api/v1/generate/route.ts` — a near-copy of Path A including the same RunPod fallback. **Any fix to Path A that is not also applied here re-opens the bug on the public API.**

### Path D — Brain / productions (`lib/video-pipeline.ts`, 518 `productions` rows)

Calls `fal.subscribe()` directly — `fal-ai/stable-audio`, `ffmpeg-api/loudnorm`, `ffmpeg-api/compose`. Bypasses the router, the failover and the circuit breaker completely.

### Path E — `/api/mimic/generate` → `mimic_jobs` — **DEAD**

`/mimic` page is a 6-line redirect to `/motion-control`. Last `mimic_jobs` row: **2026-06-07** (13 completed / 19 failed). Yet `cron/check-mimic` still runs **every 2 minutes** against an empty working set.

### Path F — ComfyUI (`lib/runpod-comfyui.ts`, 5 `comfyui_jobs` rows)

`RUNPOD_COMFYUI_ENDPOINT_ID = br144yn8m43jqn` → **404**.

---

## 3. Duplicate register

| Duplicate | Live | Dead / dormant | Evidence |
|---|---|---|---|
| **Payment providers ×4** | Yoco (ZAR) + Paystack (USD) via `/api/credits/subscribe` and `/api/credits/buy-pack` | PayFast (`/api/payments/payfast` + webhook), Stripe (`/api/webhooks/stripe`) | `pricing/page.tsx:97` picks yoco/paystack only. No UI path reaches PayFast or Stripe. |
| **Provider dispatch ×4** | `provider-router.ts` (Path A), `motion-control.ts` (Path B) | — both live, both different | Path C duplicates A; Path D bypasses both. No single chokepoint. |
| **Motion transfer ×2** | `/api/motion-control` + `motion_control` UI | `/api/mimic/*`, `mimic_jobs` table, `cron/check-mimic` | `/mimic/page.tsx` is a redirect stub; table cold since 2026-06-07. |
| **Video tables ×5** | `videos` (313), `productions` (518), `explore_videos` (25) | `studio_videos` (**0 rows**), `comfyui_jobs` (5, endpoint dead) | Row counts from production D1. |
| **Manifest ×2** | `public/manifest.webmanifest` (static file wins) | `src/app/manifest.ts` (shadowed, never served) | Production served the static file's description verbatim. Already reconciled during the Lead Videos work. |
| **RunPod clients ×3** | `runpod.ts` | `runpod-comfyui.ts` (endpoint 404), `runpod-singer.ts` (`RUNPOD_ENDPOINT_ACE_STEP` unset in prod) | See §4/§8. |
| **`lib/providers/` already exists** | `providers/fal-kling-i2v.ts` | — | Phase 1 must **consolidate into** this directory, not create it. |

---

## 4. Provider call sites

### RunPod

All endpoint identifiers come from **env vars, not hardcoded literals** — the brief's premise is wrong. The problem is that nothing validates them.

Files: `lib/runpod.ts` (490 ln), `lib/runpod-comfyui.ts`, `lib/runpod-singer.ts`, `lib/motion-control.ts`, `api/cron/recover-scenes`, `api/health`.

**21 distinct `RUNPOD_ENDPOINT_*` vars are read in code.**

### WaveSpeed
`lib/wavespeed.ts`, `lib/wavespeed-guard.ts`, `lib/provider-router.ts`, `lib/motion-control.ts`. Base URL `https://api.wavespeed.ai/api/v3` hardcoded in two places. Model slugs live in `constants.ts` per model (`wavespeedModelId`, `wavespeedModelIdI2V`) — correct pattern.

### FAL
`lib/fal.ts`, `lib/providers/fal-kling-i2v.ts`, `lib/provider-router.ts`, `lib/motion-control.ts`, `lib/video-pipeline.ts`, `api/motion-control` (inline `import`). Model IDs in `constants.ts` (`falModelId`, `falModelIdI2V`) plus **hardcoded strings** in `video-pipeline.ts` (`fal-ai/stable-audio`, `fal-ai/ffmpeg-api/*`) and `motion-control/route.ts` (`fal-ai/kling-video/v3/{pro,standard}/image-to-video`).

---

## 5. Credit ledger audit

### Q: Can a user be double-debited?
**Yes — three ways.**

1. **No idempotency anywhere.** `/api/generate` accepts no idempotency key. A double-click, a retry or a flaky connection creates two jobs and two debits. Rate limiting (`checkRateLimit`, `enforceDistributedRateLimit`) throttles but does not deduplicate.
2. **Double refund** — the inverse, same root cause. `refundCredits()` has **no guard against refunding the same job twice**, and two independent actors refund on the 30-minute timeout: `cron/check-stuck-jobs:115` and `jobs/[jobId]/route.ts:597,609`. A user polling their job while the cron sweeps gets credited twice. **104 refunds against 117 failures is consistent with this already happening.**
3. **Lost update on concurrent writes.** `deductCredits` reads the balance, computes `newBalance` in JS, then writes that constant with a `.gte(amount)` guard. The guard prevents going negative; it does **not** prevent two concurrent debits from both writing the same value — the second silently under-charges. `refundCredits` has no guard at all.

### Q: Can a failed job leave credits debited with no refund?
**Yes.** In `/api/generate`, the order is `deductCredits()` → `createJob()` → provider submit. The refund lives in the **inner** `catch (gpuError)`. If `createJob()` throws, control lands in the **outer** `catch (error)` at line 275, which returns a bare 500 — **no refund, no job row, no alert**. The user is charged for a job that never existed and there is no record to reconcile against.

Additionally, `deductCredits` is called with `jobId: ""` (the comment concedes: *"job ID will be updated after job creation"*) — **it never is**. Every debit transaction row is orphaned from its job, which is why refunds cannot be reconciled programmatically.

**Verdict: the escrow model in Phase 2 is the correct fix and should be treated as the highest-value item after the routing fix.**

---

## 6. Env var inventory

- **99 distinct env vars** read across `src/`.
- **Validation: none.** `src/lib/env.ts` provides `envString`/`envFlag`/`envNumber` which trim and **silently return `undefined`/a default**. There is no `config.ts`, no zod, no boot check.
- **What happens when one is stale:** nothing, until a user pays for it. A stale `RUNPOD_ENDPOINT_*` reaches the provider and returns 404 *after* the credit debit. This is the mechanism behind all 55 404s.

### Production Worker secrets — what is actually set

Present: `RUNPOD_API_KEY`, `RUNPOD_WEBHOOK_SECRET`, `RUNPOD_COMFYUI_ENDPOINT_ID`, `RUNPOD_ENDPOINT_{CAPTIONS,HUNYUAN,LTX,MIMIC_MOTION,MOCHI,WAN21_TURBO,WAN22,WAN22_I2V,WAN_ANIMATE}`, `FAL_KEY`, `WAVESPEED_API_KEY`, `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`, `CRON_SECRET`, `SCRAPER_SERVICE_URL`, `SCRAPER_SERVICE_SECRET`.

**Missing in production but read by code:**
`PAYSTACK_SECRET_KEY` · `RUNPOD_ENDPOINT_ACE_STEP` · `RUNPOD_ENDPOINT_SADTALKER` · `RUNPOD_ENDPOINT_TALKING_AVATAR` · `RUNPOD_ENDPOINT_UPSCALE` · `RUNPOD_ENDPOINT_IMAGE_UPSCALE` · `RUNPOD_ENDPOINT_VIDEO_EFFECTS` · `RUNPOD_ENDPOINT_FACE_SWAP` · `RUNPOD_ENDPOINT_AVATAR_GENERATOR` · `RUNPOD_ENDPOINT_CHARACTER` · `RUNPOD_ENDPOINT_VOICE_CLONE` · `RUNPOD_ENDPOINT_PRESENTATIONS` · `RUNPOD_ENDPOINT_COGVIDEO`

Every feature behind those is dead on arrival in production. `cogvideo-x` proves it: 3 production jobs failed with *"No GPU endpoint configured for CogVideoX-5B"*, and `ai-singer` with *"RUNPOD_ENDPOINT_ACE_STEP not configured"* — **the user was charged first in both cases.**

Dead vars still present in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — the host does not resolve.

---

## 7. Stale domain references

**Much cleaner than the brief assumes.** Live code has exactly one real hit.

| Location | Hit | Severity |
|---|---|---|
| `api/cron/content-pipeline/route.ts:34` | `"https://genesis-studio.vercel.app"` as `APP_URL` fallback | **Real.** If `APP_URL` is ever unset this cron posts links to a dead host. |
| `app/(static)/contact/page.tsx:25`, `landing-page.tsx:648-649` | `twitter.com/genesisstudio`, `github.com/genesisstudio` | Cosmetic — verify the handles exist. |
| `migrations/0002_data.sql` | `cdn.genesisstudio.app`, `quliaphgimytmqkwadqu.supabase.co` in seed rows | Historical data, already imported. Do not rewrite. |
| `lib/genesis-brain/branding.ts:19` | `"Made with Genesis Studio — ivideostudio.ai"` | Brand mismatch: product is **iVideo Studio**, watermark says **Genesis Studio**. Domain is correct. |

`genesis-studio-hazel`: **zero hits.** `APP_URL` fallbacks are otherwise correct (`https://ivideostudio.ai` ×10).

---

## 8. Dead config — measured live

### RunPod endpoint IDs, tested against `api.runpod.ai`

| Var | ID | Result |
|---|---|---|
| `RUNPOD_ENDPOINT_WAN22` | `dm5mng5h7034q7` | **404** |
| `RUNPOD_ENDPOINT_WAN22_I2V` | `wan-2-2-i2v-720-lora` | **404** — this is a *name*, not an ID |
| `RUNPOD_ENDPOINT_MOCHI` | `kh33643llbkmam` | **404** |
| `RUNPOD_ENDPOINT_HUNYUAN` | `7mfjlvvokrocfe` | **404** |
| `RUNPOD_ENDPOINT_LTX` | `aoy1j9tnxqbgld` | **404** |
| `RUNPOD_ENDPOINT_WAN21_TURBO` | `ggn6phlufe8jgp` | **404** |
| `RUNPOD_ENDPOINT_MIMIC_MOTION` | `ztpbmpfrndvdcy` | **404** |
| `RUNPOD_COMFYUI_ENDPOINT_ID` | `br144yn8m43jqn` | **404** |
| `RUNPOD_ENDPOINT_WAN_ANIMATE` | `swy894a8qg145q` | 200 |
| `RUNPOD_ENDPOINT_CAPTIONS` | `ox1o1ra26z2ijx` | 200 |

**8 of 10 dead.**

### The endpoints that do exist — all are scaled to zero

```
55tbvsoj6m78m8  runpod-chatterbox                         workersMax=0
5arzy0p1wnm229  hunyuan-foley                             workersMax=0
5r88ueysbd8tm8  whisper-captions                          workersMax=0
b13hwup9d6179v  runpod-music                              workersMax=0
b43f9r6vwavg6u  Wan2.2 with LoRA generate_video_ksampler  workersMax=0
dnlyzu7i3c7dzc  runpod-musetalk                           workersMax=0
ehfz1uir72f77v  assembler                                 workersMax=0
k526wl5smcg7h5  echomimic-presenter                       workersMax=0
mp2awqavthuc2b  runpod-ltx-serverless                     workersMax=0
ox1o1ra26z2ijx  Whisper Captions - Genesis                workersMax=0
swy894a8qg145q  wan-animate                               workersMax=0
```

**Every RunPod endpoint on the account has `workersMax = 0`.** Even the two IDs that resolve cannot execute a job. RunPod is not a degraded fallback — it is a guaranteed failure for 100% of traffic routed to it. This fully vindicates the Phase 1 decision and makes it more urgent than the brief assumed.

Two live endpoints look like intended replacements for dead vars: `mp2awqavthuc2b` (LTX) and `b43f9r6vwavg6u` (Wan 2.2 LoRA).

---

## 9. Production failure data — the actual cause

From the production D1 database, not the brief:

| Model | Failed | Completed | Failure rate |
|---|---:|---:|---:|
| **seedance-1.5** | **59** | 7 | **89%** |
| mimic-motion | 21 | 20 | 51% |
| wan-2.2 | 18 | 18 | 50% |
| ai-singer | 8 | 0 | 100% |
| cogvideo-x | 7 | 0 | 100% |
| mochi-1 | 3 | 0 | 100% |
| kling-2.6 | 1 | 10 | 9% |

Top failure reasons, by model:

```
54  seedance-1.5   Submission failed: RunPod API error: 404
 8  mimic-motion   Video duration can not longer than 30s
 8  wan-2.2        Generation timed out after 10 minutes
 7  mimic-motion   Forbidden. Credits have been refunded.
 4  ai-singer      Forbidden
 4  cogvideo-x     Failed to submit to GPU
 4  wan-2.2        Generation timed out after 30 minutes
 3  cogvideo-x     No GPU endpoint configured for CogVideoX-5B
 3  mochi-1        Generation timed out after 10 minutes
 3  wan-2.2        Auto-detected broken: completed but no video file exists
 1  ai-singer      RUNPOD_ENDPOINT_ACE_STEP not configured
```

### The finding that reframes the whole remediation

**The 55 "RunPod 404" failures and the 12 "Forbidden" failures are one incident, not two.**

`seedance-1.5` is declared `provider: "fal"` and never intentionally touches RunPod. 54 of its 59 failures are RunPod 404s because:

1. WaveSpeed and FAL balances are exhausted → the router throws `Forbidden`
2. `generate/route.ts:175` catches it and sets `actualModelId = "wan-2.2"`, falling through to RunPod
3. `RUNPOD_ENDPOINT_WAN22` was deleted months ago → **404**
4. The user sees a RunPod error for a model that has nothing to do with RunPod

**One line of failover logic pointing at a dead provider accounts for ~46% of every failure in the product's history.** Fixing provider balance alone would not have fixed it; fixing RunPod IDs alone would not have fixed it either (workersMax=0). Only removing RunPod from the failover chain does.

Note also that **`seedance-1.5` is in the free tier** (`MODEL_ACCESS.free`). New users land on the worst-performing model in the product. That is the 68% failure rate, concentrated exactly where it does most damage.

---

## 10. Severity-ranked findings

### P0 — costing money and users right now

| # | Finding | Evidence |
|---|---|---|
| **F1** | **Hosted-provider failover targets a dead RunPod endpoint**, converting every balance exhaustion into a hard 404. 54 of 55 RunPod 404s, ~46% of all failures. | `generate/route.ts:149,174-179`; live 404 on `dm5mng5h7034q7` |
| **F2** | **Every RunPod endpoint on the account is `workersMax=0`**, and 8 of 10 configured IDs 404. RunPod cannot serve any request. | RunPod REST API, §8 |
| **F3** | **`PAYSTACK_SECRET_KEY` is not set in production.** Every non-ZAR user who clicks Subscribe or Buy Pack cannot pay. Silent revenue loss. | `wrangler secret list`; `pricing/page.tsx:97` |
| **F4** | **Failed job can leave credits debited with no refund.** `createJob()` failure escapes to the outer catch, which does not refund. | `generate/route.ts:97,126,275` |
| **F5** | **Double refund is possible and probably already happening.** No idempotency on `refundCredits`; cron and job-status route both refund on timeout. 104 refunds / 117 failures. | `credits.ts:125`; `check-stuck-jobs:115`; `jobs/[jobId]:597,609` |
| **F6** | **`seedance-1.5` — 89% failure — is the free tier's default model.** New users' first impression is the least reliable path. | `constants.ts:611`; §9 |

### P1 — will re-open the P0s or hide them

| # | Finding |
|---|---|
| **F7** | **Zero config validation.** 99 env vars, none checked at boot. 13 read-but-unset in production, incl. 12 `RUNPOD_ENDPOINT_*`. Users are charged before the missing config is discovered. |
| **F8** | **No idempotency on generation.** Double-click = two jobs, two debits. |
| **F9** | **Every debit records `job_id = ""`.** Debits cannot be reconciled to jobs. Makes escrow migration harder the longer it waits. |
| **F10** | **Path C (`/api/v1/generate`) duplicates the F1 bug.** Fixing `/api/generate` alone leaves the public API broken. |
| **F11** | **Credit read-modify-write races.** `deductCredits` under-charges on concurrency; `refundCredits` has no guard at all. |
| **F12** | **Duration validated after debit.** 8 `mimic-motion` failures were charged, then rejected by Kling for >30s. |

### P2 — cleanup, dead weight

| # | Finding |
|---|---|
| **F13** | Mimic path dead since 2026-06-07, but `cron/check-mimic` still runs every 2 min. |
| **F14** | 5 cron routes exist with no schedule; 34 admin/dev routes unreferenced. |
| **F15** | PayFast + Stripe integrations unreachable from any UI. |
| **F16** | `studio_videos` table: 0 rows. Supabase env vars point at an NXDOMAIN host. |
| **F17** | `genesis-studio.vercel.app` fallback in `cron/content-pipeline`. |
| **F18** | Watermark says "Genesis Studio", product is "iVideo Studio". |
| **F19** | Path D (Brain) bypasses the router entirely — no failover, no breaker. |

---

## 11. Recommended change to the Phase 1 plan

The brief's Phase 1 is right in direction but mis-prioritised given the above. Suggested order:

1. **Delete the RunPod failover branch** (`generate/route.ts` + `v1/generate/route.ts`). One-line-scale change, kills ~46% of all failures. Ship this before the abstraction.
2. **Top up or verify WaveSpeed/FAL balance** — F1's trigger. Without it, step 1 converts 404s into honest "unavailable" errors, which is better but still a failed generation.
3. **Move `seedance-1.5` off the free tier**, or make WaveSpeed draft-tier the free default.
4. Then build the abstraction — **consolidating `provider-router.ts`, `wavespeed.ts`, `fal.ts` and `providers/fal-kling-i2v.ts` into `lib/providers/`**, and bringing Paths B, C and D onto it. Per the no-rewrite rule, this is a consolidation, not a new module.
5. Boot validation + `/api/health/providers` — but note `/api/admin/provider-health` already exists and should be checked before writing a new one.

**No rewrite case is being made.** Every item above is fixable in place.

---

## 12. Proof commands used

```bash
# RunPod endpoint liveness
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.runpod.ai/v2/$ID/health" -H "Authorization: Bearer $RUNPOD_API_KEY"

# Live endpoint list + worker scaling
curl -s "https://rest.runpod.io/v1/endpoints" -H "Authorization: Bearer $RUNPOD_API_KEY"

# Production failure breakdown
npx wrangler d1 execute genesis-studio --remote --command \
  "select model_id, status, count(*) n from generation_jobs group by model_id, status order by n desc"

# Production secrets actually set
npx wrangler secret list
```

---

# Phase 1 — outcome (2026-09-09)

Branch `fix/phase1-reliability`, deployed to production as version `5e3727a2`.

## Corrections to the Phase 0 audit

- **F10 was overstated.** `/api/v1/generate` duplicates the RunPod *dispatch*
  but has no failover branch, so it never produced the 404 cascade. It did
  lack a preflight check; that is now fixed. The audit claim that it "duplicates
  the F1 bug" was wrong.
- **New finding (P0): RunPod holds $15.05 with 0/10 workers deployed.** Money is
  in the account; no endpoint can execute a job. Confirmed in the RunPod console.
- **New finding (P0): activation is far worse than the 68% figure suggests.**
  62 users, 33 ever attempted a generation, **7 ever succeeded**. Five of those
  are free users who succeeded exactly once and never returned. 26 of the 33
  who tried have never once seen a finished video.
- **New finding (P0): 9 support tickets are open and unanswered**, the oldest
  from 2026-06-20 and one of them from a paying Studio customer asking for
  escalation. Their content matches this audit exactly — "It says seedance pro
  failed", "Ai model isn't working", "Why is my video not generated".
- **New finding (P0): WaveSpeed balance is $1.74.** One controlled draft
  generation on 2026-09-09 coincided with a $1.03 drop ($2.77 → $1.74).
  WaveSpeed exposes no usage endpoint, so that figure cannot be attributed to
  the test job with certainty and should be confirmed against WaveSpeed's own
  billing before it is used for margin maths. If it is accurate, per-run cost
  is ~20x the figure assumed in the remediation brief.

## Changed

| Commit | Concern |
|---|---|
| `0608ba3` | wan-2.2 routed to WaveSpeed (verified slugs), seedance-1.5 off the free tier, Wan `size` mapping, draft tier |
| `fd22e70` | `lib/config.ts` — core config validation + per-model availability |
| `3457b72` | Removed both dead RunPod failover paths; preflight before debit on both generate routes |
| `d5dd809` | `/api/health/providers` — live reachability, balance, last success |
| (+2) | Health false-green fix; `config.test.ts` |

## Proof

Live, production, after deploy:

```
ok            : True      canGenerate : True
  wavespeed  ok=True  funded ($1.74)
  fal        ok=False account locked or out of balance (HTTP 403)
  runpod     ok=False 2/10 endpoints reachable, but all workers are
                      scaled to zero - cannot execute jobs
lastSuccess   : 2026-09-07T08:30:41.128Z
```

End-to-end generation, WaveSpeed `wan-2.2/t2v-480p-ultra-fast`, prediction
`2fae816df6984863a84f2ee32713c81d`: **completed**, 61.9s inference, output
delivered. This is the path the free tier now uses.

Tests: **32 failed / 392 passed**. Baseline before Phase 1 was 32 failed / 383
passed on the same suite (verified by reverting to HEAD and re-running), so the
changes add 9 passing tests and introduce no new failures. The 32 pre-existing
failures are unrelated drift in `db.test.ts`, `credits.test.ts` and
`brain.test.ts` — logged, not addressed.

**Not proven:** a live forced-failure test with a bad provider key. That would
require rotating a production secret. The refuse-before-charge guarantee is
covered by `config.test.ts` instead.

## The blocker

Phase 1 stopped users being charged for generations that cannot succeed. It
cannot make generations succeed. With FAL locked, RunPod at zero workers and
WaveSpeed at $1.74, the product has roughly one generation of runway. **Funding
a provider is the prerequisite for every remaining phase.**
