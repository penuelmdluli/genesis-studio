// ============================================
// MBS Branding — calls Railway scraper service
// to apply ffmpeg overlays to Kling output.
// ============================================

import { envString } from "@/lib/env";

const HOOKS = [
  "Wait for it 🔥",
  "WHO DIS 👀",
  "Meet {character} 🔥",
  "{character} said WATCH ME 🔥",
  "The culture is ALIVE 🔥",
  "{character} feeling the music 🔥",
  "They just walked in 🔥",
];

const CTAS = [
  "Drop ⭐ for RESPECT!",
  "Tag a dance partner ⭐",
  "Follow @MzansiBabyStars 🔥",
  "Share this NOW 🔥",
];

export function pickHook(characterName: string): string {
  const t = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  return t.replace("{character}", characterName);
}

export function pickCTA(): string {
  return CTAS[Math.floor(Math.random() * CTAS.length)];
}

export async function applyMBSBranding(opts: {
  inputVideoUrl: string;
  outputR2Key: string;
  characterName: string;
  hookText?: string;
  ctaText?: string;
}): Promise<{ publicUrl: string; r2Key: string }> {
  const scraperUrl = envString("SCRAPER_SERVICE_URL");
  const scraperSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!scraperUrl || !scraperSecret) {
    throw new Error("SCRAPER_SERVICE_URL or SCRAPER_SERVICE_SECRET not configured");
  }

  const hook = opts.hookText ?? pickHook(opts.characterName);
  const cta = opts.ctaText ?? pickCTA();

  const res = await fetch(`${scraperUrl}/apply-branding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-scraper-secret": scraperSecret,
    },
    body: JSON.stringify({
      inputVideoUrl: opts.inputVideoUrl,
      outputR2Key: opts.outputR2Key,
      hookText: hook,
      characterName: opts.characterName,
      ctaText: cta,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Branding failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { r2Key: string; publicUrl: string };
  return { publicUrl: data.publicUrl, r2Key: data.r2Key };
}
