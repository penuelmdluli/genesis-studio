// ============================================
// MBS Auto-Comment Templates
// 4 comments per post: engagement bait, community, CTA, promo
// ============================================

const ENGAGEMENT_BAIT = [
  "Drop a star if {character} ATE!",
  "Tell me {character} didn't kill this",
  "{character} said WATCH ME and we WATCHING",
  "Send this to someone who needs to see {character}'s vibe",
  "Y'all see how {character} hit that?!",
  "Imma need {character} to teach me this dance",
  "Wait... {character} is only {age}?!",
  "Drop your favorite emoji if {character} ate this",
];

const COMMUNITY = [
  "Mzansi we eating GOOD tonight",
  "The culture is ALIVE! Tag a SA dancer!",
  "This is what Mzansi Sundays look like",
  "Tag the family member that dances like this",
  "South Africa to the WORLD",
  "Who else is dancing along right now?",
  "Comment SA flag if you're proud of our culture!",
  "The whole family watching this on repeat",
];

const CTA = [
  "Follow @MzansiBabyStars for daily MBS content",
  "Watch till the end and SHARE if you laughed",
  "Drop a follow, we post 3x daily!",
  "Save this for later AND share with family",
  "Hit FOLLOW for the cutest content on Facebook",
  "If MBS made you smile, comment MBS below",
];

const MIMIC_PROMO = [
  "Want YOUR character to dance like this? Create your own AI video FREE at genesisstudio.app/mimic",
  "You can make videos like this too! Try Mimic Studio FREE: genesisstudio.app/mimic",
  "Make ANY character dance to ANY video! Try it free: genesisstudio.app/mimic",
  "This was made with AI! Create your own dance videos at genesisstudio.app/mimic",
  "Think you can do better? Make your OWN AI dance video FREE: genesisstudio.app/mimic",
  "Turn your photo into a dancer! Free AI tool: genesisstudio.app/mimic",
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCommentSet(opts: {
  character: string;
  age: number;
}): string[] {
  const bait = pick(ENGAGEMENT_BAIT)
    .replace(/{character}/g, opts.character)
    .replace(/{age}/g, String(opts.age));
  const community = pick(COMMUNITY);
  const cta = pick(CTA);
  const promo = pick(MIMIC_PROMO);
  return [bait, community, cta, promo];
}
