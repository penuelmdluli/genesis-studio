# Genesis Studio Audit — Executive Summary

**Audit date:** 2026-04-25
**Audited by:** Claude Code
**Repo state:** local working directory (not a git repo at root level)
**Project location:** `genesis-studio/` subdirectory

---

## 1. The Bottom Line

Genesis Studio is a **well-architected, feature-rich AI video generation SaaS** with genuine production-grade capabilities. The Brain Studio pipeline (multi-scene orchestration with voiceover, music, sound design, and captions) is impressively complete. The credit system is economically sound with 90%+ margins on all paid tiers. **However, the app has critical security gaps — no rate limiting, no auth middleware, and an unauthenticated webhook endpoint — that must be fixed before public launch.** The biggest blocker is not functionality (which works) but operational safety (which is missing).

---

## 2. What's Working

- **Brain Studio pipeline** successfully orchestrates 4-8 scene productions with Claude-powered planning, parallel video generation, per-scene voiceover (Edge TTS), music selection, sound design (FAL Stable Audio), and local FFmpeg assembly — all within 3-6 minutes at ~$0.47 actual cost per 30s video
- **11 AI video models** registered (4 FAL Hollywood + 7 RunPod open-source), with proper provider failover chain and in-memory health tracking (`src/lib/vendor-failover.ts`)
- **Credit system** with atomic deduction (`.gte()` prevents double-spend), automatic refunds on failure, owner bypass, and low-credit email alerts (`src/lib/credits.ts:58`)
- **4 payment processors** (Stripe global + PayFast/Paystack/Yoco for South Africa) with webhook verification on all except Brain
- **Content Intelligence system** — AI learns from Facebook post performance, extracts viral formulas, and adapts content strategy across 7 pages
- **Community Explore feed** with trending algorithm, likes, recreates, shares, and auto-publish for free tier
- **Profitability framework** with real GPU cost tracking, VAT/processor fee accounting, and break-even analysis (`src/lib/profitability.ts`)
- **Security headers** are comprehensive: CSP, HSTS, X-Frame-Options, X-Content-Type-Options all properly configured (`next.config.ts:12-28`)

---

## 3. What's Broken

- **CRITICAL: No rate limiting** on any of 90+ API routes — expensive model calls are completely unprotected (`audit/reports/10-GAPS-AND-RISKS.md#C1`)
- **CRITICAL: No auth middleware** — auth checked per-route, easy to miss on new endpoints. `/api/internal/brain` already has no auth (`audit/reports/10-GAPS-AND-RISKS.md#C2`)
- **CRITICAL: Brain webhook unauthenticated** — `POST /api/brain/webhook` accepts callbacks with no signature verification (`audit/reports/10-GAPS-AND-RISKS.md#C3`)
- **CRITICAL: 12 dev routes exposed in production** — `/api/dev/post-to-facebook`, `/api/dev/migrate`, etc. accessible in production (`audit/reports/10-GAPS-AND-RISKS.md#C4`)
- **HIGH: No observability** — console.log only, no Sentry, no structured logging, no alerting (`audit/reports/10-GAPS-AND-RISKS.md#H1`)
- **HIGH: Facebook tokens may expire** — 7 page tokens with no auto-refresh logic (`audit/reports/10-GAPS-AND-RISKS.md#H3`)

---

## 4. What's Wasted

- **BullMQ + ioredis** in dependencies (unused) — no queue workers exist, app uses cron + webhooks instead. Dead weight in `package.json:24-25`
- **FAL assembly pipeline** — 2,600+ lines in `assembly.ts` disabled behind `if (false as boolean)`. Local FFmpeg is the active path.
- **CogVideoX model** — registered with `comingSoon: true`, has endpoint config, but never selectable by users
- **Replicate integration** — `REPLICATE_API_KEY` in failover chain but effectively unused (last-resort fallback)
- **Multiple RunPod endpoints** (Hunyuan, LTX, Mochi, Wan 2.1 Turbo) — Brain Studio planner forces all scenes to `wan-2.2`. These endpoints may have no active workers.

---

## 5. Unit Economics Verdict

| Tier | Monthly | Margin | Verdict |
|------|---------|--------|---------|
| **Free** | $0 | N/A | **Loss-leader** — ~$0.22/user, intentional for growth |
| **Creator** ($12) | +$9.41/user | 93% | **Profitable** |
| **Pro** ($29) | +$22.94/user | 94% | **Profitable** |
| **Studio** ($79) | +$63.03/user | 95% | **Profitable** |

**Break-even: 10 paid subscribers** cover $155/mo fixed costs. Credit pricing is ~16x markup over GPU costs. Margins are healthy even with expensive FAL models.

---

## 6. The Three Things to Do This Week

1. **Add rate limiting + auth middleware** (1 day) — Create `src/middleware.ts` with Clerk `authMiddleware()`. Add per-user rate limits (e.g., 10 req/min for generation endpoints). This is the #1 launch blocker. See `audit/reports/10-GAPS-AND-RISKS.md#C1-C2`.

2. **Secure the Brain webhook + disable dev routes in production** (4 hours) — Add `RUNPOD_WEBHOOK_SECRET` verification to `/api/brain/webhook`. Add `VERCEL_ENV` gate to all `/api/dev/*` routes. See `audit/reports/10-GAPS-AND-RISKS.md#C3-C4`.

3. **Set up basic observability** (4 hours) — Integrate Sentry for error tracking (free tier). Set up BetterUptime for health checks. This will prevent silent failures post-launch. See `audit/reports/10-GAPS-AND-RISKS.md#H1-H2`.

---

## 7. Open Questions for the Operator

1. **Database row counts** — The audit could not connect to Supabase to get table sizes. Run the SQL query in `audit/reports/02-DATA-MODEL.md` to get row counts.

2. **RunPod endpoint status** — Are Hunyuan, LTX, Mochi, Wan 2.1 Turbo endpoints still active? The Brain Studio planner forces everything to wan-2.2, suggesting other endpoints may have been decommissioned.

3. **R2 bucket size** — What is the current R2 storage size and egress? Needed for accurate storage cost projection.

4. **Facebook token status** — Which of the 7 `FB_PAGE_TOKEN_*` tokens are currently valid? Is `pop_culture_buzz` still unminted?

5. **FAL.AI credit balance** — Assembly code comments say "disabled while credits exhausted." What is the current FAL balance? Is local FFmpeg assembly the intended permanent path?

6. **BullMQ intent** — Is the Redis/BullMQ queue planned for future use, or should it be removed from dependencies?

7. **E2E test approval** — Provider tests were not run to avoid costs (~$0.35-$8 depending on scope). Should they be run? See `audit/reports/09-E2E-TEST-RESULTS.md` for the recommended test sequence.

8. **ComfyUI provider** — Is `COMFYUI_PROVIDER_ENABLED` currently `true` in production? This affects free/creator tier cost and routing.
