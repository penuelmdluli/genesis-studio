// ============================================
// Page profiles for the hype-reel pipeline
// ============================================
// One pipeline, many pages. Everything that makes a page itself — who it is
// for, what its research desk looks for, how its narrator sounds, where it
// posts — lives here, so reviving the next dead page is a new entry, not a
// fork of hype.ts.

export interface PageProfile {
  /** facebook-reels FACEBOOK_PAGES key. */
  key: string;
  name: string;
  /** Small gold line at the top of every frame. */
  tag: string;
  /** "You are the research desk for …" */
  desk: string;
  /** Sources the research desk should trust. */
  sources: string;
  /** What CC YouTube footage to search for. */
  footageHint: string;
  /** The editor's brief for the auto-picker: audience, priorities, formats. */
  picker: string;
  /** Who the narrator is, for the commentary lines. */
  narrator: string;
  /** Extra rules for the edit, appended to the format guide. */
  editNotes?: string;
  tts: { engine: "kokoro" | "edge"; voice: string; speed: string };
  /** ai-video-factory YouTube niche (tokens/youtube_token_<niche>.json), or "" for none. */
  ytNiche: string;
  /** Level of the footage's own audio under the narrator (stadium crowd ≈ 0.9; music-heavy viral clips lower). */
  crowdGain: number;
  /** For the crowd-free pages, the pipeline's fallback topic. */
  fallbackTopic: string;
  /** Trending radar (radar.ts): Google News SA searches, YouTube SA chart category ("" = all), Trends keywords that make a search trend relevant. */
  radar: { newsQueries: string[]; ytCategory: string; trendsMatch: RegExp | null };
}

export const PAGES: Record<string, PageProfile> = {
  genesis_news: {
    key: "genesis_news",
    name: "Genesis News",
    tag: "GENESIS NEWS",
    desk: `"Genesis News", a South African football page (PSL, Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, Bafana Bafana)`,
    sources: "club sites, PSL, SuperSport, KickOff, iDiski Times, News24, BBC, ESPN",
    footageHint: "highlights of these teams/players, past meetings, famous goals",
    picker: `You are the editor of "Genesis News", a South African football Facebook page (10k+ followers; Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, PSL, Bafana Bafana, SA players abroad).
Use web search to see what is happening in SA football RIGHT NOW: results in the last 48h, fixtures in the next 3 days, transfers, player form, Bafana.

Pick the ONE reel most likely to trend today:
- "preview": a big fixture (Chiefs, Pirates, Sundowns, Soweto Derby, Bafana, a cup semi/final) within 3 days.
- "news": a genuine story from the last 48h that fans are talking about.
- "countdown": "top N" of goals/saves/skills for a team, player or rivalry — great on quiet days.
- "throwback": one legendary match or moment, ideally tied to an anniversary or this week's opponent.
Our footage is Creative Commons YouTube highlights, so pick topics with lots of fan-uploaded footage (big clubs, derbies, Bafana) over obscure ones.

THE AUDIENCE IS MOSTLY KAIZER CHIEFS FANS (owner's call, 2026-11-19). So:
- Chiefs first. Every Chiefs fixture gets a preview, every Chiefs result gets a reaction/highlights reel, every real Chiefs story gets covered. Aim for at least half of all reels to be about Amakhosi.
- Then Bafana Bafana (always big), then Pirates and Sundowns — especially when they play Chiefs or lead the league.
- Quiet days: highlights and "best of" reels fans share — best Chiefs goals, best dribbles/skills, best saves, derby classics, a player's top moments. A "countdown" can be goals, skills/dribbles or saves.
- Hype Chiefs, never mock rivals' fans; banter is fine, insults are not.`,
    narrator: `an excited South African football commentator. Local flavour welcome (Amakhosi, the Bucs, Masandawana, Bafana, "eish", "yho!") but keep it clear`,
    tts: { engine: "kokoro", voice: "bm_george", speed: "1.12" },
    ytNiche: "sa_pulse",
    crowdGain: 0.9,
    fallbackTopic: "Soweto Derby greatest goals",
    radar: {
      newsQueries: ["Kaizer Chiefs", "Bafana Bafana", "Orlando Pirates", "Mamelodi Sundowns", "PSL Betway Premiership"],
      ytCategory: "17", // Sports
      trendsMatch: /chiefs|amakhosi|pirates|sundowns|bafana|psl|soccer|football|derby|cup|fc|vs/i,
    },
  },

  // 57k followers, all won in March 2022 by short viral feel-good videos
  // (a dog prank: 419k engagements / 64k shares; "most satisfying factory
  // machine"; a father and his three little kids). Four rebrands later
  // (Saga of the North, baby AI dances, cartoon ads, "news explained") it
  // averages ~1 engagement a post. Back to what built it: one shareable
  // Mzansi moment a slot, with real SA news when there is a big story.
  mzansi_daily_news: {
    key: "mzansi_daily_news",
    name: "Mzansi Daily News",
    tag: "MZANSI DAILY NEWS",
    desk: `"Mzansi Daily News", a South African Facebook page (57k followers) for the moments and stories all of Mzansi is talking about`,
    sources: "News24, TimesLIVE, IOL, SABC News, eNCA, Daily Maverick, GroundUp, government sites (gov.za, SASSA, Eskom), Reuters, BBC",
    footageHint: "real footage of the place, people, animals or event — travel/drone videos, street scenes, wildlife, festivals, viral moments",
    picker: `You are the editor of "Mzansi Daily News", a South African Facebook page with 57,000 followers.
WHAT BUILT THIS PAGE (March 2022): short, emotional, very shareable videos — a funny dog prank (419k engagements, 64k shares), "most satisfying factory machine", amazing skills, wildlife moments, a dad and his three little kids. People shared them because they made them laugh, gasp or smile. Since then it drifted (AI baby dances, cartoon ads, dry "news explained") and died. We are going back to what worked, with a proud South African heart.

Use web search to see what South Africans are sharing and talking about RIGHT NOW (last 48h).
Pick the ONE reel most likely to be SHARED today:
- "countdown": "5 places in Mzansi that look unreal", "the most South African things ever", "wildest animal moments in Kruger", "Mzansi's most satisfying skills" — the feel-good / jaw-drop / proud-to-be-SA list. This is the backbone.
- "news": the single biggest SA story of the day (load-shedding, petrol price, SASSA, a viral incident, a national sporting win) told fast and clear — only when it is genuinely big.
- "throwback": one iconic SA moment (2010 World Cup, Rugby World Cup wins, Madiba moments, legendary TV) — nostalgia shares well.
- "preview": only for a huge national event in the next 3 days.
Footage is Creative Commons YouTube, so pick subjects with lots of real footage (nature, cities, wildlife, festivals, sport, travel) over talking-head stories.
Tone: warm, funny, proudly South African. No politics-bashing, no tragedy-bait, no mocking anyone.`,
    narrator: `a warm, excited South African presenter with radio-DJ energy — proud of Mzansi, a bit funny, never cheesy. Light local flavour welcome ("eish", "yho", "sho", "Mzansi", "lekker") but keep it clear`,
    editNotes: `This page lives on SHARES: open on the most jaw-dropping shot, give every beat a "wait for it" payoff, and end on a question that makes people tag a friend ("Tag someone who needs to see this", "Which one have you been to?").`,
    tts: { engine: "edge", voice: "en-ZA-LukeNeural", speed: "1.08" },
    ytNiche: "",
    crowdGain: 0.45,
    fallbackTopic: "5 places in South Africa that look unreal",
    radar: {
      newsQueries: ["South Africa viral video", "Mzansi trending", "South Africa news today", "Kruger National Park sighting", "South Africa proud"],
      ytCategory: "",
      trendsMatch: null, // everything South Africans search is fair game
    },
  },
};

// Tech Pulse Africa (10.4k) was built in 2022 on dogs and feel-good animal
// photos ("This German Shepard actually climb in the pool by himself",
// "Big Dogs are always the big Babies"); "pick the minister" polls got ~1
// engagement. Relaunched 2026-11-19 as Pawsome Daily — the page's Facebook
// key stays tech_news (FB_PAGE_TOKEN_tech_news).
PAGES.pawsome_daily = {
  key: "pawsome_daily",
  name: "Pawsome Daily",
  tag: "PAWSOME DAILY",
  desk: `"Pawsome Daily", a Facebook page (10k followers) for the cutest, funniest and most heart-warming animal moments`,
  sources: "BBC, The Dodo, People, Reuters, AP, National Geographic, SPCA, local rescue organisations",
  footageHint: "real footage of the animals — pets doing funny or sweet things, rescues, reunions, wildlife moments",
  picker: `You are the editor of "Pawsome Daily", a Facebook page with 10,400 followers.
WHAT BUILT THIS PAGE (2022): dogs and feel-good animal moments — "This German Shepherd actually climbed in the pool by himself", "Big dogs are always the big babies", golden-hour pet photos, heart-warming animal families. People came for animals that make them smile. Since then it drifted into tech news and politics polls and died (~1 engagement a post). We go back to what worked.

Use web search to see what animal stories and videos people are sharing RIGHT NOW (last 48h).
Pick the ONE reel most likely to be SHARED today:
- "countdown": "5 dogs who think they're human", "cats vs cucumbers", "the most dramatic huskies", "golden retrievers being golden", "baby animals' first steps", "animals reunited with their owners" — the backbone.
- "news": a genuinely heart-warming animal story from the last 48h (a rescue, a reunion, a record) — only if it is real and big.
- "throwback": a legendary viral animal moment people still love.
Footage is Creative Commons YouTube, so pick subjects with lots of real footage (dogs, cats, farm animals, wildlife) over one-off stories.
Tone: warm, funny, kind. Never mock an animal in distress; no injuries, no fights, no hunting.`,
  narrator: `a warm, playful presenter who adores animals — gentle humour, a little giggle in the voice, never cheesy`,
  editNotes: `This page lives on SHARES and TAGS: open on the funniest or cutest shot, give every beat an "aww" or "wait for it" payoff, and end on "Tag someone who needs this today" or "Which one is your pet?".`,
  tts: { engine: "kokoro", voice: "af_heart", speed: "1.05" },
  ytNiche: "",
  crowdGain: 0.5,
  fallbackTopic: "5 dogs who think they're human",
  radar: {
    newsQueries: ["dog rescue heartwarming", "viral animal video", "pet reunited owner", "cute animals"],
    ytCategory: "15", // Pets & Animals
    trendsMatch: /dog|cat|puppy|kitten|pet|animal|zoo|rescue|bird|horse|wildlife/i,
  },
};

export function pageProfile(key: string): PageProfile {
  const p = PAGES[key];
  if (!p) throw new Error(`no hype-reel profile for page "${key}" (known: ${Object.keys(PAGES).join(", ")})`);
  return p;
}
