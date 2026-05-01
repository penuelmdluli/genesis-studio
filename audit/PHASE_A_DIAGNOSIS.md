# Phase A — Diagnosis Report

**Date:** 2026-05-01
**Operator:** Live test on `https://genesisstudio.app/onboarding/first-video`
**Prompt used:** "Rain-soaked city street at night"

---

## Root Cause Summary

| # | Bug | Root Cause | Severity |
|---|-----|-----------|----------|
| 1 | R2 CORS blocking video playback | `R2_PUBLIC_URL` set to raw S3 endpoint (`a21680c…r2.cloudflarestorage.com`); API routes 302-redirect to presigned URLs on this host; R2 bucket has no CORS policy; browser blocks cross-origin video loads | **CRITICAL** |
| 2 | `/api/videos` returns 404 | Route exists and is correctly exported. The 404 is returned by the handler itself: `getUserByClerkId()` returns null for new users whose Clerk webhook hasn't created the Supabase user row yet → handler returns `{ error: "User not found" }` with **status 404** instead of 401 | **HIGH** |
| 3 | `/api/jobs?status=processing` returns 404 | Same root cause as #2 — identical "User not found" → 404 pattern in `src/app/api/jobs/route.ts:14` | **HIGH** |
| 4 | `manifest.json` returns 404 | File exists at `public/manifest.json` with correct content. PWA icons at `public/icons/icon-192.png` and `icon-512.png` do NOT exist (glob returned empty). The manifest references non-existent icons → likely the entire `public/icons/` directory is missing from the deployment, though the manifest file itself should deploy | **MEDIUM** |
| 5 | `sw.js` "Failed to convert value to Response" | `public/sw.js:48` — `.catch(() => caches.match(event.request))` can resolve to `undefined` when nothing is cached. `event.respondWith(undefined)` throws `TypeError: Failed to convert value to 'Response'`. This cascades into navigation failures. | **MEDIUM** |
| 6 | Onboarding stuck on "Almost there…" | Downstream of bugs #1 + #2/#3. Polling `/api/jobs/${jobId}` every 3s with NO hard timeout. If the job completes but the video can't play (CORS), user never sees the reveal. If the API returns 404 (user not found), polling continues forever. | **HIGH** |

---

## Detailed Analysis

### Bug 1 — R2 CORS + Presigned URL Redirect

**Files involved:**
- `.env.local:59` — `R2_PUBLIC_URL=https://a21680c65af30e3745366bc99e5388ed.r2.cloudflarestorage.com`
- `src/lib/storage.ts:25,43` — `PUBLIC_URL` check: `if (PUBLIC_URL && !PUBLIC_URL.includes("r2.cloudflarestorage.com"))` — since the URL DOES contain `r2.cloudflarestorage.com`, it falls through and returns just the key
- `src/app/api/videos/[videoId]/route.ts:107-119` — Generates presigned URL and 302-redirects to it
- `src/app/api/explore/video/[id]/route.ts:56-68` — Same pattern
- `next.config.ts:27` — CSP `connect-src` does NOT include R2 domains

**Chain of failure:**
1. `<video src="/api/videos/xxx">` or `fetch("/api/explore/video/xxx")`
2. Server returns 302 → `https://a21680c…r2.cloudflarestorage.com/genesis-videos/…?X-Amz-…`
3. Browser follows redirect, sends `Origin: https://genesisstudio.app`
4. R2 bucket has no CORS rules → no `Access-Control-Allow-Origin` header
5. Browser blocks the response

**Fix:** Use the public R2 domain `pub-891668ae91a142968457a5383e993020.r2.dev` (already in `.env.prod-test`) or bind a custom domain `cdn.genesisstudio.app`. Configure CORS on the R2 bucket. For public content (explore videos), use direct public URLs instead of presigned URLs.

### Bug 2 & 3 — /api/videos and /api/jobs 404

**Files involved:**
- `src/app/api/videos/route.ts:12-14` — `getUserByClerkId` → null → 404 "User not found"
- `src/app/api/jobs/route.ts:12-14` — identical pattern

**Why it happens:** New user signs up via Clerk. The Clerk webhook to create the Supabase user row either hasn't fired yet or failed silently. The user lands on the dashboard, which immediately polls `/api/videos` and `/api/jobs?status=processing`. Both routes authenticate successfully via Clerk but then fail the DB lookup → 404.

**Fix:** Return 401 instead of 404 for "User not found" (it's an auth state issue, not a resource issue). Consider auto-creating the user record on first API call as a fallback.

### Bug 4 — manifest.json

**Files involved:**
- `public/manifest.json` — EXISTS with correct content
- `public/icons/icon-192.png` — DOES NOT EXIST
- `public/icons/icon-512.png` — DOES NOT EXIST
- `src/app/layout.tsx:64` — `manifest: "/manifest.json"` (correct)

**Fix:** Create the missing PWA icon files. The manifest itself should deploy fine from `public/`.

### Bug 5 — sw.js TypeError

**File:** `public/sw.js:38-49`

```js
event.respondWith(
  fetch(event.request)
    .then((response) => { /* cache + return */ })
    .catch(() => caches.match(event.request)) // ← returns undefined if not cached
);
```

When the network fetch fails AND nothing is cached, `caches.match()` resolves to `undefined`. `event.respondWith(undefined)` throws `TypeError: Failed to convert value to 'Response'`.

**Fix:** Add a fallback: `.catch(() => caches.match(event.request).then(r => r || new Response('Offline', { status: 503 })))`. Also bump SW version to invalidate old installs.

### Bug 6 — Onboarding Stuck

**File:** `src/app/(dashboard)/onboarding/first-video/page.tsx:59-75`

The polling `useEffect` has no hard timeout. It polls `/api/jobs/${jobId}` every 3s and only transitions on `completed` or `failed`. If the API returns a non-OK status (like 404 from Bug #2), the catch block silently continues polling.

**Fix:** Add a 4-minute hard timeout that transitions to error state. Also handle non-OK responses in the poll loop instead of silently continuing.
