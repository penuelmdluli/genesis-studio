// ============================================
// Feature of the Week
// ============================================
// One feature, every week, forever. Users see it as a popup the first time
// they open the studio that week and get it by email once a week. Old
// features are fair game: most users have never tried most of the studio, so
// "old" to us is new to them.
//
// Smart rotation, per user:
//   1. A feature launched in the last LAUNCH_WINDOW_DAYS jumps the queue.
//   2. Otherwise start at this week's slot in the catalog and walk forward.
//   3. Skip features the user already uses, and features we already emailed
//      them, so nobody hears about the same thing twice in a cycle.
//   4. When everything has been covered, start the cycle again.
//
// Add a feature: append an entry. Launching one: set launchedAt to today.
// Costs no generation credit: posters and videos are finished marketing files.

export type UsageSignal = "series" | "motion" | "singer" | "generate";

export interface Spotlight {
  id: string;
  emoji: string;
  title: string;
  /** One line that makes someone want to try it. */
  hook: string;
  /** Email subject lines; the week picks one so repeats read fresh. */
  subjects: string[];
  preheader: string;
  benefits: string[];
  /** A ready-made idea the user can copy straight into the tool. */
  idea: string;
  cta: string;
  path: string;
  /** Human cost line, e.g. "From 30 credits". */
  cost: string;
  poster: string;
  /** 9:16 clip for the in-app popup when we have one. */
  video?: string;
  /** Set when the feature ships; it leads the rotation for two weeks. */
  launchedAt?: string;
  /** If the user already shows this signal they know the feature; skip it. */
  usedWhen?: UsageSignal;
}

const CDN = "https://cdn.ivideostudio.ai/marketing";
export const LAUNCH_WINDOW_DAYS = 14;

export const SPOTLIGHTS: Spotlight[] = [
  {
    id: "action-movie",
    emoji: "🎬",
    title: "Make your own action movie",
    hook: "Bike chases, explosions and characters who shout their lines. Your story, blockbuster style.",
    subjects: ["Your action movie is one sentence away 🎬", "No actors. No stunt team. Just your idea 💥"],
    preheader: "Series Studio now makes action movies with talking characters, sound effects and music.",
    benefits: [
      "Characters speak and shout with real lip sync",
      "Explosions, engines and punches get real sound effects",
      "Same characters in every episode, so fans come back",
    ],
    idea: "A Soweto taxi driver discovers his passenger is being chased by a gang and has one night to get her to the airport.",
    cta: "Make my action movie",
    path: "/series",
    cost: "About 240 to 280 credits a scene",
    poster: `${CDN}/ads/poster-ai-action-movie.jpg`,
    video: `${CDN}/ads/ai-action-movie-9x16.mp4?v=2`,
    launchedAt: "2026-09-14",
    usedWhen: "series",
  },
  {
    id: "motion-control",
    emoji: "💃",
    title: "Make anyone dance",
    hook: "Upload a photo, pick a trending dance, and watch your character do every move.",
    subjects: ["Make your photo dance to the latest trend 💃", "This week: turn any photo into a dance reel"],
    preheader: "Motion Control copies the moves from any dance video onto your character.",
    benefits: [
      "Paste a TikTok or Instagram dance link as the moves",
      "Works with you, a cartoon or a brand mascot",
      "Perfect 9:16 reels for WhatsApp status and TikTok",
    ],
    idea: "Your photo doing the latest amapiano dance challenge, ready for your WhatsApp status.",
    cta: "Make a dance reel",
    path: "/motion-control",
    cost: "From 30 credits",
    poster: `${CDN}/spotlight/motion-control.jpg`,
    usedWhen: "motion",
  },
  {
    id: "ai-singer",
    emoji: "🎤",
    title: "Your face. Your song.",
    hook: "Type your lyrics, pick a genre and get a music video of your face singing them.",
    subjects: ["Hear yourself sing amapiano 🎤", "Birthday song, church notice or diss track? You sing it"],
    preheader: "AI Singer turns your lyrics and one photo into a lip-synced music video.",
    benefits: [
      "Amapiano, gospel, afrobeats, hip hop and more",
      "Your face sings with lips that match the words",
      "Birthday wishes and shout-outs people actually share",
    ],
    idea: "A 20-second amapiano birthday song for your best friend, sung by you.",
    cta: "Make me sing",
    path: "/ai-singer",
    cost: "About 330 credits",
    poster: `${CDN}/spotlight/ai-singer.jpg`,
    usedWhen: "singer",
  },
  {
    id: "cartoon",
    emoji: "🦦",
    title: "Your own 3D cartoon",
    hook: "Cartoon characters that talk, with the look of a big-studio animated film.",
    subjects: ["Turn your story into a 3D cartoon 🎨", "Kids' cartoon night, made by you"],
    preheader: "Series Studio makes 3D cartoon episodes with voices, sound effects and music.",
    benefits: [
      "Big-studio 3D animation look",
      "Characters speak in 140 languages, including isiZulu and Afrikaans",
      "Episode after episode with the same characters",
    ],
    idea: "A brave little meerkat who wants to fly, and the grumpy eagle who finally teaches him.",
    cta: "Make a cartoon",
    path: "/series",
    cost: "About 240 to 280 credits a scene",
    poster: `${CDN}/ads/poster-ai-cartoon.jpg`,
    video: `${CDN}/ads/ai-cartoon-9x16.mp4?v=2`,
    launchedAt: "2026-09-14",
    usedWhen: "series",
  },
  {
    id: "add-sound",
    emoji: "🔊",
    title: "Bring silent videos to life",
    hook: "Describe the scene and get real sound: taxi ranks, rain, crowds, engines.",
    subjects: ["Your videos are too quiet 🔊", "One tap to add real sound to any clip"],
    preheader: "Add Sound to Video creates synced sound effects and ambience in seconds.",
    benefits: [
      "Sound that matches what happens on screen",
      "Works on any clip, not just ones made here",
      "Reels with sound get watched for longer",
    ],
    idea: "Take a silent clip and type: busy Joburg street at rush hour, hooting taxis, people talking.",
    cta: "Add sound",
    path: "/tools",
    cost: "5 credits",
    poster: `${CDN}/spotlight/add-sound.jpg`,
  },
  {
    id: "text-to-video",
    emoji: "✨",
    title: "Type it. Watch it.",
    hook: "Write one sentence and get a cinematic video clip.",
    subjects: ["Write a sentence, get a movie scene ✨", "What would you make if cameras were free?"],
    preheader: "Text to Video turns any idea into a cinematic clip.",
    benefits: [
      "Cinematic clips from a single sentence",
      "Vertical, square or wide for any platform",
      "Remix ideas from Explore in one tap",
    ],
    idea: "Two giant beasts battling on top of Table Mountain at sunset, thunder rolling, cinematic.",
    cta: "Create a video",
    path: "/generate",
    cost: "From 30 credits",
    poster: `${CDN}/ads/poster-ai-beast-wars.jpg`,
    video: `${CDN}/ads/ai-beast-wars-9x16.mp4?v=2`,
    usedWhen: "generate",
  },
  {
    id: "invite-friends",
    emoji: "🎁",
    title: "Free credits for sharing",
    hook: "Every 5 friends who sign up with your link gives you 50 free credits. No limit.",
    subjects: ["Your friends are worth 50 credits 🎁", "Share one link, get free credits again and again"],
    preheader: "Send your link to WhatsApp groups. Every 5 friends who join gives you +50 credits.",
    benefits: [
      "+50 credits for every 5 friends who join",
      "Your friends get free credits too",
      "One tap to share to WhatsApp chats and groups",
    ],
    idea: "Share your link in your family WhatsApp group with one of your videos.",
    cta: "Get my invite link",
    path: "/invite",
    cost: "Free",
    poster: `${CDN}/spotlight/invite-friends.jpg`,
  },
  {
    id: "series-languages",
    emoji: "🌍",
    title: "A series in your language",
    hook: "Dramas and action episodes in isiZulu, Afrikaans, Sesotho, SA English and 137 more.",
    subjects: ["Make a drama in isiZulu 🌍", "Your story, in your language, episode after episode"],
    preheader: "Series Studio writes, voices and subtitles your story in 140 languages.",
    benefits: [
      "Characters speak your language with real lip sync",
      "English subtitles written alongside every line",
      "The story carries on from the last episode",
    ],
    idea: "A family drama in isiZulu: the eldest son comes home from Joburg with a secret.",
    cta: "Start my series",
    path: "/series",
    cost: "From about 120 credits a scene",
    poster: `${CDN}/spotlight/series-languages.jpg`,
    video: `${CDN}/ads/last-run-ep1-9x16.mp4?v=1`,
    usedWhen: "series",
  },
  {
    id: "image-to-video",
    emoji: "📸",
    title: "Bring a photo to life",
    hook: "Old family photos, product shots and drawings, moving like real footage.",
    subjects: ["Make your photo move 📸", "That old family photo? Watch it come alive"],
    preheader: "Image to Video animates any photo into a smooth, realistic clip.",
    benefits: [
      "Realistic motion from a single photo",
      "Great for products, memories and artwork",
      "Describe exactly how it should move",
    ],
    idea: "Upload a product photo and type: slow camera push-in, soft light sweeping across it.",
    cta: "Animate a photo",
    path: "/generate",
    cost: "From 30 credits",
    poster: `${CDN}/spotlight/image-to-video.jpg`,
    usedWhen: "generate",
  },
  {
    id: "remove-background",
    emoji: "✂️",
    title: "Clean cut-outs in one tap",
    hook: "Remove the background from product photos and videos, no green screen needed.",
    subjects: ["Shop photos that look professional ✂️", "Remove any background in one tap"],
    preheader: "Background removal for photos and videos, made for online sellers and creators.",
    benefits: [
      "Clean product photos for your shop and catalogue",
      "Video background removal without a green screen",
      "Only charged when it works",
    ],
    idea: "Cut out your best-selling product and put it on a clean white background for Facebook Marketplace.",
    cta: "Remove a background",
    path: "/tools",
    cost: "From 2 credits",
    poster: `${CDN}/spotlight/remove-background.jpg`,
  },
  {
    id: "translate-dub",
    emoji: "🗣️",
    title: "One video, many languages",
    hook: "Dub your video into Portuguese, French, Spanish and more, in your own voice.",
    subjects: ["Reach Maputo, Luanda and Lagos with one video 🗣️", "Speak 10 languages without learning one"],
    preheader: "Translate & Dub keeps your voice and re-speaks your video in another language.",
    benefits: [
      "Your own voice in another language",
      "Reach viewers across Africa and beyond",
      "No re-shoot, no voice actors",
    ],
    idea: "Dub your best-performing reel into Portuguese for viewers in Mozambique and Angola.",
    cta: "Dub a video",
    path: "/tools",
    cost: "Priced in Creator Tools",
    poster: `${CDN}/spotlight/translate-dub.jpg`,
  },
  {
    id: "explore-remake",
    emoji: "🔥",
    title: "Remake what's trending",
    hook: "See what other creators made, and remake any video with your own twist in one tap.",
    subjects: ["Out of ideas? Remake one of these 🔥", "The easiest video you'll make this week"],
    preheader: "Explore is full of videos made with iVideo Studio. Tap Recreate on any of them.",
    benefits: [
      "Hundreds of ideas that already work",
      "Recreate copies the prompt so you can tweak it",
      "New videos added every day",
    ],
    idea: "Open Explore, find the video with the most likes and remake it with your city in it.",
    cta: "Browse Explore",
    path: "/explore",
    cost: "From 30 credits",
    poster: `${CDN}/spotlight/explore-remake.jpg`,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SAST_MS = 2 * 60 * 60 * 1000;
// Monday 2026-09-14 (SAST) is week 0.
const ANCHOR_MONDAY = Date.UTC(2026, 8, 14);

/** The SAST week a moment falls in: index since the anchor and the Monday it starts, e.g. "2026-09-14". */
export function spotlightWeek(now = Date.now()): { index: number; key: string } {
  const index = Math.floor((now + SAST_MS - ANCHOR_MONDAY) / (7 * DAY_MS));
  const key = new Date(ANCHOR_MONDAY + index * 7 * DAY_MS).toISOString().slice(0, 10);
  return { index, key };
}

export interface PickContext {
  /** Features the user already uses. */
  used?: Set<UsageSignal>;
  /** Feature ids already emailed to this user, oldest first. */
  alreadySent?: string[];
  now?: number;
}

/** This week's feature for one user (or for everyone, with no context). */
export function pickSpotlight({ used = new Set(), alreadySent = [], now = Date.now() }: PickContext = {}): Spotlight {
  const { index } = spotlightWeek(now);
  const sent = new Set(alreadySent);
  const knows = (s: Spotlight) => !!s.usedWhen && used.has(s.usedWhen);
  const fresh = (s: Spotlight) => !sent.has(s.id) && !knows(s);

  const launch = SPOTLIGHTS.find((s) => {
    if (!s.launchedAt) return false;
    const age = now - Date.parse(s.launchedAt);
    return age >= 0 && age < LAUNCH_WINDOW_DAYS * DAY_MS && fresh(s);
  });
  if (launch) return launch;

  const n = SPOTLIGHTS.length;
  const start = ((index % n) + n) % n;
  for (let i = 0; i < n; i++) {
    const s = SPOTLIGHTS[(start + i) % n];
    if (fresh(s)) return s;
  }

  // Everything covered: start again with whatever was sent longest ago, still
  // skipping features they already use.
  const pool = SPOTLIGHTS.filter((s) => !knows(s));
  const candidates = pool.length ? pool : SPOTLIGHTS;
  return candidates.slice().sort((a, b) => alreadySent.lastIndexOf(a.id) - alreadySent.lastIndexOf(b.id))[0];
}

export function spotlightById(id: string): Spotlight | undefined {
  return SPOTLIGHTS.find((s) => s.id === id);
}

/** Subject line for the week, rotating through the feature's variants. */
export function spotlightSubject(s: Spotlight, now = Date.now()): string {
  const { index } = spotlightWeek(now);
  return s.subjects[((index % s.subjects.length) + s.subjects.length) % s.subjects.length];
}

/** Link with campaign tracking, so sign-ups and purchases trace back to the email or popup. */
export function spotlightUrl(appUrl: string, s: Spotlight, medium: "email" | "popup", week: string): string {
  const sep = s.path.includes("?") ? "&" : "?";
  return `${appUrl}${s.path}${sep}utm_source=ivs&utm_medium=${medium}&utm_campaign=spotlight-${week}&utm_content=${s.id}`;
}
