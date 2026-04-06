// ============================================
// GENESIS STUDIO — Platform Presets
// ============================================

export interface PlatformPreset {
  id: string;
  name: string;
  platform: string;
  icon: string; // emoji
  aspectRatio: "landscape" | "portrait" | "square";
  resolution: string;
  duration: number;
  fps: number;
  videoFormat: "standard" | "reel";
  description: string;
  maxDuration?: number;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  // TikTok
  {
    id: "tiktok-short",
    name: "TikTok Short",
    platform: "TikTok",
    icon: "🎵",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 15,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 15s — perfect for trending TikToks",
    maxDuration: 60,
  },
  {
    id: "tiktok-long",
    name: "TikTok Extended",
    platform: "TikTok",
    icon: "🎵",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 30,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 30s — longer format TikTok",
    maxDuration: 60,
  },
  // YouTube
  {
    id: "youtube-short",
    name: "YouTube Short",
    platform: "YouTube",
    icon: "▶️",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 30,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 30s — YouTube Shorts format",
    maxDuration: 60,
  },
  {
    id: "youtube-standard",
    name: "YouTube Video",
    platform: "YouTube",
    icon: "▶️",
    aspectRatio: "landscape",
    resolution: "1080p",
    duration: 10,
    fps: 24,
    videoFormat: "standard",
    description: "16:9 landscape, 10s — standard YouTube clip",
  },
  {
    id: "youtube-4k",
    name: "YouTube 4K",
    platform: "YouTube",
    icon: "▶️",
    aspectRatio: "landscape",
    resolution: "4k",
    duration: 8,
    fps: 24,
    videoFormat: "standard",
    description: "16:9 landscape, 4K — premium quality",
  },
  // Instagram
  {
    id: "instagram-reel",
    name: "Instagram Reel",
    platform: "Instagram",
    icon: "📸",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 15,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 15s — Instagram Reels format",
    maxDuration: 60,
  },
  {
    id: "instagram-story",
    name: "Instagram Story",
    platform: "Instagram",
    icon: "📸",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 10,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 10s — Stories format",
  },
  {
    id: "instagram-post",
    name: "Instagram Post",
    platform: "Instagram",
    icon: "📸",
    aspectRatio: "square",
    resolution: "1080p",
    duration: 5,
    fps: 24,
    videoFormat: "standard",
    description: "1:1 square, 5s — Instagram feed post",
  },
  // X (Twitter)
  {
    id: "x-video",
    name: "X (Twitter) Video",
    platform: "X",
    icon: "𝕏",
    aspectRatio: "landscape",
    resolution: "720p",
    duration: 5,
    fps: 30,
    videoFormat: "standard",
    description: "16:9 landscape, 5s — optimized for X feed",
  },
  // Facebook
  {
    id: "facebook-reel",
    name: "Facebook Reel",
    platform: "Facebook",
    icon: "👤",
    aspectRatio: "portrait",
    resolution: "1080p",
    duration: 15,
    fps: 30,
    videoFormat: "reel",
    description: "9:16 vertical, 15s — Facebook Reels",
    maxDuration: 60,
  },
  // LinkedIn
  {
    id: "linkedin-video",
    name: "LinkedIn Video",
    platform: "LinkedIn",
    icon: "💼",
    aspectRatio: "landscape",
    resolution: "1080p",
    duration: 10,
    fps: 24,
    videoFormat: "standard",
    description: "16:9 landscape, 10s — professional content",
  },
];

export const PLATFORM_NAMES = [...new Set(PLATFORM_PRESETS.map(p => p.platform))];
