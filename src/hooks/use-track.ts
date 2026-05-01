"use client";

type PlausibleEventName =
  | "signup_started"
  | "signup_completed"
  | "first_generation_submitted"
  | "first_generation_completed"
  | "pricing_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "support_form_opened"
  | "video_shared"
  | "brain_production_started";

/**
 * Track a custom event via Plausible analytics.
 * No-ops gracefully if Plausible is not loaded.
 */
export function track(event: PlausibleEventName, props?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && typeof (window as unknown as { plausible?: (e: string, opts?: { props: Record<string, string | number | boolean> }) => void }).plausible === "function") {
    (window as unknown as { plausible: (e: string, opts?: { props: Record<string, string | number | boolean> }) => void }).plausible(event, props ? { props } : undefined);
  }
}

export function useTrack() {
  return { track };
}
