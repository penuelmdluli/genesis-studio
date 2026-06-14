/**
 * GENESIS STUDIO — Branded Outro Clip
 *
 * A short branded clip appended to the END of every video before posting.
 * Uses the scraper service (ffmpeg on Railway) to:
 * 1. Generate or use a pre-made outro clip
 * 2. Concatenate it to the main video
 *
 * The outro contains: logo, website URL, CTA text, and optional voiceover.
 * Once generated, the outro is cached in R2 and reused across all videos.
 *
 * Format: 3-5 second clip with:
 * - Dark gradient background with subtle particle effects
 * - Genesis Studio logo (or text fallback)
 * - "ivideostudio.ai" URL prominently displayed
 * - CTA text: "Create YOUR own AI videos FREE"
 * - Optional: short voiceover saying the CTA
 */

import { envString } from "@/lib/env";

// ── Outro Configurations ──

export interface OutroConfig {
  id: string;
  name: string;
  duration: number; // seconds
  bgColor: string; // hex color for background
  textLines: string[];
  websiteUrl: string;
  ctaText: string;
  style: "dark" | "vibrant" | "minimal";
}

export const OUTRO_PRESETS: OutroConfig[] = [
  {
    id: "default",
    name: "Standard Dark",
    duration: 4,
    bgColor: "#0a0a0a",
    textLines: ["GENESIS STUDIO", "AI Video Platform"],
    websiteUrl: "ivideostudio.ai",
    ctaText: "Create YOUR own AI videos FREE",
    style: "dark",
  },
  {
    id: "mbs",
    name: "MBS Vibrant",
    duration: 4,
    bgColor: "#1a0533",
    textLines: ["MZANSI BABY STARS", "by Genesis Studio"],
    websiteUrl: "ivideostudio.ai",
    ctaText: "Make YOUR character dance → ivideostudio.ai",
    style: "vibrant",
  },
  {
    id: "tech-pulse",
    name: "Tech Pulse",
    duration: 3,
    bgColor: "#0d1117",
    textLines: ["TECH PULSE AFRICA", "Powered by AI"],
    websiteUrl: "ivideostudio.ai",
    ctaText: "AI-powered news → ivideostudio.ai",
    style: "dark",
  },
  {
    id: "minimal",
    name: "Minimal Clean",
    duration: 3,
    bgColor: "#000000",
    textLines: ["ivideostudio.ai"],
    websiteUrl: "ivideostudio.ai",
    ctaText: "50 FREE credits → No card needed",
    style: "minimal",
  },
];

/**
 * Apply a branded outro to a video using the scraper service.
 * The scraper uses ffmpeg to concatenate the outro clip to the video.
 *
 * Flow:
 * 1. Send video URL + outro config to scraper
 * 2. Scraper generates outro frames with ffmpeg (text overlays on solid bg)
 * 3. Scraper concatenates main video + outro
 * 4. Uploads result to R2, returns public URL
 */
export async function applyOutroToVideo(opts: {
  inputVideoUrl: string;
  outputR2Key: string;
  outroPresetId?: string;
}): Promise<{ publicUrl: string; r2Key: string }> {
  const scraperUrl = envString("SCRAPER_SERVICE_URL");
  const scraperSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!scraperUrl || !scraperSecret) {
    throw new Error("SCRAPER_SERVICE_URL or SCRAPER_SERVICE_SECRET not configured");
  }

  const preset = OUTRO_PRESETS.find((p) => p.id === (opts.outroPresetId || "default"))
    || OUTRO_PRESETS[0];

  const res = await fetch(`${scraperUrl}/apply-outro`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-scraper-secret": scraperSecret,
    },
    body: JSON.stringify({
      inputVideoUrl: opts.inputVideoUrl,
      outputR2Key: opts.outputR2Key,
      outroDuration: preset.duration,
      outroBgColor: preset.bgColor,
      outroTextLines: preset.textLines,
      outroWebsite: preset.websiteUrl,
      outroCta: preset.ctaText,
      outroStyle: preset.style,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outro apply failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { r2Key: string; publicUrl: string };
  return { publicUrl: data.publicUrl, r2Key: data.r2Key };
}

/**
 * Select the right outro preset based on the target page.
 */
export function getOutroPresetForPage(pageName: string): string {
  const lower = pageName.toLowerCase();
  if (lower.includes("baby") || lower.includes("mbs")) return "mbs";
  if (lower.includes("tech") || lower.includes("pulse")) return "tech-pulse";
  if (lower.includes("news") || lower.includes("genesis news")) return "default";
  return "default";
}
