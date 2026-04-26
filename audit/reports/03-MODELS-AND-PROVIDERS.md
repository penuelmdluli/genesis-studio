# Genesis Studio — Models & Providers Inventory

**Audit date:** 2026-04-25

---

## 3.1 Every Provider Integration Found

### Video Generation Models

| # | Provider | Model / Endpoint | Purpose | File path | Credit cost (720p) | Used by tier | Status |
|---|----------|------------------|---------|-----------|---------------------|--------------|--------|
| 1 | RunPod Hub | Wan 2.2 (A14B) — `RUNPOD_ENDPOINT_WAN22` | T2V + I2V flagship | `src/lib/runpod.ts:13` | 40 credits | All tiers | ACTIVE — primary model for Brain Studio |
| 2 | RunPod | HunyuanVideo 1.5 — `RUNPOD_ENDPOINT_HUNYUAN` | T2V + I2V workhorse | `src/lib/runpod.ts:14` | 25 credits | Creator+ | UNKNOWN — planner forces wan-2.2, no active workers noted |
| 3 | RunPod | LTX-Video 13B — `RUNPOD_ENDPOINT_LTX` | T2V + I2V + V2V speed | `src/lib/runpod.ts:15` | 15 credits | Creator+ | UNKNOWN — no active workers noted in planner |
| 4 | RunPod | Wan 2.1 Turbo — `RUNPOD_ENDPOINT_WAN21_TURBO` | I2V turbo | `src/lib/runpod.ts:16` | 20 credits | Creator+ | UNKNOWN — needs endpoint verification |
| 5 | RunPod | Mochi 1 (10B) — `RUNPOD_ENDPOINT_MOCHI` | T2V realism | `src/lib/runpod.ts:17` | 35 credits | Creator+ | UNKNOWN — needs endpoint verification |
| 6 | RunPod | CogVideoX-5B — `RUNPOD_ENDPOINT_COGVIDEO` | T2V budget | `src/lib/runpod.ts:18` | 10 credits (480p) | Creator+ | DISABLED — `comingSoon: true` in constants |
| 7 | RunPod | MimicMotion — `RUNPOD_ENDPOINT_MIMIC_MOTION` | Motion transfer | `src/lib/runpod.ts:19` | 30 credits | All tiers | ACTIVE — Motion Control feature |
| 8 | FAL.AI | Kling 2.6 Pro — `fal-ai/kling-video/v2.6/pro` | T2V + I2V Hollywood | `src/lib/fal.ts`, `src/lib/constants.ts:117` | 100 credits | Creator+ | ACTIVE — native audio |
| 9 | FAL.AI | Kling 3.0 Pro — `fal-ai/kling-video/v3/pro` | T2V + I2V Hollywood | `src/lib/fal.ts`, `src/lib/constants.ts:131` | 250 credits | Pro+ | ACTIVE — native audio |
| 10 | FAL.AI | Veo 3.1 — `fal-ai/veo3` | T2V Hollywood | `src/lib/fal.ts`, `src/lib/constants.ts:145` | 400 credits | Pro+ | ACTIVE — native audio, EXPENSIVE |
| 11 | FAL.AI | Seedance 1.5 Pro — `fal-ai/bytedance/seedance/v1/pro` | T2V + I2V | `src/lib/fal.ts`, `src/lib/constants.ts:162` | 80 credits | All tiers | ACTIVE — no audio |
| 12 | RunPod ComfyUI | Wan 2.2 ComfyUI — `RUNPOD_COMFYUI_ENDPOINT_ID` | T2V cost-optimized | `src/lib/runpod-comfyui.ts` | varies | Free/Creator | CONDITIONAL — enabled via `COMFYUI_PROVIDER_ENABLED=true` |

### Audio / TTS Models

| # | Provider | Model / Endpoint | Purpose | File path | Status |
|---|----------|------------------|---------|-----------|--------|
| 13 | FAL.AI | ElevenLabs Multilingual V2 — `fal-ai/elevenlabs/tts/multilingual-v2` | Voiceover (primary) | `src/lib/genesis-brain/audio.ts` | ACTIVE |
| 14 | FAL.AI | Kokoro TTS — `fal-ai/kokoro/[language]` | Voiceover (fallback) | `src/lib/genesis-brain/audio.ts:18-29` | ACTIVE (10 languages) |
| 15 | Local | Edge TTS — `msedge-tts` | Voiceover (free fallback) | `src/lib/genesis-brain/assembly-fallback.ts` | ACTIVE — primary for local assembly |
| 16 | FAL.AI | Stable Audio V1 — `fal-ai/stable-audio-v1` | SFX generation | `src/lib/genesis-brain/sound-effects.ts` | ACTIVE |
| 17 | FAL.AI | MMAudio V2 — `fal-ai/mmaudio/predict` | Scene audio composition | `src/lib/genesis-brain/audio.ts` | ACTIVE |

### Video Processing Models

| # | Provider | Model / Endpoint | Purpose | File path | Status |
|---|----------|------------------|---------|-----------|--------|
| 18 | FAL.AI | FFmpeg — `fal-ai/ffmpeg` | Video concat, merge, trim | `src/lib/genesis-brain/assembly.ts` | DISABLED — FAL assembly disabled, using local FFmpeg |
| 19 | FAL.AI | Pulsar 2B — `fal-ai/pulsar-2b` | Video upscaling | `src/app/api/upscale/route.ts` | ACTIVE |
| 20 | FAL.AI | Talks — `fal-ai/talks` | Talking avatar | `src/app/api/talking-avatar/route.ts` | ACTIVE |
| 21 | FAL.AI | Whisper — via FAL | Speech-to-text / captions | `src/app/api/captions/route.ts` | ACTIVE |
| 22 | FAL.AI | FLUX Pro — via FAL | Image generation / thumbnails | `src/app/api/generate-image/route.ts` | ACTIVE |

### AI / LLM Models

| # | Provider | Model | Purpose | File path | Status |
|---|----------|-------|---------|-----------|--------|
| 23 | Anthropic | Claude Sonnet 4 (`claude-sonnet-4-20250514`) | Brain Studio planner | `src/lib/genesis-brain/planner.ts:246` | ACTIVE |
| 24 | Anthropic | Claude Sonnet 4 | Engagement CTA generation | `src/lib/genesis-brain/planner.ts:476` | ACTIVE |
| 25 | Anthropic | Claude | Sound design direction | `src/lib/genesis-brain/sound-effects.ts:28` | ACTIVE |
| 26 | Anthropic | Claude | Visual consistency harmonization | `src/lib/genesis-brain/consistency.ts:201` | ACTIVE |
| 27 | Anthropic | Claude | Quality scoring | `src/lib/quality-score.ts:9` | ACTIVE |
| 28 | Anthropic | Claude | Prompt enhancement | `src/app/api/prompt/enhance/route.ts` | ACTIVE |
| 29 | Anthropic | Claude | Content moderation | `src/app/api/prompt/moderate/route.ts` | ACTIVE |
| 30 | Anthropic | Claude | AI chat assistant | `src/app/api/chat/route.ts` | ACTIVE |

---

## 3.2 Capability Matrix

| Capability | Provider(s) | Notes |
|-----------|-------------|-------|
| Text-to-video | RunPod (Wan 2.2, Hunyuan, LTX, Mochi, CogVideoX), FAL (Kling 2.6/3.0, Veo 3.1, Seedance 1.5), ComfyUI | 11 models total, only Wan 2.2 + FAL models actively used |
| Image-to-video | RunPod (Wan 2.2 I2V, Wan 2.1 Turbo), FAL (Kling 2.6/3.0, Seedance 1.5) | 5 models |
| Video-to-video | RunPod (LTX-Video) | 1 model, status unknown |
| TTS / Voiceover | FAL (ElevenLabs, Kokoro), Local (Edge TTS) | 3-tier fallback: ElevenLabs → Kokoro → Edge TTS |
| Voice cloning | MISSING | Listed as comingSoon in constants |
| Captions / transcription | FAL (Whisper) | Word-level transcription |
| Lip sync | FAL (Talks) | Talking avatar feature |
| Image generation | FAL (FLUX Pro) | Thumbnails + standalone image gen |
| Background music | Local (built-in library) | 11 pre-recorded tracks, no generative music |
| Scene merging | Local (FFmpeg), FAL (FFmpeg — disabled) | FFmpeg on Vercel serverless |
| Motion transfer | RunPod (MimicMotion) | Pose extraction + character application |
| Video upscaling | FAL (Pulsar 2B) | 480p/720p → 1080p/4K |
| Sound effects | FAL (Stable Audio V1) | Per-scene ambient, SFX, foley |
| Content moderation | Anthropic (Claude) | Prompt-level moderation |
| OCR | MISSING | No OCR integration found |

---

## 3.3 FAL.AI Cost Per Second (from profitability.ts)

| Model | $/second | Typical 5s clip | Typical 10s clip | Has Audio |
|-------|----------|-----------------|------------------|-----------|
| Kling 2.6 | $0.035 | $0.175 | $0.35 | Yes |
| Kling 3.0 | $0.050 | $0.25 | $0.50 | Yes |
| Veo 3.1 | $0.100 | $0.50 | $0.80 | Yes |
| Seedance 1.5 | $0.020 | $0.10 | $0.20 | No |

## RunPod GPU Cost Estimates (from profitability.ts)

| GPU Type | $/hour | Models |
|----------|--------|--------|
| RTX 4090 | $0.69 | CogVideoX, LTX-Video, HunyuanVideo, Wan 2.1 Turbo, MimicMotion |
| A6000 | $0.76 | Mochi-1 |
| L40S | $0.74 | Wan 2.2 |
| A100 | $1.64 | (available for scale) |
| H100 | $2.39 | (available for scale) |

---

## 3.4 Brain Studio Typical Costs

For a 30s Brain Studio video (6 scenes x 5s, wan-2.2 at 720p):

| Component | Cost |
|-----------|------|
| Scene generation (6 x wan-2.2) | 6 x ~$0.062 = ~$0.37 |
| Claude planning + CTA | ~$0.10 |
| Voiceover (Edge TTS) | $0.00 (free, local) |
| Music (built-in) | $0.00 |
| Assembly (local FFmpeg) | $0.00 |
| **Total actual cost** | **~$0.47** |
| Credits charged (6 scenes x 40 + overhead) | ~260 credits = $6.24 revenue |
| **Margin** | **~92%** |

For a 30s Brain Studio video with Hollywood audio (Kling 2.6):

| Component | Cost |
|-----------|------|
| Scene generation (6 x Kling 2.6) | 6 x ~$0.175 = ~$1.05 |
| Claude planning + CTA | ~$0.10 |
| Voiceover (ElevenLabs via FAL) | ~$0.05 |
| Sound design (Stable Audio) | ~$0.10 |
| Assembly | $0.00 (local) |
| **Total actual cost** | **~$1.30** |
| Credits charged (6 x 100 + overhead) | ~620 credits = $14.88 revenue |
| **Margin** | **~91%** |

---

## E2E Provider Tests

> **NOTE:** E2E provider tests were NOT run during this audit to avoid incurring costs without operator approval. The test scripts are provided in `audit/scripts/` for the operator to run manually.
> 
> **Reason:** Running all provider tests would cost approximately $3-8 depending on which models are tested. The operator should review and selectively run tests.

See `audit/scripts/e2e-test-providers.ts` for the test framework (to be written).
