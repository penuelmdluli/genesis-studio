// ============================================
// MBS Caption Builder
// ============================================

const HOOKS = [
  "Wait for it...",
  "WHO DIS",
  "Tag your dance partner",
  "This baby is going VIRAL",
  "Watch till the end",
  "Name this move",
];

const DEFAULT_HASHTAGS = [
  "#MzansiBabyStars",
  "#MBS",
  "#amapiano",
  "#southafricandance",
  "#fyp",
  "#dancechallenge",
  "#mzansi",
];

export function buildCaption(opts: {
  character: string;
  setting?: string;
  hashtags?: string[];
  hook?: string;
}): string {
  const hook = opts.hook ?? HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const hashtags = (opts.hashtags ?? DEFAULT_HASHTAGS).join(" ");
  const setting = opts.setting ? ` in ${opts.setting}` : "";

  return `${hook}\n\n${opts.character} feeling the music${setting}\n\n${hashtags}`;
}
