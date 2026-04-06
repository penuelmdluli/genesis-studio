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
    id: "2026-04-06-platform-presets",
    date: "2026-04-06",
    title: "Platform Presets",
    description: "One-click TikTok, YouTube, and Instagram formatting — resolution, aspect ratio, and duration auto-configured.",
    type: "feature",
    badge: "New",
  },
  {
    id: "2026-04-06-video-ratings",
    date: "2026-04-06",
    title: "Video Ratings",
    description: "Rate your generated videos with Great, Okay, or Bad to help us improve model quality.",
    type: "feature",
    badge: "New",
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
    description: "Transfer motion from reference videos to your characters with MimicMotion.",
    type: "feature",
    badge: "New",
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
