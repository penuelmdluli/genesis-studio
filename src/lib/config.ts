// ============================================
// GENESIS STUDIO — Provider Configuration
// ============================================
// Two jobs, deliberately separated:
//
//   assertCoreConfig()   — process-wide invariants. Loud, fails fast.
//   modelAvailability()  — per-model, per-request. Answers "can this actually
//                          run right now?" BEFORE the user is charged.
//
// The split matters. A strict boot check that refused to start on any missing
// provider variable would take the whole site down today: 13 variables read by
// application code are unset in production (12 RUNPOD_ENDPOINT_* plus
// PAYSTACK_SECRET_KEY, audited 2026-09-09). Most of them belong to features
// nobody is using. Refusing to boot would turn a handful of broken features
// into a total outage, so core config fails loudly and per-feature config
// degrades honestly instead.
//
// The failure this closes is the expensive one. Production has charged users
// and then discovered the config was missing — "No GPU endpoint configured for
// CogVideoX-5B" (3 jobs) and "RUNPOD_ENDPOINT_ACE_STEP not configured"
// (1 job) both debited first and refunded after. Checking before the debit
// makes that impossible.

import { z } from "zod";
import { envString } from "@/lib/env";
import { AI_MODELS } from "@/lib/constants";
import type { ModelId, GenerationType } from "@/types";

/** Variables without which the app cannot serve a correct request at all. */
const coreSchema = z.object({
  APP_URL: z.string().url("APP_URL must be an absolute URL"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
});

export interface ConfigProblem {
  key: string;
  message: string;
}

/**
 * Validate the process-wide invariants.
 *
 * Returns the problems rather than throwing, so callers choose the severity:
 * `/api/health/providers` reports them, and a deploy check can fail on them.
 */
export function checkCoreConfig(): ConfigProblem[] {
  const parsed = coreSchema.safeParse({
    APP_URL: envString("APP_URL") || envString("NEXT_PUBLIC_APP_URL"),
    CRON_SECRET: envString("CRON_SECRET"),
  });

  const problems: ConfigProblem[] = parsed.success
    ? []
    : parsed.error.issues.map((i) => ({
        key: String(i.path[0] ?? "config"),
        message: i.message,
      }));

  // Every generation path ends at one of these two. With neither key set,
  // nothing in the product can produce a video.
  if (!envString("WAVESPEED_API_KEY") && !process.env.FAL_KEY) {
    problems.push({
      key: "WAVESPEED_API_KEY / FAL_KEY",
      message: "No hosted video provider is configured — generation cannot work",
    });
  }

  return problems;
}

/** Throwing form, for scripts and deploy gates that should stop on a problem. */
export function assertCoreConfig(): void {
  const problems = checkCoreConfig();
  if (problems.length > 0) {
    throw new Error(
      "Invalid configuration:\n" +
        problems.map((p) => `  - ${p.key}: ${p.message}`).join("\n")
    );
  }
}

/**
 * A RunPod endpoint id is 14 lowercase alphanumerics. Anything else in the
 * variable is a misconfiguration, not an endpoint — production currently holds
 * `RUNPOD_ENDPOINT_WAN22_I2V="wan-2-2-i2v-720-lora"`, which is an endpoint
 * *name*. Sending that to the API returns a 404 that reads like an outage.
 */
function isRunpodEndpointId(raw: string | undefined): boolean {
  return !!raw && /^[a-z0-9]{10,20}$/.test(raw);
}

const RUNPOD_ENDPOINT_VARS: Partial<Record<ModelId, string>> = {
  "wan-2.1-turbo": "RUNPOD_ENDPOINT_WAN21_TURBO",
  "mochi-1": "RUNPOD_ENDPOINT_MOCHI",
  "mimic-motion": "RUNPOD_ENDPOINT_MIMIC_MOTION",
  "hunyuan-video": "RUNPOD_ENDPOINT_HUNYUAN",
  "ltx-video": "RUNPOD_ENDPOINT_LTX",
};

export interface ModelAvailability {
  runnable: boolean;
  /** Shown to the user. Plain language, no vendor names, no variable names. */
  reason?: string;
  /** Logged, not shown. Names the exact missing piece. */
  detail?: string;
}

/**
 * Can this model actually serve a request right now?
 *
 * Called before credits are taken. It answers from configuration only — it
 * does not make a network call, so it is free and adds no latency. A provider
 * that is configured but out of balance still fails at submit time; that path
 * refunds, and the circuit breaker in vendor-failover.ts carries the memory.
 */
export function modelAvailability(
  modelId: ModelId,
  type: GenerationType
): ModelAvailability {
  const model = AI_MODELS[modelId];
  if (!model) {
    return { runnable: false, reason: "That model is not available.", detail: `Unknown model ${modelId}` };
  }

  if (model.comingSoon) {
    return { runnable: false, reason: `${model.name} is not available yet.`, detail: "comingSoon" };
  }

  // Hosted models (provider "fal" means "the hosted router" — WaveSpeed, then
  // FAL — see lib/provider-router.ts).
  if (model.provider === "fal") {
    const hasWavespeedKey = !!envString("WAVESPEED_API_KEY");
    const hasFalKey = !!process.env.FAL_KEY;

    const wsSlug = type === "i2v" ? model.wavespeedModelIdI2V : model.wavespeedModelId;
    const falSlug = type === "i2v" ? model.falModelIdI2V : model.falModelId;

    const viaWavespeed = hasWavespeedKey && !!wsSlug;
    const viaFal = hasFalKey && !!falSlug;

    if (!viaWavespeed && !viaFal) {
      return {
        runnable: false,
        reason: `${model.name} can't run this kind of generation right now.`,
        detail: `No usable slug/key: wavespeed=${hasWavespeedKey}/${!!wsSlug} fal=${hasFalKey}/${!!falSlug}`,
      };
    }
    return { runnable: true };
  }

  // Everything else is RunPod-backed.
  const varName = RUNPOD_ENDPOINT_VARS[modelId];
  if (!varName) {
    return {
      runnable: false,
      reason: `${model.name} is not available right now.`,
      detail: `No RunPod endpoint variable mapped for ${modelId}`,
    };
  }

  if (!isRunpodEndpointId(envString(varName))) {
    return {
      runnable: false,
      reason: `${model.name} is not available right now. Please pick another model.`,
      detail: `${varName} is missing or is not a valid endpoint id`,
    };
  }

  return { runnable: true };
}
