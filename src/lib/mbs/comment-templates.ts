// ============================================
// MBS Auto-Comment Templates
// 3 comments per post: engagement bait, community, CTA
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
  return [bait, community, cta];
}
