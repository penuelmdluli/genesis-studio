# Genesis Studio — Pipelines

**Audit date:** 2026-04-25

---

## 4.1 Brain Studio (6-Scene Orchestration)

### Full Code Path — Numbered Sequence

1. **Entrypoint**: `POST /api/brain/produce` → `src/app/api/brain/produce/route.ts`
   - Validates Clerk auth, gets user from DB
   - Calls `executeProduction()` from `src/lib/genesis-brain/orchestrator.ts:190`

2. **Input Validation**: `planProduction()` in `src/lib/genesis-brain/planner.ts:211`
   - Concept must be 10-5000 chars
   - Target duration 15-120 seconds
   - Requires `ANTHROPIC_API_KEY` or `GENESIS_CLAUDE_KEY`

3. **Scene Planning (LLM Call)**: `planProduction()` in `planner.ts:230-298`
   - Model: `claude-sonnet-4-20250514`
   - System prompt: 165-line cinematography masterclass (camera language, lighting, composition)
   - User prompt: concept + style + duration + voiceover/music/caption flags
   - Output: `ScenePlan` JSON with 4-8 scenes
   - Retry: up to 3 attempts on parse failure
   - Post-processing: `validateAndSanitizePlan()` forces all models to `wan-2.2`, enforces anti-avatar prompts
   - Optional: `applyPremiumEngagementCTA()` — separate Claude call for engagement CTA on final scene

4. **Credit Deduction**: `orchestrator.ts:206-219`
   - `calculateBrainCredits()` computes total: planning (2) + scene gen + audio + assembly (5) + MMAudio + sound design
   - Owner accounts bypass credit deduction
   - Atomic deduction via `.gte()` filter prevents double-spend

5. **Scene Record Creation**: `createProductionScenes()` in `orchestrator.ts:232`
   - Creates `production_scenes` rows: one per scene, status="queued"

6. **Pass 1 — Stock Footage Fallback** (emergency only): `orchestrator.ts:239-299`
   - ONLY runs if `FAL_KEY` is NOT configured
   - Searches Pexels/Pixabay for matching stock clips
   - Mirrors matched clips to R2
   - Marks matched scenes as "completed"

7. **Pass 2 — Parallel AI Generation**: `orchestrator.ts:302-434`
   - For each scene NOT handled by stock:
     - Check provider chain via `selectProviderChain(userPlan)`:
       - Free/Creator + ComfyUI enabled: `runpod-comfyui → runpod → fal`
       - Pro/Studio: `fal → runpod → replicate`
     - If ComfyUI: synchronous `submitRunPodComfyUIJob()` → wait → persist to R2
     - If FAL model (Kling/Veo/Seedance): `submitFalJob()` → async queue (webhook-driven)
     - If RunPod model: `submitRunPodJob()` with webhook URL → async
   - All submissions run via `Promise.allSettled()` (parallel)

8. **Audio Generation** (parallel with scenes): `orchestrator.ts:440-654`
   - **Voiceover**: Per-scene TTS via `generatePerSceneVoiceover()` or single script via `generateVoiceover()`
     - Fallback chain: ElevenLabs → Kokoro TTS → Edge TTS
   - **Music**: `selectMusic()` from built-in track library (11 tracks)
   - **Sound Design** (if enabled): `generateAllSceneSounds()` → Claude designs → FAL Stable Audio generates
   - Results saved to `productions.assembly_state` JSONB

9. **Captions**: `orchestrator.ts:642-651`
   - `generateCaptions()` creates SRT-format captions from voiceover script
   - Saved to `productions.captions_url` as JSON

10. **Scene Completion (via Webhook)**: `src/app/api/brain/webhook/route.ts` + `src/app/api/webhooks/runpod/route.ts`
    - RunPod webhook updates scene status → "completed"
    - FAL status polling via `src/app/api/brain/status/route.ts`
    - When ALL scenes complete → triggers assembly

11. **Assembly**: `src/lib/genesis-brain/assembly.ts:78-99`
    - **Primary path (current)**: Local FFmpeg assembly via `assembly-fallback.ts:simplifiedFinalize()`
      - Downloads all scene videos
      - Concatenates via FFmpeg
      - Overlays voiceover audio (Edge TTS)
      - Mixes background music
      - Burns captions if requested
    - **FAL path (DISABLED)**: `if (false as boolean)` block — disabled while FAL credits exhausted
      - Multi-phase: MMAudio → merge audio → concat → compose → loudnorm → trim → burn captions

12. **R2 Upload**: Videos persisted via `persistExternalVideo()` in `src/lib/storage.ts:157`
    - 3 retry attempts with exponential backoff
    - 90s hard timeout per download
    - Validates file size > 5000 bytes

13. **Database Write**: Production status → "completed", output URLs saved

14. **Response to Client**: Client polls `GET /api/brain/status` for progress updates
    - Progress tracked: 0% → 10% (planned) → 20% (scenes submitted) → 30% (audio done) → 50-90% (assembly) → 100% (complete)

### Failure Handling
- **Credit Refund**: `failAssembly()` in `assembly.ts:42` automatically refunds credits on any assembly failure
- **Stuck Scene Recovery**: `resubmitStuckScenes()` in `orchestrator.ts:722` — cron job resubmits scenes stuck in "queued" for >30s
- **Per-scene failure**: Individual scene failures don't kill the production — remaining scenes proceed

### Total Expected Time for 30s Brain Studio Video
- Planning: 3-5s (Claude API call)
- Scene submission: 2-3s (API calls)
- Scene generation (parallel): 2-5 minutes (wan-2.2 at 720p)
- Audio generation (parallel): 5-15s (Edge TTS)
- Assembly: 30-60s (local FFmpeg)
- **Total: ~3-6 minutes**

---

## 4.2 Auto-Posting Pipeline

### Facebook Posting
- **File**: `src/app/api/dev/post-to-facebook/route.ts`
- **Page tokens**: 7 Facebook pages configured via `FB_PAGE_TOKEN_*` env vars:
  - `tech_news`, `ai_money`, `motivation`, `health_wellness`, `mzansi_baby_stars`, `limitless_you`, `pop_culture_buzz`
- **Token env vars**: `FB_PAGE_TOKEN_tech_news`, etc. (in `src/lib/intelligence/fb-insights-fetcher.ts:14-20`)
- **Token refresh**: No automatic refresh logic found — tokens appear to be long-lived page access tokens
- **Posting function**: `POST /api/dev/post-to-facebook` — uploads video + caption + hashtags
- **Schedule**: Triggered by cron `/api/cron/content-pipeline` at 05:30 and 17:30 UTC daily
- **Rate limits**: No explicit rate limiting found
- **Known issues**: `pop_culture_buzz` token noted as potentially unminted in memory

### YouTube Posting
- **File**: `src/app/api/dev/post-to-youtube/route.ts`
- **Auth**: OAuth2 via `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- **OAuth flow**: `src/app/api/dev/youtube-auth/route.ts`
- **Status**: UNKNOWN — needs operator verification of token validity

### Instagram / TikTok
- **No direct posting integration found in code**
- The landing page mentions "Share to TikTok, WhatsApp" but this appears to be manual sharing via URLs, not API integration

---

## 4.3 Content Pipeline (Automated Content Generation)

### Cron-Triggered Pipeline: `/api/cron/content-pipeline`
- **Schedule**: Twice daily at 05:30 and 17:30 UTC
- **Flow**:
  1. Fetch trending topics via news APIs (Gemini, NewsAPI)
  2. Score topics by viral potential
  3. Generate scripts via Claude
  4. Submit video generation via Brain Studio
  5. Apply branding (watermark, outro)
  6. Post to Facebook pages
  7. Track performance via Intelligence system

### Intelligence Feedback Loop
- `src/lib/intelligence/fb-insights-fetcher.ts` — Pulls Facebook Insights every 6 hours
- `src/lib/intelligence/analyzer.ts` — Analyzes what content performs best
- `ai_decisions` table — Tracks AI recommendations and their outcomes
- `viral_formulas` table — Stores discovered winning content patterns
- `content_intelligence` table — Stores extracted insights (hooks, timing, topics)

### Studio Pages Pipeline
- `src/lib/studio/db.ts` — CRUD for studio pages, trends, videos, posts
- `studio_pages` → `studio_trends` → `studio_videos` → `studio_posts` flow
- Manual trigger via `/api/dev/scheduler`

---

## 4.4 Other Pipelines

### Single Video Generation (`/api/generate`)
- User submits prompt → job created → provider selected → webhook on completion → video saved
- Provider chain: based on model's configured provider (fal or runpod-hub)
- Webhook: RunPod → `/api/webhooks/runpod`, FAL → polling via `/api/jobs/[jobId]`

### Explore Auto-Publish (`src/lib/auto-publish.ts`)
- Free tier videos auto-published to Explore feed with full branding
- Paid tier users opt-in from Gallery
- Branded video persisted to R2 (FAL URLs expire after ~7 days)
- Duplicate prevention via `source_video_id` check

### Referral Pipeline
- User shares video → share tracking → new user signs up with referral → both get credits
- Tracked in `referral_codes`, `referrals`, `referral_signups` tables

---

## 4.4 Brain Studio E2E Test

> **NOTE:** The Brain Studio E2E test was NOT run during this audit to avoid costs. A test script is provided for the operator.
> 
> **Estimated cost**: ~$0.50-1.50 depending on model (wan-2.2 at 720p)
> **Estimated time**: 3-6 minutes

See `audit/scripts/e2e-test-brain-studio.ts` (to be created by operator).
