# Genesis Studio — External Dependencies

**Audit date:** 2026-04-25

---

| Service | Purpose | Auth method | Health check | Failure impact |
|---------|---------|-------------|--------------|----------------|
| **FAL.AI** | Video gen (Kling/Veo/Seedance), TTS (ElevenLabs/Kokoro), SFX (Stable Audio), captions (Whisper), upscaling (Pulsar), avatars (Talks), FFmpeg ops | API key (`FAL_KEY`) | None | **CRITICAL** — Hollywood-tier video gen down, TTS down (falls back to Edge TTS), captions down, upscaling down, thumbnails down, sound design down |
| **RunPod** | Video gen (Wan 2.2, Hunyuan, LTX, Mochi, CogVideo, MimicMotion), ComfyUI | API key (`RUNPOD_API_KEY`) + webhook secret | None | **CRITICAL** — All RunPod model generation down. Brain Studio falls back to FAL models only. Single-scene RunPod gen completely blocked. |
| **Cloudflare R2** | Video/audio/thumbnail storage | S3 creds (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) | None | **CRITICAL** — All generated videos lost. Existing videos inaccessible. Complete platform outage for video delivery. |
| **Supabase** | PostgreSQL DB + user/job/production data | Service role key + anon key | None | **CRITICAL** — Complete app down. No user auth resolution, no job tracking, no credit ledger. |
| **Clerk** | User authentication | Secret + publishable keys | None | **CRITICAL** — No one can sign in. All authenticated routes blocked. |
| **Anthropic (Claude)** | Brain Studio planner, quality scoring, moderation, CTA generation, sound design direction, chat, prompt enhancement | API key (`ANTHROPIC_API_KEY`) | None | **HIGH** — Brain Studio planning disabled. Prompt enhancement unavailable. Chat assistant down. Content moderation bypassed. |
| **Stripe** | Subscription billing, credit pack purchases, annual plans | Secret key + webhook secret | Webhook verification | **HIGH** — No new subscriptions. Credit pack purchases blocked. Revenue stops. Existing users unaffected short-term. |
| **Vercel** | Hosting + CDN + cron jobs | Platform | Platform status page | **CRITICAL** — Complete platform outage. |
| **PayFast** | South African EFT/SnapScan/Mobicred payments | Merchant ID + key + passphrase | None | **MEDIUM** — SA local payment methods blocked. Stripe still works for card payments. |
| **Paystack** | African card payments (Nigeria, Ghana) | Secret key | None | **MEDIUM** — African payment fallback blocked. Stripe still works. |
| **Yoco** | South African card payments | Secret key + webhook secret | None | **MEDIUM** — SA card payment alternative blocked. Stripe still works. |
| **Resend** | Transactional email (welcome, low-credit, retention) | API key | None | **LOW** — Emails don't send. App still works. Users miss notifications. |
| **WATI (WhatsApp)** | WhatsApp notifications | API URL + key | None | **LOW** — WhatsApp messages don't send. App unaffected. |
| **Facebook Graph API** | Auto-posting to 7 pages, insights fetching | Page access tokens (7) | None | **LOW** — Auto-posting stops. Content pipeline paused. App unaffected. |
| **EskomSePush** | Load shedding status (South Africa) | API key | None | **NEGLIGIBLE** — Load shedding banner doesn't show. Feature-only. |
| **Pexels / Pixabay** | Stock footage emergency fallback | API keys | None | **NEGLIGIBLE** — Stock fallback unavailable. AI generation still works. |
| **NewsAPI / Gemini** | News trending topic sourcing | API keys | None | **LOW** — Content pipeline can't auto-discover topics. Manual topics still work. |

---

## Blast Radius Summary

### Total Outage (app unusable)
- Vercel, Supabase, Clerk — any one of these down = complete outage

### Revenue Blocked
- Stripe down = no new revenue (existing subs continue)
- All 4 payment processors down = zero new revenue globally

### Generation Blocked
- FAL.AI + RunPod both down = zero video generation
- FAL.AI alone down = no Hollywood models, no TTS/captions, RunPod models still work
- RunPod alone down = no Wan 2.2 (Brain Studio uses this primarily), FAL models still work

### Data Loss Risk
- R2 outage = generated videos inaccessible (but re-generatable)
- Supabase outage = user data, credit ledger, job history at risk (depends on backup policy)
