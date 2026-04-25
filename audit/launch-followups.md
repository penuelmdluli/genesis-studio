# Launch Followups

## BLOCKING (must complete before launch)

- **Legal pages content**: Terms, Privacy (POPIA), AUP, Refund pages need real legal copy. Scaffolding exists at `/terms`, `/privacy`, etc. Use Termly (~R500) or a lawyer. See LAUNCH_CHECKLIST.md.
- **Hero demo videos**: 6 videos needed for landing page hero. Prompts provided in `src/lib/sample-prompts.ts`. Generate via Brain Studio, upload to R2 under `marketing/hero-{1-6}.mp4`.
- **Upstash Redis credentials**: Required for distributed rate limiting to work. Free tier sufficient. Without this, rate limiting falls back to in-memory only (resets on cold start).
- **Slack webhook URL**: Required for spend cap and provider degradation alerts. Create a `#genesis-alerts` channel.

## POST-LAUNCH MONTH 1

### Phase 1 deferral: FAL assembly removal
- `src/lib/genesis-brain/assembly.ts` lines 99-291 contain ~190 lines of disabled FAL assembly code inside `startAssembly()`, wrapped in `if (false as boolean)`.
- Local FFmpeg assembly via `assembly-fallback.ts` is the active path.
- Safe to delete the `if(false)` block once confirmed FAL assembly won't be re-enabled.

### Pre-existing test failure: brain.test.ts DEFAULT_MODEL mismatch
- `src/lib/genesis-brain/brain.test.ts:519` expects `seedance-1.5` but planner forces `wan-2.2`. Fix test to match current DEFAULT_MODEL.

### Payment processor consolidation
- Yoco and PayFast serve overlapping SA market. Add analytics to measure conversion per processor, then decide which to keep.
- Webhook handlers must remain active for existing subscriptions regardless.

### Internal namespace reorganization
- Move `src/lib/intelligence/` and `src/lib/studio/` under `src/lib/internal/`.
- Owner-only route gating (Commit 7) already achieves the security goal.

### Sentry integration
- Original plan included Sentry (Commit 12 in spec). Deferred to avoid adding another dependency before launch. The health endpoint and Slack alerts provide basic observability.
- Action: add `@sentry/nextjs` in week 1 post-launch for full error tracking.

### Pricing page rewrite
- Current pricing shows credits as primary feature. Rewrite to show outcomes ("~60 videos/month" instead of "500 credits").
- See Golden Plan spec Phase 5 Commit 19 for detailed copy.

### Onboarding flow
- Create first-video onboarding at `/onboarding/first-video` with one-click sample prompts.
- See Golden Plan spec Phase 5 Commit 20 for detailed spec.

### Welcome email sequence
- 4-email sequence: welcome, first-video-tutorial (24h), brain-studio-intro (72h), upgrade-nudge (80% credits).
- Resend infrastructure already exists. See Golden Plan spec Phase 5 Commit 21.

## POST-LAUNCH MONTH 2

### Explore acquisition funnel
- Make `/explore` the primary acquisition funnel. "Recreate this" button drives sign-up conversion.
- Pre-fill generate form from explore video's prompt via `?seed_from={id}` query param.

### Tier-aware Brain Studio model selection
- Brain Studio planner currently forces all scenes to wan-2.2. Add tier-based model selection: Pro users get Kling 2.6, Studio users get Kling 3.0.

### Re-enable hidden features
- Evaluate readiness of: Motion Control, Talking Avatar, Upscale, Thumbnails, Image Gen.
- Re-enable by setting `true` in `src/lib/feature-flags.ts` LAUNCH_VISIBLE_ROUTES.

## POST-LAUNCH MONTH 3+

### Annual billing
- Stripe annual price IDs are configured in `.env.example` but the UI toggle is not implemented.
- Add monthly/annual toggle to pricing page.

### API Keys (public API)
- API key management page exists at `/api-keys` but is hidden for launch.
- Re-enable when public API documentation is ready.

## DEFERRED / WON'T FIX

### BullMQ / Redis job queue
- Removed in Phase 1 Commit 1. The app successfully uses Vercel cron + webhooks + FAL queue API.
- No need to reintroduce unless a dedicated worker tier is added.
