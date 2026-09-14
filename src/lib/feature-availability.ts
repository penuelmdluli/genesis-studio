// ============================================
// GENESIS STUDIO — Feature Availability
// ============================================
// Which navigation features can actually do their job right now.
//
// `feature-flags.ts` answers a different question: should this be visible at
// launch? That is a product decision and stays hand-edited. This file answers
// "would it work if a user clicked it?", which is a fact about provider state
// and must never be hand-maintained — that is exactly how the menu came to
// advertise a dozen tools that could not run.
//
// The gap this closes is the one users kept reporting. `/api/features/status`
// only ever checked RunPod endpoint variables, so every FAL-backed feature —
// AI Thumbnails, Upscaler, Auto Captions, Product Ads, Music Video, AI Avatar
// — advertised itself as working while FAL sat locked behind a 403. Three of
// the nine open support tickets say some version of "AI model isn't working".

import { envString } from "@/lib/env";

/** What a feature needs before it can serve a request. */
export type Requirement =
  | { kind: "none" }                              // no external generation
  | { kind: "wavespeed" }                         // WaveSpeed only
  | { kind: "fal" }                               // FAL only
  | { kind: "hosted" }                            // either hosted provider
  | { kind: "runpod"; envKey: string };           // a specific RunPod endpoint

/**
 * Route → requirement. Derived by reading each feature's API route, not from
 * intent: a feature is listed against the provider its code actually calls.
 */
export const FEATURE_REQUIREMENTS: Record<string, Requirement> = {
  // Everything that generates runs on the hosted router now. WaveSpeed is
  // the funded provider; FAL is a fallback for the video models that list
  // one. Verified end to end on 2026-09-12 after every FAL-only tool was
  // moved across.
  "/generate": { kind: "hosted" },
  "/motion-control": { kind: "hosted" },
  "/react-studio": { kind: "hosted" },
  "/talking-avatar": { kind: "wavespeed" },   // infinitetalk-fast
  "/upscale": { kind: "wavespeed" },          // bytedance/video-upscaler
  "/captions": { kind: "wavespeed" },         // openai-whisper-with-video
  "/thumbnails": { kind: "wavespeed" },       // flux-2-flash
  "/images": { kind: "wavespeed" },           // flux-dev (was mislabelled fal)
  "/ai-singer": { kind: "wavespeed" },        // ace-step-1.5 + infinitetalk-fast
  "/tools": { kind: "wavespeed" },            // creator tools registry

  // Still FAL-only: lib/video-pipeline.ts calls fal.subscribe for audio,
  // loudnorm and compose. Hidden from the menu until moved.
  "/product-ads": { kind: "fal" },
  "/music-video": { kind: "fal" },
  "/brain": { kind: "fal" },
  "/brain/templates": { kind: "fal" },

  // No external generation — these work whatever the providers are doing.
  "/voiceover": { kind: "none" },       // msedge-tts, runs in-process
  "/lead-videos": { kind: "none" },     // scraper service
  "/dashboard": { kind: "none" },
  "/grow": { kind: "none" },
  "/gallery": { kind: "none" },
  "/collections": { kind: "none" },
  "/explore": { kind: "none" },
  "/api-keys": { kind: "none" },
  "/pricing": { kind: "none" },
  "/settings": { kind: "none" },
  "/edit": { kind: "none" },
};

export interface ProviderState {
  wavespeed: boolean;
  fal: boolean;
}

/**
 * Live provider state, cached.
 *
 * The menu is rendered on nearly every request, so this must not make a
 * network call per render. Five minutes is short enough that a top-up shows up
 * quickly and long enough that provider APIs are not hammered.
 */
let cached: { state: ProviderState; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getProviderState(force = false): Promise<ProviderState> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.state;

  const [wavespeed, fal] = await Promise.all([wavespeedFunded(), falFunded()]);
  cached = { state: { wavespeed, fal }, at: Date.now() };
  return cached.state;
}

async function wavespeedFunded(): Promise<boolean> {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) return false;
  try {
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { balance?: number } };
    return (json.data?.balance ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * FAL publishes no balance endpoint. An empty body is rejected at validation
 * before any billable work, so a 401/403 is unambiguously an account problem
 * and anything else means FAL would accept work. The probe is free.
 */
async function falFunded(): Promise<boolean> {
  const key = process.env.FAL_KEY;
  if (!key) return false;
  try {
    const res = await fetch(
      "https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video",
      {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: "{}",
      }
    );
    return res.status !== 403 && res.status !== 401;
  } catch {
    return false;
  }
}

export interface FeatureStatus {
  available: boolean;
  /** Shown to users. Never names a vendor. */
  reason?: string;
}

export function evaluateFeature(href: string, providers: ProviderState): FeatureStatus {
  const req = FEATURE_REQUIREMENTS[href];
  // An unlisted route is assumed fine — a new page should not vanish from the
  // menu just because nobody added it here.
  if (!req) return { available: true };

  switch (req.kind) {
    case "none":
      return { available: true };
    case "wavespeed":
      return providers.wavespeed
        ? { available: true }
        : { available: false, reason: "Temporarily unavailable" };
    case "fal":
      return providers.fal
        ? { available: true }
        : { available: false, reason: "Temporarily unavailable" };
    case "hosted":
      return providers.wavespeed || providers.fal
        ? { available: true }
        : { available: false, reason: "Temporarily unavailable" };
    case "runpod": {
      const raw = envString(req.envKey);
      return raw && /^[a-z0-9]{10,20}$/.test(raw)
        ? { available: true }
        : { available: false, reason: "Coming soon" };
    }
  }
}

/** Availability for every known route, in one pass. */
export async function getAllFeatureStatus(): Promise<Record<string, FeatureStatus>> {
  const providers = await getProviderState();
  const out: Record<string, FeatureStatus> = {};
  for (const href of Object.keys(FEATURE_REQUIREMENTS)) {
    out[href] = evaluateFeature(href, providers);
  }
  return out;
}
