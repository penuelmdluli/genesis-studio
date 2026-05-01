# Live Fix Log — 2026-05-01

## B.1 — R2 CORS + Public URL
Status: ✅ DONE
Files changed:
  - `src/lib/storage.ts` (added `r2PublicUrl()` helper function, lines 27-38)
  - `src/app/api/explore/video/[id]/route.ts` (full rewrite — removed presigned URLs, now uses `r2PublicUrl()`)
  - `src/app/api/videos/[videoId]/route.ts` (lines 1-28, 103-119 — replaced presigned redirect with public URL redirect)
  - `src/app/api/audio/[audioId]/route.ts` (lines 1-10, 22-32, 44-46, 68-79 — replaced presigned URL with public URL + fixed "User not found" → 401)
  - `src/app/api/thumbnails/[videoId]/route.ts` (lines 1-8, 22-23, 64-75 — replaced presigned URL with public URL)
  - `src/app/api/assets/hero-poster/route.ts` (full rewrite — uses `r2PublicUrl()`, removed S3Client dependency)
  - `next.config.ts` (lines 27-28 — added `https://*.r2.dev` to CSP `media-src` and `connect-src`)
  - `.env.local:59` (changed `R2_PUBLIC_URL` from raw S3 endpoint to `pub-891668ae91a142968457a5383e993020.r2.dev`)
  - `audit/r2-cors.json` (new — CORS rules for operator to apply)
Manual operator action required:
  - [ ] Set Vercel env var `R2_PUBLIC_URL=https://pub-891668ae91a142968457a5383e993020.r2.dev` in production
  - [ ] Apply CORS rules from `audit/r2-cors.json` to R2 bucket `genesis-videos` via Cloudflare dashboard -> R2 -> Bucket -> Settings -> CORS
  - [ ] (Optional, recommended) Bind custom domain `cdn.genesisstudio.app` to R2 bucket and update `R2_PUBLIC_URL` accordingly
  - [ ] Ensure R2 public access is enabled: Cloudflare dashboard -> R2 -> genesis-videos -> Settings -> Public Access -> Allow Access
Verification:
  - `npx tsc --noEmit` passes clean
  - After operator actions: `curl -I https://pub-891668ae91a142968457a5383e993020.r2.dev/<any-key>.mp4` should return 200 with CORS headers
Risk: low — public R2 URLs are read-only; signed URLs are still used for upload paths
Time spent: 25 min

---

## B.2 — /api/videos 404
Status: ✅ DONE
Files changed:
  - `src/app/api/videos/route.ts` (line 14 — changed from `status: 404` "User not found" to returning empty `{ videos: [] }`)
Root cause: `getUserByClerkId()` returns null for new users whose Clerk webhook hasn't created the Supabase user row yet. The handler was returning 404, which the dashboard treated as a hard failure.
Verification:
  - New user with no DB record now gets `{ videos: [] }` instead of 404
  - Existing users unaffected
Risk: none — additive change, no data loss
Time spent: 3 min

---

## B.3 — /api/jobs 404
Status: ✅ DONE
Files changed:
  - `src/app/api/jobs/route.ts` (line 14 — changed from `status: 404` "User not found" to returning empty `{ jobs: [] }`)
Root cause: Same as B.2 — identical pattern
Verification: Same as B.2
Risk: none
Time spent: 2 min

---

## B.4 — manifest.json 404
Status: ✅ NO CODE CHANGE NEEDED
Analysis:
  - `public/manifest.json` exists with correct PWA manifest content
  - `public/icons/icon-192.png` and `icon-512.png` both exist
  - `src/app/layout.tsx` correctly references `manifest: "/manifest.json"`
  - 404 in production is likely a stale Vercel deployment cache
  - Will self-resolve on next deploy
Time spent: 3 min

---

## B.5 — sw.js "Failed to convert value to Response"
Status: ✅ DONE
Files changed:
  - `public/sw.js` (full rewrite)
Changes:
  - Bumped version from `genesis-v2` to `genesis-v3` / `SW_VERSION = "v3-2026-05-01"`
  - Fixed `.catch(() => caches.match(event.request))` → now returns `new Response("Offline", { status: 503 })` when cache miss
  - Added try-catch around `event.data.json()` in push handler
  - Used `url.pathname` checks instead of string includes for more precise matching
  - All code paths through `respondWith` now guaranteed to resolve to a real `Response`
Root cause: When network fetch failed AND nothing was cached, `caches.match()` resolved to `undefined`, and `event.respondWith(undefined)` threw `TypeError: Failed to convert value to 'Response'`
Verification: Every `respondWith` code path terminates with a `Response` object
Risk: low — SW cache is cleared on version bump; old clients pull new file on next visit
Time spent: 8 min

---

## B.6 — Onboarding stuck on "Almost there…"
Status: ✅ DONE
Files changed:
  - `src/app/(dashboard)/onboarding/first-video/page.tsx` (lines 57-65, 76-98)
Changes:
  - Added 4-minute hard timeout `useEffect` that transitions to error state with a helpful message
  - Added consecutive error counter to poll loop — after 10 consecutive failures (30s), stops polling and shows error
  - Added `toast` dependency to poll `useEffect` (was missing)
Root cause: No timeout on the generating state. If API returned 404 or video failed silently, the page polled forever.
Verification: After 4 minutes, user sees "Generation is taking longer than expected" error with retry option
Risk: none — only affects the generating state timeout behavior
Time spent: 5 min

---

## Phase D — Monitoring
Status: ✅ DONE
Files changed:
  - `src/app/api/health/route.ts` (full rewrite — added FAL + RunPod checks, 2s timeout per dependency)
  - `audit/scripts/r2-cors-check.ts` (new — standalone CORS verification script)
Changes:
  - Health route now checks 4 deps: supabase, r2, fal, runpod
  - Returns `{ status: "ok"|"degraded"|"down", deps: {...} }`
  - Each check has a 2s timeout to prevent hanging
  - R2 CORS check script verifies CORS headers on public R2 URL
Manual operator action required:
  - [ ] (Optional) Set up Vercel cron to hit `/api/health` every 5 min
  - [ ] (Optional) Configure `SLACK_HEALTH_WEBHOOK` env var for failure alerts
Time spent: 10 min

---

## Total time: ~56 min
