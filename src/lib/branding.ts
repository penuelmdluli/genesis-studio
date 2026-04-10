// ============================================
// Video Branding Pipeline (DISABLED)
//
// Platform-branded watermarks/overlays are disabled by policy:
// we keep the magic behind the curtain and let channel branding dominate.
// The function is kept as a no-op so existing callers still compile.
// ============================================

type PlanTier = "free" | "creator" | "pro" | "studio";

interface BrandingOptions {
  videoUrl: string;
  prompt: string;
  plan: PlanTier;
  creatorName?: string;
}

/**
 * No-op: returns the original video URL unchanged.
 * All platform watermarks, prompt overlays, and outro cards are disabled.
 */
export async function brandVideo(options: BrandingOptions): Promise<string> {
  return options.videoUrl;
}

/**
 * Get the user's plan tier for branding decisions.
 */
export function getPlanTier(planId?: string): PlanTier {
  if (!planId || planId === "free") return "free";
  if (planId === "creator") return "creator";
  if (planId === "pro") return "pro";
  if (planId === "studio") return "studio";
  return "free";
}
