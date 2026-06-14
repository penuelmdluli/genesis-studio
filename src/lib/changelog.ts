// ============================================
// GENESIS STUDIO — Changelog / What's New
// ============================================

export interface ChangelogEntry {
  id: string;
  date: string; // ISO date
  title: string;
  description: string;
  type: "feature" | "improvement" | "fix";
  badge?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-06-14-ai-character-generator",
    date: "2026-06-14",
    title: "AI Character Generator",
    description: "Describe any character and get 4 AI-generated portrait options to use in Motion Control. No photo upload needed.",
    type: "feature",
    badge: "New",
  },
  {
    id: "2026-06-14-motion-control-url",
    date: "2026-06-14",
    title: "Paste URL in Motion Control",
    description: "Paste a TikTok, Instagram, or Twitter video URL directly as your motion reference. We download and process it automatically.",
    type: "feature",
    badge: "New",
  },
  {
    id: "2026-06-14-cheaper-video-gen",
    date: "2026-06-14",
    title: "Faster, Cheaper Video Generation",
    description: "Smart multi-provider routing now picks the cheapest GPU provider for each model. Kling generation is up to 38% cheaper.",
    type: "improvement",
  },
  {
    id: "2026-06-14-motion-history",
    date: "2026-06-14",
    title: "Motion Control History",
    description: "See your recent motion creations and recreate from previous prompts with one click.",
    type: "feature",
  },
  {
    id: "2026-05-15-ai-singer",
    date: "2026-05-15",
    title: "AI Singer",
    description: "Generate music from lyrics with perfect lip-synced video. Write lyrics, pick a style, and get a music video.",
    type: "feature",
    badge: "Hot",
  },
  {
    id: "2026-05-01-product-ads",
    date: "2026-05-01",
    title: "Product Ads",
    description: "Upload a product photo and get professional AI-generated video ads ready for social media.",
    type: "feature",
  },
  {
    id: "2026-04-20-music-video",
    date: "2026-04-20",
    title: "Music Video Studio",
    description: "Upload a track or generate AI music, then create a full music video with scene-by-scene visuals.",
    type: "feature",
  },
  {
    id: "2026-04-06-platform-presets",
    date: "2026-04-06",
    title: "Platform Presets",
    description: "One-click TikTok, YouTube, and Instagram formatting — resolution, aspect ratio, and duration auto-configured.",
    type: "feature",
  },
  {
    id: "2026-04-06-queue-eta",
    date: "2026-04-06",
    title: "Queue Position & ETA",
    description: "See your position in the generation queue and estimated completion time.",
    type: "improvement",
  },
  {
    id: "2026-04-05-motion-control",
    date: "2026-04-05",
    title: "Motion Control",
    description: "40+ fun effects and custom motion transfer — make any character dance, fly, or transform.",
    type: "feature",
  },
  {
    id: "2026-04-04-hollywood-audio",
    date: "2026-04-04",
    title: "Hollywood Models with Native Audio",
    description: "Kling 2.6, Kling 3.0, and Veo 3.1 now generate video with built-in dialogue and sound effects.",
    type: "feature",
  },
  {
    id: "2026-04-03-prompt-enhance",
    date: "2026-04-03",
    title: "AI Prompt Enhancement",
    description: "Let Claude AI transform your basic prompts into cinematic descriptions for better results.",
    type: "feature",
  },
  {
    id: "2026-04-02-brain-studio",
    date: "2026-04-02",
    title: "Genesis Brain Studio",
    description: "Multi-scene AI film production — plan, generate, and assemble complete videos automatically.",
    type: "feature",
    badge: "Major",
  },
  {
    id: "2026-04-01-reels",
    date: "2026-04-01",
    title: "Reel Format Support",
    description: "Generate 9:16 vertical videos optimized for TikTok, Instagram Reels, and YouTube Shorts.",
    type: "feature",
  },
];
