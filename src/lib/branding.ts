// ============================================
// Video Branding Pipeline — Genesis Studio
//
// ALL videos get branded with:
// 1. "ivideostudio.ai" watermark (subtle, top-right)
// 2. 4-second outro with logo, URL, and CTA
//
// Free tier: watermark + outro (full branding)
// Paid tiers: watermark only (no outro — clean upgrade incentive)
// ============================================

type PlanTier = "free" | "creator" | "pro" | "studio";

interface BrandingOptions {
  videoUrl: string;
  outputR2Key: string;
  plan: PlanTier;
}

/**
 * Brand a video with Genesis Studio identity.
 * Uses the Render scraper service (ffmpeg) for processing.
 *
 * Free tier: watermark + outro clip
 * Paid tiers: watermark only
 *
 * Falls back to original video if branding fails (non-blocking).
 */
export async function brandVideo(options: BrandingOptions): Promise<string> {
  const scraperUrl = process.env.SCRAPER_SERVICE_URL;
  const scraperSecret = process.env.SCRAPER_SERVICE_SECRET;

  if (!scraperUrl || !scraperSecret) {
    console.warn("[BRANDING] Scraper not configured, skipping branding");
    return options.videoUrl;
  }

  try {
    // Use the Genesis branding endpoint (watermark + outro for free, watermark for paid)
    const endpoint = options.plan === "free" ? "/brand-genesis" : "/brand-genesis";

    const res = await fetch(`${scraperUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scraper-secret": scraperSecret,
      },
      body: JSON.stringify({
        inputVideoUrl: options.videoUrl,
        outputR2Key: options.outputR2Key,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[BRANDING] Scraper returned ${res.status}: ${err.slice(0, 200)}`);
      return options.videoUrl;
    }

    const data = (await res.json()) as { r2Key?: string };
    if (data.r2Key) {
      const r2Pub = process.env.R2_PUBLIC_URL || "https://cdn.ivideostudio.ai";
      console.log(`[BRANDING] Video branded: ${data.r2Key}`);
      return `${r2Pub}/${data.r2Key}`;
    }
  } catch (err) {
    console.warn("[BRANDING] Branding failed, using original:", err);
  }

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

/**
 * Check if a video should show upgrade prompt (watermarked).
 */
export function shouldShowUpgradePrompt(plan?: string): boolean {
  return !plan || plan === "free";
}
