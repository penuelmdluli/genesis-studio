// ============================================
// MBS Caption Builder — with mandatory attribution
// ============================================

const HOOKS = [
  "Wait for it 🔥",
  "WHO DIS 👀",
  "Tag your dance partner ⭐",
  "This baby is going VIRAL 🔥",
  "Watch till the end 😩🔥",
  "Name this move 👇",
  "The culture is ALIVE 🔥",
  "Drop ⭐ for RESPECT!",
];

const CTAS = [
  "Drop ⭐ for RESPECT!",
  "Tag a dance partner ⭐",
  "Follow @MzansiBabyStars for more 🔥",
  "Share this NOW 🔥",
];

const DEFAULT_HASHTAGS = [
  "#mzansibabystars",
  "#MBS",
  "#amapiano",
  "#southafricadance",
  "#amapianoisalifestyle",
  "#fyp",
  "#viral",
  "#mzansitiktok",
];

/**
 * Build an MBS caption with mandatory creator attribution.
 * Returns null if creatorHandle is missing — the pipeline must
 * refuse to post without attribution.
 */
export function buildCaption(opts: {
  character: string;
  creatorHandle: string | null | undefined;
  setting?: string;
  danceStyle?: string;
  hashtags?: string[];
  hook?: string;
}): string | null {
  if (!opts.creatorHandle) {
    return null; // Attribution required — pipeline must reject
  }

  const hook = opts.hook ?? HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const cta = CTAS[Math.floor(Math.random() * CTAS.length)];
  const hashtags = (opts.hashtags ?? DEFAULT_HASHTAGS).join(" ");
  const styleTag = opts.danceStyle ? ` #${opts.danceStyle}` : "";

  return `${hook}

${opts.character} feeling the music 🔥

Inspired by @${opts.creatorHandle}

${cta}

🎬 Create YOUR own AI dance video FREE → genesisstudio.app

${hashtags}${styleTag}`;
}
