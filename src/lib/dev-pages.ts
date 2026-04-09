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
}

export const DEV_PAGES: Record<string, DevPageConfig> = {
  mzansi_baby_stars: {
    id: "mzansi_baby_stars",
    name: "Mzansi Baby Stars",
    content_pillars: ["mbs_episodes", "baby_scenarios"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2", // Using RunPod (we have credits)
    post_times: ["12:00", "18:00"],
    watermark: true,
    caption_style: "mbs_style",
    hashtags: ["#MzansiBabyStars", "#AIBabies", "#SouthAfrica", "#MadeWithAI"],
    enabled: true,
    facebook_page_key: "blissful_moments",
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  africa_2050: {
    id: "africa_2050_dev",
    name: "Africa 2050",
    content_pillars: ["afrofuturism", "african_cities"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "16:00"],
    watermark: true,
    caption_style: "pride_curiosity",
    hashtags: ["#Africa2050", "#Afrofuturism", "#AfricaRising", "#GenesisStudio"],
    enabled: true,
    facebook_page_key: "limitless_you",
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  afrika_toons: {
    id: "afrika_toons_dev",
    name: "Afrika Toons",
    content_pillars: ["news_animated", "african_folklore"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "14:00", "20:00"],
    watermark: true,
    caption_style: "news_toon",
    hashtags: ["#AfrikaToons", "#AfricanNews", "#AfricanFolklore", "#AIAnimation"],
    enabled: true,
    facebook_page_key: "motivation",
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  tech_pulse_africa: {
    id: "tech_pulse_africa_dev",
    name: "Tech Pulse Africa",
    content_pillars: ["genesis_demo", "ai_news", "tech"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["09:00", "17:00", "19:00"],
    watermark: true,
    caption_style: "tech_shock",
    hashtags: ["#TechPulseAfrica", "#GenesisStudio", "#AIVideo", "#MadeWithAI"],
    enabled: true,
    facebook_page_key: "tech_news",
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  world_news_animated: {
    id: "world_news_animated_dev",
    name: "World News Animated",
    content_pillars: ["breaking_news", "geopolitics"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["07:00", "13:00", "19:00"],
    watermark: true,
    caption_style: "news_urgent",
    hashtags: ["#WorldNews", "#AnimatedNews", "#BreakingNews", "#AIAnimation"],
    enabled: true,
    facebook_page_key: "health_wellness",
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  pop_culture_buzz: {
    id: "pop_culture_buzz_dev",
    name: "Pop Culture Buzz",
    content_pillars: ["entertainment", "celebrity", "viral_moments"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["10:00", "15:00", "20:00"],
    watermark: true,
    caption_style: "entertainment_hook",
    hashtags: ["#PopCulture", "#Entertainment", "#CelebNews", "#Trending"],
    enabled: true,
    youtube_enabled: true,
    topics_per_cycle: 1,
  },
  ai_revolution: {
    id: "ai_revolution_dev",
    name: "AI Revolution",
    content_pillars: ["ai_news", "tech", "ai_disruption"],
    engine: "wan-2.2",
    premium_engine: "wan-2.2",
    post_times: ["08:00", "14:00", "18:00"],
    watermark: true,
    caption_style: "tech_shock",
    hashtags: ["#AIRevolution", "#ArtificialIntelligence", "#FutureOfWork", "#TechNews"],
    enabled: true,
    facebook_page_key: "ai_money",
    youtube_enabled: true,
    topics_per_cycle: 1,
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
