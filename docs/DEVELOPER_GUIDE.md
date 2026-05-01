# Developer Guide

## Prerequisites
- Node.js 22+
- npm
- Git

## Quick Start

```bash
# Clone
git clone https://github.com/penuelmdluli/genesis-studio.git
cd genesis-studio

# Install
npm install

# Environment
cp .env.example .env.local
# Fill in required values (see .env.example for descriptions)

# Run
npm run dev
# Open http://localhost:3000
```

## Required Environment Variables

At minimum you need:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (Clerk auth)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (database)
- `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` (storage)
- `R2_PUBLIC_URL` (public video CDN URL)
- `FAL_KEY` (video generation)

## Project Structure

```
src/
  app/           # Next.js App Router (pages + API routes)
    api/         # 135 API routes
    (dashboard)/ # Auth-protected pages
    (static)/    # Public pages
  components/    # React components
  lib/           # Business logic, utilities, external service clients
  hooks/         # Custom React hooks
  types/         # TypeScript types
```

## Key Files
- `src/proxy.ts` — Clerk middleware (Next.js 16 "proxy" convention)
- `src/lib/storage.ts` — R2 client + `r2PublicUrl()` helper
- `src/lib/db.ts` — Supabase queries
- `src/lib/credits.ts` — Credit ledger system
- `src/lib/constants.ts` — AI model definitions, pricing, access tiers
- `src/lib/fal.ts` — FAL.AI integration
- `src/lib/runpod.ts` — RunPod integration
- `next.config.ts` — CSP, headers, security config

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm test` | Run unit tests (Vitest) |

## Deployment

Merging to `main` auto-deploys to Vercel production.
Manual deploy: `vercel --prod`

## Adding a New AI Model

1. Add model config to `src/lib/constants.ts` → `AI_MODELS`
2. Add to tier access in `MODEL_ACCESS`
3. If FAL: add endpoint mapping in `src/lib/fal.ts`
4. If RunPod: add endpoint env var and mapping in `src/lib/runpod.ts`
5. Test via `/generate` page
