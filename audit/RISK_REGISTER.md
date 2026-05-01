# Risk Register — 2026-05-01

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R1 | FAL.AI rate limit during traffic surge | M | H | Per-user daily cap + global cap + queue | Auto | Mitigated |
| R2 | Stripe webhook delay → stuck checkout | L | M | Polling fallback + clear UI state | Auto | Mitigated |
| R3 | Facebook page token expires mid-cron | M | M | 60-day refresh cycle + Slack alert on failure | Operator | Accepted |
| R4 | Single operator (bus factor = 1) | H | H | Runbooks + documented procedures + Penuel as backup | Operator | Accepted |
| R5 | South African ZAR/USD FX swing | M | L | Quarterly price review | Operator | Accepted |
| R6 | DDoS on auth endpoints | L | H | Clerk handles auth + Upstash rate limiting | Auto | Mitigated |
| R7 | POPIA enforcement action | L | H | Privacy policy + DSR flows + IO named | Auto | Partially mitigated |
| R8 | Cost runaway from buggy script | M | H | Daily caps + anomaly alerts | Auto | Mitigated |
| R9 | RunPod Wan 2.2 endpoint goes cold permanently | M | M | Switched onboarding to Seedance (FAL). Wan 2.2 is fallback only | Auto | Mitigated |
| R10 | Supabase free tier limits hit | M | H | Monitor row counts. Upgrade to Pro if approaching 500k rows | Operator | Accepted |
| R11 | R2 public URL changes or bucket renamed | L | H | Single env var (R2_PUBLIC_URL) controls all URLs | Auto | Mitigated |
| R12 | Clerk pricing increase or service disruption | L | M | Auth is abstracted through `auth()` calls. Migration to alternative possible | Operator | Accepted |
| R13 | Video generation model deprecated by provider | M | M | Multi-provider strategy (FAL + RunPod). Model config in constants.ts | Auto | Mitigated |
| R14 | User uploads malicious content (CSAM, copyright) | L | H | Prompt moderation. Reference image moderation. Manual review queue | Partially auto | Partially mitigated |
| R15 | Vercel serverless function cold starts degrade UX | M | L | Critical paths (generate, health) are frequently hit. Static pages pre-rendered | Auto | Accepted |
| R16 | Email deliverability drops (spam classification) | M | M | DKIM/SPF/DMARC configured. monitor via mail-tester.com monthly | Operator | Partially mitigated |
| R17 | Stripe test keys used in production | L | H | Verified sk_live_ prefix on production deploy | Auto | Mitigated |
| R18 | Credit balance goes negative from race condition | M | M | Credit deduction checks balance. Need atomic RPC for full safety | Auto | Partially mitigated |
| R19 | No automated backups verified | M | H | Supabase PITR enabled by default. Need manual verification | Operator | Action required |
| R20 | Source maps leak code structure | L | L | Next.js 16 defaults to no public source maps. Verified | Auto | Mitigated |
| R21 | No CI/CD — broken code ships to production | H | H | GitHub Actions CI pipeline created | Auto | Mitigated |
| R22 | No error tracking — production errors invisible | H | H | Health endpoint monitors deps. Sentry recommended but not yet installed | Operator | Action required |
