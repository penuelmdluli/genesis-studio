# Genesis Studio — Architecture Map

**Audit date:** 2026-04-25
**Audited by:** Claude Code

---

## 1.1 High-Level System Diagram

```
                              +-------------------+
                              |    USERS           |
                              | (Browser / PWA)    |
                              +---------+---------+
                                        |
                                        | HTTPS
                                        v
                              +---------+---------+
                              |   Vercel (CDN)     |
                              |   Next.js 16.2.2   |
                              |   App Router       |
                              +---------+---------+
                                        |
                     +------------------+------------------+
                     |                  |                   |
                     v                  v                   v
            +--------+------+  +-------+-------+  +-------+--------+
            |   Clerk       |  |   Supabase    |  |  Cloudflare R2 |
            |   Auth        |  |   PostgreSQL  |  |  Object Storage|
            |   (sync)      |  |   (sync)      |  |  (sync)        |
            +---------------+  +-------+-------+  +----------------+
                                       |
                     +-----------------+-----------------+
                     |                 |                  |
                     v                 v                  v
            +--------+------+  +------+--------+  +------+--------+
            |   FAL.AI      |  |   RunPod      |  |  Anthropic    |
            |   (async Q)   |  |   Serverless  |  |  Claude API   |
            |               |  |   (webhook)   |  |  (sync)       |
            | Kling 2.6/3.0 |  |  Wan 2.2      |  |  Brain Plan   |
            | Veo 3.1       |  |  HunyuanVideo |  |  QualityScore |
            | Seedance 1.5  |  |  LTX-Video    |  |  Moderation   |
            | Kokoro TTS    |  |  Mochi-1      |  |  Sound Design |
            | MMAudio V2    |  |  MimicMotion  |  +---------------+
            | FFmpeg (merge)|  |  CogVideoX    |
            | Whisper (STT) |  |  ComfyUI      |
            +---------------+  +---------------+
                                       |
                                       | (webhook callback)
                                       v
                              +--------+--------+
                              | /api/webhooks/   |
                              | runpod           |
                              +-----------------+

            +---------------+  +---------------+  +---------------+
            |   Stripe      |  |  PayFast      |  |  Paystack     |
            |   (webhook)   |  |  (webhook)    |  |  (webhook)    |
            +---------------+  +---------------+  +---------------+

            +---------------+  +---------------+  +---------------+
            |   Resend      |  |   WATI        |  |  EskomSePush  |
            |   Email       |  |  WhatsApp     |  |  Load Shedding|
            +---------------+  +---------------+  +---------------+

            +---------------+
            |  Facebook     |
            |  Graph API    |
            |  (auto-post)  |
            +---------------+
```

### Data Flow Notes

- **Synchronous**: Clerk auth, Supabase reads/writes, R2 uploads, Claude API (planner)
- **Async (queue + webhook)**: FAL.AI video generation (queue.submit → poll or webhook), RunPod jobs (submit → webhook callback)
- **Async (cron)**: 11 Vercel cron jobs (see vercel.json) handle cleanup, retention, content pipeline, analytics, scene recovery
- **Fire-and-forget**: Auto-publish to Explore, WhatsApp notifications, low-credit emails

---

## 1.2 Stack Inventory

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Next.js | 16.2.2 | App Router (NOT Pages Router). Server Components + Client Components. |
| Language | TypeScript | ^5 | `strict: true` in tsconfig.json |
| Runtime | React | 19.2.4 | Latest React 19 with Server Components |
| Auth | Clerk | ^7.0.8 (`@clerk/nextjs`) | ClerkProvider wraps entire app. Sign-in/sign-up routes. No middleware.ts (no route protection middleware). |
| DB | Supabase | ^2.101.1 | PostgreSQL. Service role key bypasses RLS. Anon key for client. |
| Storage | Cloudflare R2 | via `@aws-sdk/client-s3` ^3.1024.0 | Bucket: `genesis-videos`. Public URL configured. S3-compatible API. |
| Video Gen (FAL) | FAL.AI | `@fal-ai/client` ^1.9.5 | Kling 2.6/3.0, Veo 3.1, Seedance 1.5, Kokoro TTS, MMAudio V2, FFmpeg, Whisper |
| Video Gen (RunPod) | RunPod Serverless | REST API | Wan 2.2 (primary), HunyuanVideo, LTX-Video, Mochi-1, CogVideoX, MimicMotion |
| AI Planner | Anthropic Claude | REST API (claude-sonnet-4-20250514) | Brain Studio planner, quality scoring, moderation, sound design |
| TTS | Edge TTS (primary) | `msedge-tts` ^2.0.5 | Local Edge TTS as primary. FAL Kokoro/ElevenLabs as secondary. |
| Captions | FAL Whisper | via `@fal-ai/client` | Word-level transcription for subtitle burn-in |
| Video Assembly | FFmpeg | `@ffmpeg-installer/ffmpeg` ^1.1.0 | Local FFmpeg on Vercel serverless for concat + audio merge |
| Job Queue | BullMQ | ^5.73.0 | Declared in package.json. **Status: UNKNOWN — needs verification if Redis/BullMQ is actively used or dead code** |
| Redis | ioredis | ^5.10.1 | Declared in package.json. REDIS_URL in env. |
| Payments | Stripe | ^22.0.0 (server) / `@stripe/stripe-js` ^9.0.1 (client) | Primary payment processor. Subscriptions + credit packs + annual plans. |
| Payments (ZA) | PayFast | Custom integration | South African EFT/SnapScan/Mobicred |
| Payments (ZA) | Paystack | Custom integration | African card payments |
| Payments (ZA) | Yoco | Custom integration | South African card payments |
| Email | Resend | REST API | Transactional email (welcome, low-credit, retention) |
| WhatsApp | WATI | REST API | Video completion + low-credit notifications |
| Analytics | Vercel Analytics | `@vercel/analytics` ^2.0.1 | Client-side analytics |
| Speed | Vercel SpeedInsights | `@vercel/speed-insights` ^2.0.0 | Performance monitoring |
| State Mgmt | Zustand | ^5.0.12 | Client-side state management |
| Animation | Framer Motion | ^12.38.0 | UI animations |
| Validation | Zod | ^4.3.6 | Input validation |
| Styling | Tailwind CSS | ^4 | With `@tailwindcss/postcss` |
| Testing | Vitest | ^4.1.2 | Unit tests with `@testing-library/react` + `jsdom` |
| Hosting | Vercel | Detected via `.vercel/` | With vercel.json cron configuration |
| PWA | Service Worker | Custom `public/sw.js` | Basic PWA support with manifest.json |

---

## 1.3 Folder Responsibility Map

| Folder | Responsibility |
|--------|---------------|
| `src/app/(auth)/` | Clerk sign-in and sign-up pages |
| `src/app/(dashboard)/` | Authenticated dashboard pages: generate, gallery, brain-studio, motion-control, pricing, settings, dev-dashboard |
| `src/app/(static)/` | Static pages: about, terms, privacy, contact, blog, changelog, tutorials, docs |
| `src/app/api/` | 90+ API routes: generation, jobs, webhooks, cron, brain, explore, admin, studio, payments, features |
| `src/app/explore/` | Public video explore/discovery feed (server-rendered) |
| `src/components/chat/` | AI chatbot widget |
| `src/components/dashboard/` | Dashboard-specific UI components |
| `src/components/explore/` | Video cards, share/recreate modals, video viewer |
| `src/components/generate/` | Video generation form and model selector |
| `src/components/landing/` | Landing page sections |
| `src/components/layout/` | Navbar, sidebar, footer |
| `src/components/onboarding/` | Onboarding flow components |
| `src/components/pricing/` | Pricing page components |
| `src/components/pwa/` | PWA service worker registration |
| `src/components/ui/` | Shared UI primitives: button, badge, modal, toast, motion, etc. |
| `src/hooks/` | Custom React hooks (Zustand store) |
| `src/lib/` | Core business logic (~50 files): providers, storage, credits, payments, AI integrations |
| `src/lib/genesis-brain/` | Brain Studio pipeline: planner, orchestrator, assembly, audio, sound effects, consistency |
| `src/lib/studio/` | Dev studio: auth, DB, niche prompts, migration |
| `src/lib/intelligence/` | Facebook insights fetcher, content intelligence, analytics |
| `src/lib/content-pillars/` | Content pillar definitions for automated content |
| `src/lib/content-seeds/` | Pre-seeded content topics |
| `src/lib/news/` | News aggregation (Gemini, NewsAPI) |
| `src/lib/stock-footage/` | Pexels/Pixabay stock footage fallback |
| `src/lib/africa/` | African language voice config, script generation, pronunciation |
| `src/lib/payments/` | PayFast, Paystack, Yoco payment integrations |
| `src/types/` | TypeScript type definitions (616 lines — comprehensive) |
| `supabase/` | Database migrations |
| `infra/` | RunPod ComfyUI Docker setup |
| `scripts/` | Dev/admin scripts: migration, testing, cleanup |
| `public/` | Static assets: audio tracks (11 built-in), icons, manifest |
| `branding/` | Brand assets |

---

## 1.4 Configuration & Secrets Surface

Every `process.env.*` variable the app reads:

### Required (app breaks without these)

| Variable | Purpose | Used In |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | supabase.ts, explore pages |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client key | supabase.ts |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (bypasses RLS) | supabase.ts, explore pages |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth | .env.example |
| `CLERK_SECRET_KEY` | Clerk auth server-side | .env.example |
| `R2_ACCOUNT_ID` | Cloudflare R2 | storage.ts, video-health.ts, audio route |
| `R2_ACCESS_KEY_ID` | R2 credentials | storage.ts |
| `R2_SECRET_ACCESS_KEY` | R2 credentials | storage.ts |
| `STRIPE_SECRET_KEY` | Stripe server | stripe.ts |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | webhooks/stripe/route.ts |

### Required for Video Generation

| Variable | Purpose | Used In |
|----------|---------|---------|
| `RUNPOD_API_KEY` | RunPod auth | runpod.ts, runpod-comfyui.ts |
| `RUNPOD_ENDPOINT_WAN22` | Wan 2.2 endpoint | runpod.ts |
| `FAL_KEY` | FAL.AI auth | fal.ts, audio.ts, sound-effects.ts, captions, thumbnails |
| `ANTHROPIC_API_KEY` / `GENESIS_CLAUDE_KEY` | Claude API | planner.ts, consistency.ts, quality-score.ts, sound-effects.ts |

### Optional

| Variable | Purpose | Status |
|----------|---------|--------|
| `RUNPOD_ENDPOINT_HUNYUAN` | HunyuanVideo | Optional — no active workers noted |
| `RUNPOD_ENDPOINT_LTX` | LTX-Video | Optional — no active workers noted |
| `RUNPOD_ENDPOINT_WAN21_TURBO` | Wan 2.1 Turbo | Optional |
| `RUNPOD_ENDPOINT_MOCHI` | Mochi-1 | Optional |
| `RUNPOD_ENDPOINT_COGVIDEO` | CogVideoX | Optional |
| `RUNPOD_ENDPOINT_MIMIC_MOTION` | MimicMotion | Optional |
| `RUNPOD_ENDPOINT_WAN22_I2V` | Wan 2.2 I2V | Optional |
| `RUNPOD_ENDPOINT_CAPTIONS` | RunPod captions | Optional |
| `RUNPOD_ENDPOINT_TALKING_AVATAR` | Talking avatar | Optional (feature) |
| `RUNPOD_COMFYUI_ENDPOINT_ID` | ComfyUI endpoint | Optional (cost optimization) |
| `COMFYUI_PROVIDER_ENABLED` | Enable ComfyUI | Default: false |
| `COMFYUI_TIER_ROUTING` | Which tiers use ComfyUI | Default: "free,creator" |
| `REDIS_URL` | BullMQ queue | Optional — **UNKNOWN if actively used** |
| `PAYFAST_MERCHANT_ID` / `_KEY` / `_PASSPHRASE` | PayFast | Optional (ZA payments) |
| `PAYSTACK_SECRET_KEY` | Paystack | Optional (African payments) |
| `YOCO_SECRET_KEY` / `YOCO_WEBHOOK_SECRET` | Yoco | Optional (ZA card payments) |
| `RESEND_API_KEY` | Email | Optional |
| `WATI_API_URL` / `WATI_API_KEY` | WhatsApp | Optional |
| `ESKOMSEPUSH_API_KEY` | Load shedding | Optional (SA-specific) |
| `REPLICATE_API_KEY` | Vendor failover | Optional (last-resort fallback) |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Stock footage | Optional (emergency fallback) |
| `GEMINI_API_KEY` | News content gen | Optional |
| `NEWS_API_KEY` / `NEWSAPI_KEY` | News aggregation | Optional |
| `CRON_SECRET` | Cron auth | Required for crons |
| `OWNER_CLERK_IDS` | Owner bypass | Optional |
| `TTS_ENDPOINT_URL` | Custom TTS | Optional |
| `R2_BUCKET_NAME` | Bucket name | Default: "genesis-videos" |
| `R2_PUBLIC_URL` | Public video URL | Optional |
| `APP_URL` | Server-side URL | For webhooks |
| `NEXT_PUBLIC_APP_URL` | Client-side URL | Default: localhost:3000 |
| Various `FB_PAGE_TOKEN_*` | Facebook page tokens | 7 pages: tech_news, ai_money, motivation, health_wellness, mzansi_baby_stars, limitless_you, pop_culture_buzz |
| `STRIPE_*_PRICE_ID` (x9) | Stripe price IDs | 3 monthly + 3 annual + 3 credit packs |

### Potentially Unused

| Variable | Notes |
|----------|-------|
| `REDIS_URL` | BullMQ + ioredis in deps but **no evidence of queue workers running** — likely planned but not implemented |
| `RUNPOD_ENDPOINT_VOICEOVER` | In .env.example but empty, no code reference found |
| `RUNPOD_ENDPOINT_THUMBNAILS` | In .env.example, thumbnails use FAL FLUX Pro instead |
| `RUNPOD_ENDPOINT_UPSCALE` | In .env.example but marked comingSoon in constants |
| `RUNPOD_ENDPOINT_VIDEO_EFFECTS` | In .env.example but marked comingSoon |
| `RUNPOD_ENDPOINT_FACE_SWAP` | In .env.example but marked comingSoon |

---

## 1.5 Architectural Observations

### Strengths
- **Well-structured type system**: 616-line `types/index.ts` with comprehensive interfaces covering the full domain model
- **Solid profitability framework**: `profitability.ts` has real cost tracking, margin analysis, break-even calculations — rare for early-stage
- **Robust storage persistence**: `persistExternalVideo` has retry logic with exponential backoff, expiry detection, and 90s hard timeout
- **Good vendor failover**: In-memory health tracking with configurable thresholds, cooldown periods, and ordered provider chains
- **Multiple payment processors**: Stripe (global) + PayFast + Paystack + Yoco gives strong South African market coverage
- **Comprehensive Brain Studio pipeline**: 10-step orchestration with parallel scene generation, voiceover, music, sound design, consistency engine

### Concerns
- **No middleware.ts**: No route protection middleware — auth is handled per-route. Some routes may lack auth checks.
- **Heroic single files**: `orchestrator.ts` (899 lines), `audio.ts` (1200+ lines), `planner.ts` (700 lines), `assembly.ts` (1000+ lines) — complex files doing a lot
- **BullMQ declared but possibly unused**: `bullmq` and `ioredis` in package.json but no queue worker implementation found. Jobs use direct API calls + webhooks + crons instead.
- **Assembly complexity**: The `AssemblyState` type has 25+ fields tracking a multi-phase state machine (mmaudio → merge_audio → speed_adjust → concat → compose_audio → sound_premix → mix_final → trim_final → burn_captions → normalize → done). This is extremely complex for a serverless environment.
- **Dead code indicators**: `cogvideo-x` marked `comingSoon: true` in constants. Multiple RunPod Hub features marked `comingSoon`. Assembly code has `if (false as boolean)` blocks for disabled FAL assembly path.
- **No observability**: No Sentry integration found (file `sentry.ts` exists but not examined). No structured logging. Console.log/error throughout.
- **No rate limiting**: No rate limiting middleware on API routes. The `api-budget.ts` file exists but needs verification.
- **CSP is comprehensive**: next.config.ts has detailed Content-Security-Policy, security headers (HSTS, X-Frame-Options, etc.) — good security posture.
- **FFmpeg on Vercel serverless**: `@ffmpeg-installer/ffmpeg` runs in Vercel serverless functions. This works but has 10-minute timeout limits and memory constraints. Assembly-fallback.ts uses local FFmpeg + Edge TTS as the primary path.
- **7 Facebook page tokens**: Intelligence system tracks 7 different Facebook pages — significant social media operation.
- **African market focus**: Multiple South African payment processors, EskomSePush integration, African language TTS, South African voices — this is a ZA-focused product.
