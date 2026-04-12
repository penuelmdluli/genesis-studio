// ============================================
// AFRICAN VOICE CONFIGURATION
// Optimized FAL Kokoro TTS parameters per language
// ============================================

export interface AfricanVoiceConfig {
  voice: string;
  speed: number;
  kokoroEndpoint: string;
}

/**
 * Optimized Kokoro voice parameters per African language.
 * Each config is tuned for the natural rhythm and energy of that language.
 */
export const AFRICAN_VOICE_PARAMS: Record<string, AfricanVoiceConfig> = {
  "en-ZA": {
    voice: "af_sky",
    speed: 1.05, // Slightly faster — SA energy
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  "en-NG": {
    voice: "af_bella",
    speed: 1.1, // Faster — Nigerian energy is high
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  "en-GH": {
    voice: "af_sarah",
    speed: 0.97, // Slightly slower — measured Ghanaian pace
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  "en-KE": {
    voice: "af_nicole",
    speed: 0.98, // Measured — Kenyan authority
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  zu: {
    voice: "af_sky",
    speed: 0.92, // Slower — Zulu flows warm and rich
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  xh: {
    voice: "af_sky",
    speed: 0.93,
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  st: {
    voice: "af_sky",
    speed: 0.93,
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  af: {
    voice: "bf_emma",
    speed: 0.97,
    kokoroEndpoint: "fal-ai/kokoro/british-english",
  },
  sw: {
    voice: "af_nicole",
    speed: 0.95, // Dignified Swahili pace
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  yo: {
    voice: "af_bella",
    speed: 1.0, // Vibrant Yoruba energy
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  ig: {
    voice: "af_bella",
    speed: 1.0,
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  ha: {
    voice: "af_nicole",
    speed: 0.96,
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
  am: {
    voice: "af_sarah",
    speed: 0.9, // Amharic flows slower
    kokoroEndpoint: "fal-ai/kokoro/american-english",
  },
};

/**
 * Get optimized voice config for an African language.
 * Returns undefined if the language isn't African (fall through to default).
 */
export function getAfricanVoiceConfig(language: string): AfricanVoiceConfig | undefined {
  return AFRICAN_VOICE_PARAMS[language];
}

/**
 * Check if a language code is an African language we optimize for.
 */
export function isAfricanLanguage(language: string): boolean {
  return language in AFRICAN_VOICE_PARAMS;
}
