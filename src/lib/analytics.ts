/**
 * Genesis Studio — Lightweight analytics event tracking.
 * Events are stored in D1 for the admin dashboard.
 */

import { getDb } from "./db-driver";

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
    const supabase = getDb();
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
 * Client-side analytics placeholder.
 * Cloudflare Web Analytics handles page-level metrics automatically.
 */
export function trackClientEvent(_event: string, _properties?: Record<string, string | number>) {
  // Cloudflare Web Analytics handles this — no custom client events needed
}
