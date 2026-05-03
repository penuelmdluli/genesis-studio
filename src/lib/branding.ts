// ============================================
// Video Branding Pipeline
//
// Free tier: videos get "Made with genesisstudio.app" watermark
// Creator+: no watermark (clean output = upgrade incentive)
// ============================================

type PlanTier = "free" | "creator" | "pro" | "studio";

interface BrandingOptions {
  videoUrl: string;
  prompt: string;
  plan: PlanTier;
  creatorName?: string;
}

/**
 * Brand a video based on plan tier.
 * Free tier gets a subtle watermark via FAL's compose endpoint.
 * Paid tiers get the original video unchanged (no watermark).
 */
export async function brandVideo(options: BrandingOptions): Promise<string> {
  // Paid plans: no watermark, clean output
  if (options.plan !== "free") {
    return options.videoUrl;
  }

  // Free tier: add watermark via FAL
  try {
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY || "" });

    const result = await fal.queue.submit("fal-ai/workflow-utilities/auto-subtitle", {
      input: {
        video_url: options.videoUrl,
        // Subtle bottom-right watermark
        font: "Montserrat/Montserrat-Medium.ttf",
        font_size: 28,
        font_color: "white",
        stroke_color: "black",
        stroke_width: 1,
        caption_position: "bottom",
        // The "subtitle" is actually our watermark text
        srt_content: "1\n00:00:00,000 --> 99:59:59,999\nMade with genesisstudio.app",
      } as Record<string, unknown> & { video_url: string },
    });

    // Poll for result
    const pollResult = await fal.queue.result("fal-ai/workflow-utilities/auto-subtitle", {
      requestId: result.request_id,
    });

    const data = pollResult.data as Record<string, unknown>;
    const videoUrl = (data?.video as { url?: string })?.url || (data?.video_url as string);

    if (videoUrl) {
      console.log(`[BRANDING] Watermark applied to free-tier video`);
      return videoUrl;
    }
  } catch (err) {
    console.warn("[BRANDING] Watermark failed, using original:", err);
  }

  // Fallback: return original (watermark is nice-to-have, not blocking)
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
