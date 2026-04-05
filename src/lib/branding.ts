// ============================================
// GENESIS STUDIO — Video Branding Pipeline
// Plan-tiered watermarking, overlays, and outro
// via FAL.AI FFmpeg compose-videos
// ============================================

import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

type PlanTier = "free" | "creator" | "pro" | "studio";

interface BrandingOptions {
  videoUrl: string;
  prompt: string;
  plan: PlanTier;
  creatorName?: string;
}

/**
 * Brand a video with Genesis Studio watermark, prompt overlay, and outro.
 *
 * Branding levels:
 * - free: Full watermark + prompt overlay (first 2.5s) + outro card
 * - creator: Small subtle watermark + small outro
 * - pro: Minimal watermark only
 * - studio: No branding (white-label)
 */
export async function brandVideo(options: BrandingOptions): Promise<string> {
  const { videoUrl, prompt, plan } = options;

  if (plan === "studio") return videoUrl; // Clean, no branding

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn("[BRANDING] FAL_KEY not set — skipping branding");
    return videoUrl;
  }

  // Build FFmpeg filter chain based on plan
  const filters: string[] = [];
  const inputs: Array<{ url: string; type: "video" | "audio" | "image" }> = [
    { url: videoUrl, type: "video" },
  ];

  // Watermark text overlay (all plans except studio)
  const watermarkAlpha =
    plan === "free" ? "0.6" : plan === "creator" ? "0.3" : "0.2";
  const watermarkSize = plan === "free" ? "22" : "16";
  filters.push(
    `drawtext=text='Genesis Studio':fontsize=${watermarkSize}:fontcolor=white@${watermarkAlpha}:x=w-tw-20:y=h-th-20:font=sans`
  );

  // Prompt overlay (free only, first 2.5 seconds)
  if (plan === "free") {
    const safePrompt = prompt
      .slice(0, 55)
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
    filters.push(
      `drawtext=text='${safePrompt}':fontsize=16:fontcolor=white@0.7:x=(w-tw)/2:y=h-70:enable='between(t\\,0\\,2.5)':font=sans`
    );
    filters.push(
      `drawtext=text='Made with Genesis Studio':fontsize=13:fontcolor=white@0.5:x=(w-tw)/2:y=h-45:enable='between(t\\,0\\,2.5)':font=sans`
    );
  }

  // Outro text (free and creator plans)
  if (plan === "free" || plan === "creator") {
    const outroSize = plan === "free" ? "28" : "20";
    const outroAlpha = plan === "free" ? "0.9" : "0.5";
    filters.push(
      `drawtext=text='genesis-studio.app':fontsize=${outroSize}:fontcolor=white@${outroAlpha}:x=(w-tw)/2:y=h-30:font=sans`
    );
  }

  try {
    const filterComplex = filters.join(",");

    const result = await fal.subscribe("fal-ai/ffmpeg-api/compose-videos", {
      input: {
        inputs,
        filter_complex: `[0:v]${filterComplex}[outv]`,
        output_args: [
          "-map",
          "[outv]",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-c:a",
          "copy",
          "-shortest",
        ],
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const output = data?.output as { url: string } | undefined;

    if (output?.url) {
      console.log(`[BRANDING] Branded video (${plan}): ${output.url}`);
      return output.url;
    }
    return videoUrl;
  } catch (err) {
    console.error("[BRANDING] FFmpeg branding failed:", err);
    return videoUrl; // Graceful fallback
  }
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
