export interface DevPageConfig {
  id: string;
  name: string;
  content_pillars: string[];
  engine: string;
  premium_engine: string;
  post_times: string[]; // SAST times
  watermark: boolean;
  caption_style: string;
  hashtags: string[];
  enabled: boolean;
  facebook_page_key?: string;      // Maps to FB_PAGES key in post-to-facebook route
  youtube_enabled?: boolean;        // Whether to post to YouTube Shorts
  topics_per_cycle: number;         // How many unique topics to generate per cycle (default 2)
  niche_weights?: Record<string, number>; // Weight per niche for topic scoring (higher = preferred)
  voiceoverLanguage?: string;       // African language code (e.g. "en-ZA", "en-NG") — defaults to "en-ZA"
  voiceoverCountry?: string;        // Country code (e.g. "ZA", "NG") for script validation
}

// ═══════════════════════════════════════════════════════════════════════
// LASER-FOCUS STRATEGY: ONE PAGE, BEST CONTENT
// Tech Pulse Africa is THE_PAGE (10,166 followers, matches viral strategy).
// All other pages are DISABLED — no credits spent on them.
// All credits now fund 4 premium videos/day on Tech Pulse Africa.
// ═══════════════════════════════════════════════════════════════════════

export const DEV_PAGES: Record<string, DevPageConfig> = {
  // ── THE ONLY ACTIVE PAGE ──
  tech_pulse_africa: {
    id: "tech_pulse_africa_dev",
    name: "Tech Pulse Africa",
    // FULL content strategy: AI+jobs, money/rand, power/corruption, wars,
    // African pride, tech, Elon, shocking stats, breaking news
    content_pillars: [
      "ai_news",
      "ai_disruption",
      "tech",
      "breaking_news",
      "geopolitics",
      "finance",
      "entertainment",
    ],
    engine: "seedance-1.5", // Primary video model (no avatar)
    premium_engine: "seedance-1.5",
    post_times: ["07:00", "12:00", "19:00", "21:00"], // 4x daily SAST
    watermark: false,
    caption_style: "tech_shock",
    hashtags: [
      "#TechPulseAfrica",
      "#SouthAfrica",
      "#Mzansi",
      "#AI",
      "#AITech",
      "#Breaking",
      "#Viral",
      "#Trending",
      "#Eskom",
      "#Rand",
      "#Economy",
      "#Politics",
      "#AfricaRising",
      "#Elon",
      "#TechWar",
    ],
    enabled: true,
    facebook_page_key: "tech_news",
    youtube_enabled: true,
    // 4 videos per day instead of 2 — all credits now flow here
    topics_per_cycle: 4,
    // All viral categories weighted high. AI + breaking + geopolitics dominate.
    niche_weights: {
      ai_news: 5,
      ai_disruption: 5,
      breaking_news: 5,
      geopolitics: 5,
      tech: 4,
      finance: 4,
      entertainment: 3,
    },
    // Standard English (en-US) + professional cinematic narrator voice.
    // am_adam is Kokoro's best broadcast-quality male — deep, authoritative,
    // documentary/trailer feel. Stops the scroll and makes people listen.
    voiceoverLanguage: "en-US",
    voiceoverCountry: "ZA", // still serves SA audience, just with a global English voice
  },

  // ── ALL OTHER PAGES DISABLED ──
  // Paused per laser-focus strategy. Do NOT delete configs — kept for
  // historical reference and easy re-enablement later.

  mzansi_baby_stars: {
    id: "mzansi_baby_stars",
    name: "Mzansi Baby Stars",
    content_pillars: ["mbs_episodes", "baby_scenarios", "motivation", "health_wellness"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["12:00", "18:00"],
    watermark: false,
    caption_style: "mbs_style",
    hashtags: ["#MzansiBabyStars", "#CuteBabies", "#SouthAfrica", "#Mzansi"],
    enabled: false, // PAUSED — laser-focus on tech_pulse_africa
    facebook_page_key: "mzansi_baby_stars",
    youtube_enabled: true,
    topics_per_cycle: 1,
    niche_weights: { mbs_episodes: 5, baby_scenarios: 5, motivation: 2, health_wellness: 1 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  africa_2050: {
    id: "africa_2050_dev",
    name: "Africa 2050",
    content_pillars: ["afrofuturism", "african_cities", "breaking_news", "geopolitics", "tech", "ai_disruption"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["08:00", "14:00", "19:00"],
    watermark: false,
    caption_style: "pride_curiosity",
    hashtags: ["#Africa2050", "#AfricaRising", "#FutureAfrica"],
    enabled: false, // PAUSED
    facebook_page_key: "limitless_you",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { breaking_news: 4, geopolitics: 4, afrofuturism: 3, african_cities: 2, tech: 2, ai_disruption: 2 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  afrika_toons: {
    id: "afrika_toons_dev",
    name: "Afrika Toons",
    content_pillars: ["news_animated", "breaking_news", "geopolitics", "african_folklore"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["08:00", "14:00", "20:00"],
    watermark: false,
    caption_style: "news_toon",
    hashtags: ["#AfrikaToons", "#AnimatedNews", "#WorldNews"],
    enabled: false, // PAUSED
    facebook_page_key: "motivation",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { breaking_news: 4, geopolitics: 4, news_animated: 3, african_folklore: 1 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  world_news_animated: {
    id: "world_news_animated_dev",
    name: "World News Animated",
    content_pillars: ["breaking_news", "geopolitics", "news_animated"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["07:00", "12:00", "17:00", "21:00"],
    watermark: false,
    caption_style: "news_urgent",
    hashtags: ["#WorldNews", "#BreakingNews", "#War", "#Politics"],
    enabled: false, // PAUSED
    facebook_page_key: "health_wellness",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { geopolitics: 5, breaking_news: 5, news_animated: 3 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  pop_culture_buzz: {
    id: "pop_culture_buzz_dev",
    name: "Pop Culture Buzz",
    content_pillars: ["entertainment", "celebrity", "viral_moments", "breaking_news", "geopolitics"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["10:00", "15:00", "20:00"],
    watermark: false,
    caption_style: "entertainment_hook",
    hashtags: ["#PopCulture", "#Entertainment", "#CelebNews"],
    enabled: false, // PAUSED
    facebook_page_key: "motivation",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { entertainment: 4, celebrity: 4, viral_moments: 3, breaking_news: 4, geopolitics: 2 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  ai_revolution: {
    id: "ai_revolution_dev",
    name: "AI Revolution",
    content_pillars: ["ai_news", "tech", "ai_disruption", "breaking_news", "geopolitics"],
    engine: "seedance-1.5",
    premium_engine: "seedance-1.5",
    post_times: ["08:00", "14:00", "18:00"],
    watermark: false,
    caption_style: "tech_shock",
    hashtags: ["#AIRevolution", "#AI", "#FutureOfWork", "#TechNews"],
    enabled: false, // PAUSED
    facebook_page_key: "ai_money",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { ai_news: 4, ai_disruption: 4, tech: 3, breaking_news: 4, geopolitics: 4 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
};

export function getDevPage(pageId: string): DevPageConfig | undefined {
  // Direct key lookup first
  if (DEV_PAGES[pageId]) return DEV_PAGES[pageId];
  // Fallback: match by `id` field (queue items use the _dev suffix form)
  return Object.values(DEV_PAGES).find((p) => p.id === pageId);
}

export function getAllDevPages(): DevPageConfig[] {
  return Object.values(DEV_PAGES).filter(p => p.enabled);
}

export function getDevPagesByPillar(pillar: string): DevPageConfig[] {
  return Object.values(DEV_PAGES).filter(p => p.enabled && p.content_pillars.includes(pillar));
}

export function getDevPageByFacebookKey(fbKey: string): DevPageConfig | undefined {
  return Object.values(DEV_PAGES).find(p => p.enabled && p.facebook_page_key === fbKey);
}
