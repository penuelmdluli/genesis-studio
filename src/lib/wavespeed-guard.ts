// ============================================
// GENESIS STUDIO — WaveSpeed Spend Policy
// ============================================
// WaveSpeed is reserved for the dancing/mimic videos and nothing else.
//
// It is the only funded provider we have — FAL is locked on an exhausted
// balance — so every other feature that reaches for it is spending the budget
// the dance pipeline needs. Owner call 2026-08-31: dedicate it.
//
// Two purposes are allowed, because a dance video needs both halves:
//   * "motion"           — the motion-control render itself
//   * "motion-character"  — the character still that render animates
//
// Everything else (general video generation, React Studio, marketing images,
// the Images and Music Video pages) is refused while the reservation holds.
//
// src/lib/motion-control.ts deliberately does NOT consult this guard. It calls
// WaveSpeed directly and is the reserved purpose by definition — routing it
// through a switch that could be flipped off is how the one thing that must
// keep working stops working.
//
// Set WAVESPEED_MOTION_ONLY=false to lift the reservation.

import { envString } from "@/lib/env";

export type WavespeedPurpose = "motion" | "motion-character";

/** True while WaveSpeed spend is reserved for the dance pipeline. */
export function wavespeedReserved(): boolean {
  // Default ON: an unset variable must not silently reopen the budget.
  return envString("WAVESPEED_MOTION_ONLY") !== "false";
}

/**
 * Whether a caller may spend WaveSpeed budget.
 * Pass the purpose when the call belongs to the dance pipeline.
 */
export function wavespeedAllowed(purpose?: WavespeedPurpose): boolean {
  if (!wavespeedReserved()) return true;
  return purpose === "motion" || purpose === "motion-character";
}

/** Message shown when a feature is refused. Keep it about the product. */
export const WAVESPEED_RESERVED_MESSAGE =
  "This feature is paused while our video engine is dedicated to Motion Studio. It'll be back shortly.";
