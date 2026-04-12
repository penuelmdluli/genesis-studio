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

export const DEV_PAGES: Record<string, DevPageConfig> = {
  mzansi_baby_stars: {
    id: "mzansi_baby_stars",
    name: "Mzansi Baby Stars",
    content_pillars: ["mbs_episodes", "baby_scenarios", "motivation", "health_wellness"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["12:00", "18:00"],
    watermark: false,
    caption_style: "mbs_style",
    hashtags: ["#MzansiBabyStars", "#CuteBabies", "#SouthAfrica", "#Mzansi"],
    enabled: true,
    facebook_page_key: "blissful_moments",
    youtube_enabled: true,
    topics_per_cycle: 1,
    niche_weights: { mbs_episodes: 5, baby_scenarios: 5, motivation: 2, health_wellness: 1 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  africa_2050: {
    id: "africa_2050_dev",
    name: "Africa 2050",
    // Broadened: Africa 2050 covers African innovation AND global news that
    // impacts Africa — wars, geopolitics, tech disruption, breaking news.
    content_pillars: ["afrofuturism", "african_cities", "breaking_news", "geopolitics", "tech", "ai_disruption"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "14:00", "19:00"],
    watermark: false,
    caption_style: "pride_curiosity",
    hashtags: ["#Africa2050", "#AfricaRising", "#FutureAfrica", "#WorldNews", "#Breaking"],
    enabled: true,
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
    // Broadened: animated news coverage of ALL major world events + African stories
    content_pillars: ["news_animated", "breaking_news", "geopolitics", "african_folklore"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "14:00", "20:00"],
    watermark: false,
    caption_style: "news_toon",
    hashtags: ["#AfrikaToons", "#AnimatedNews", "#WorldNews", "#BreakingNews", "#Trending"],
    enabled: true,
    facebook_page_key: "motivation",
    youtube_enabled: true,
    topics_per_cycle: 2,
    niche_weights: { breaking_news: 4, geopolitics: 4, news_animated: 3, african_folklore: 1 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  tech_pulse_africa: {
    id: "tech_pulse_africa_dev",
    name: "Tech Pulse Africa",
    // Tech + geopolitics crossover (cyberwar, sanctions on chips, AI arms race)
    content_pillars: ["ai_news", "tech", "ai_disruption", "breaking_news", "geopolitics"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["09:00", "14:00", "19:00"],
    watermark: false,
    caption_style: "tech_shock",
    hashtags: ["#TechPulseAfrica", "#AITech", "#Innovation", "#BreakingNews", "#Trending", "#TechWar"],
    enabled: true,
    facebook_page_key: "tech_news",
    youtube_enabled: true,
    topics_per_cycle: 2,
    // Boosted: breaking_news + geopolitics promoted for viral engagement
    niche_weights: { ai_news: 4, tech: 3, ai_disruption: 3, breaking_news: 4, geopolitics: 3 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  world_news_animated: {
    id: "world_news_animated_dev",
    name: "World News Animated",
    // Primary war/politics/breaking news channel — highest weight on geopolitics
    content_pillars: ["breaking_news", "geopolitics", "news_animated"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["07:00", "12:00", "17:00", "21:00"],
    watermark: false,
    caption_style: "news_urgent",
    hashtags: ["#WorldNews", "#BreakingNews", "#War", "#Politics", "#Trending", "#Viral"],
    enabled: true,
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
    // Celebrities + war/politics scandals drive massive viral engagement
    content_pillars: ["entertainment", "celebrity", "viral_moments", "breaking_news", "geopolitics"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["10:00", "15:00", "20:00"],
    watermark: false,
    caption_style: "entertainment_hook",
    hashtags: ["#PopCulture", "#Entertainment", "#CelebNews", "#Trending", "#Viral", "#Breaking"],
    enabled: true,
    facebook_page_key: "pop_culture_buzz",
    youtube_enabled: true,
    topics_per_cycle: 2,
    // Boosted breaking_news + added geopolitics for celebrity-politics crossover
    niche_weights: { entertainment: 4, celebrity: 4, viral_moments: 3, breaking_news: 4, geopolitics: 2 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
  ai_revolution: {
    id: "ai_revolution_dev",
    name: "AI Revolution",
    // AI + wars/politics is massive: AI arms race, deepfake warfare, autonomous weapons
    content_pillars: ["ai_news", "tech", "ai_disruption", "breaking_news", "geopolitics"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "14:00", "18:00"],
    watermark: false,
    caption_style: "tech_shock",
    hashtags: ["#AIRevolution", "#AI", "#FutureOfWork", "#TechNews", "#Breaking", "#AIWar"],
    enabled: true,
    facebook_page_key: "ai_money",
    youtube_enabled: true,
    topics_per_cycle: 2,
    // Boosted breaking_news + geopolitics to match viral trends (AI warfare, chip bans)
    niche_weights: { ai_news: 4, ai_disruption: 4, tech: 3, breaking_news: 4, geopolitics: 4 },
    voiceoverLanguage: "en-ZA",
    voiceoverCountry: "ZA",
  },
};

export function getDevPage(pageId: string): DevPageConfig | undefined {
  return DEV_PAGES[pageId];
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
