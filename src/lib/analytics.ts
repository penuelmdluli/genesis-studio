/**
 * Genesis Studio — Lightweight analytics event tracking.
 * Events are stored in Supabase for the admin dashboard.
 * Also fires Vercel Analytics custom events when available.
 */

import { createSupabaseAdmin } from "./supabase";

export type AnalyticsEvent =
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "prompt_enhanced"
  | "prompt_moderated_block"
  | "template_used"
  | "suggestion_clicked"
  | "credit_purchase"
  | "plan_upgrade"
  | "referral_shared"
  | "referral_redeemed"
  | "video_shared"
  | "video_downloaded"
  | "onboarding_completed"
  | "pwa_installed";

interface EventPayload {
  event: AnalyticsEvent;
  userId?: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Fire-and-forget analytics event. Never throws.
 */
export function trackEvent({ event, userId, properties }: EventPayload) {
  try {
    const supabase = createSupabaseAdmin();
    supabase
      .from("analytics_events")
      .insert({
        event,
        user_id: userId || null,
        properties: properties || {},
        created_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) {
          // Table may not exist yet — log silently
          console.debug(`[ANALYTICS] Insert failed (${event}):`, error.message);
        }
      });
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Client-side analytics (calls Vercel Analytics if loaded).
 */
export function trackClientEvent(event: string, properties?: Record<string, string | number>) {
  try {
    // Vercel Analytics custom events
    const w = window as unknown as Record<string, unknown>;
    if (typeof window !== "undefined" && typeof w.va === "function") {
      (w.va as (cmd: string, data: Record<string, unknown>) => void)("event", { name: event, ...properties });
    }
  } catch {
    // Never throw
  }
}
