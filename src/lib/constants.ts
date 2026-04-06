// ============================================
// GENESIS STUDIO — Constants & Configuration
// ============================================

import { AIModel, Plan, CreditPack, ModelId, AudioTrack, MotionPreset, FeatureConfig, VoiceOption, VideoProvider } from "@/types";

// --- AI Models Registry ---
export const AI_MODELS: Record<ModelId, AIModel> = {
  "wan-2.2": {
    id: "wan-2.2",
    name: "Wan 2.2 (A14B)",
    tier: "flagship",
    types: ["t2v", "i2v"],
    description:
      "MoE architecture. Best cinematic quality. Complex motion & camera movements.",
    maxResolution: "1080p",
    avgGenerationTime: 300,
    creditCost: { "480p": 20, "720p": 40, "1080p": 80 },
    gpuRequirement: "48GB+ (A6000/H100)",
    license: "Apache 2.0",
    provider: "runpod-hub",
    maxDuration: 8,
  },
  "hunyuan-video": {
    id: "hunyuan-video",
    name: "HunyuanVideo 1.5",
    tier: "workhorse",
    types: ["t2v", "i2v"],
    description:
      "8.3B params. Best efficiency/quality ratio. Runs on 14GB VRAM with offloading.",
    maxResolution: "720p",
    avgGenerationTime: 75,
    creditCost: { "480p": 12, "720p": 25 },
    gpuRequirement: "14GB+ (RTX 4090/A6000)",
    license: "Open Source",
  },
  "ltx-video": {
    id: "ltx-video",
    name: "LTX-Video 13B",
    tier: "speed",
    types: ["t2v", "i2v", "v2v"],
    description:
      "Fastest model — 30fps at 1216×704 faster than real-time on H100.",
    maxResolution: "720p",
    avgGenerationTime: 30,
    creditCost: { "480p": 8, "720p": 15 },
    gpuRequirement: "12GB+ (RTX 4090)",
    license: "Open Source",
  },
  "wan-2.1-turbo": {
    id: "wan-2.1-turbo",
    name: "Wan 2.1 Turbo (720P)",
    tier: "turbo",
    types: ["i2v"],
    description:
      "30% faster than standard. Best speed-to-quality ratio for image-to-video.",
    maxResolution: "720p",
    avgGenerationTime: 60,
    creditCost: { "480p": 10, "720p": 20 },
    gpuRequirement: "24GB+ (RTX 4090)",
    license: "Apache 2.0",
  },
  "mochi-1": {
    id: "mochi-1",
    name: "Mochi 1 (10B)",
    tier: "realism",
    types: ["t2v"],
    description:
      "Largest open model. Best prompt adherence. Photorealistic quality.",
    maxResolution: "1080p",
    avgGenerationTime: 180,
    creditCost: { "480p": 20, "720p": 35, "1080p": 70 },
    gpuRequirement: "48GB+ (A6000/H100)",
    license: "Apache 2.0",
  },
  "cogvideo-x": {
    id: "cogvideo-x",
    name: "CogVideoX-5B",
    tier: "budget",
    types: ["t2v"],
    description:
      "Lightweight. 6-sec clips at 720×480. Perfect for quick previews.",
    maxResolution: "480p",
    avgGenerationTime: 90,
    creditCost: { "480p": 10 },
    gpuRequirement: "16GB+",
    license: "Apache 2.0",
    comingSoon: true,
  },
  "mimic-motion": {
    id: "mimic-motion",
    name: "MimicMotion",
    tier: "motion",
    types: ["motion"],
    description:
      "Motion transfer — extracts pose from a reference video and applies it to your character image.",
    maxResolution: "720p",
    avgGenerationTime: 120,
    creditCost: { "480p": 15, "720p": 30 },
    gpuRequirement: "24GB+ (RTX 4090/A6000)",
    license: "Apache 2.0",
    provider: "runpod-custom",
  },

  // --- Hollywood Tier (FAL.AI) — Native Audio ---
  "kling-2.6": {
    id: "kling-2.6",
    name: "Kling 2.6 Pro",
    tier: "hollywood",
    types: ["t2v", "i2v"],
    description:
      "Hollywood-grade video with native audio — dialogue, sound effects, ambient sound. Best audio+video sync.",
    maxResolution: "1080p",
    avgGenerationTime: 120,
    creditCost: { "720p": 100, "1080p": 150 },
    gpuRequirement: "Managed (FAL.AI)",
    license: "Commercial",
    provider: "fal",
    hasAudio: true,
    falModelId: "fal-ai/kling-video/v2.6/pro/text-to-video",
    falModelIdI2V: "fal-ai/kling-video/v2.6/pro/image-to-video",
    maxDuration: 10,
  },
  "kling-3.0": {
    id: "kling-3.0",
    name: "Kling 3.0 Pro",
    tier: "hollywood",
    types: ["t2v", "i2v"],
    description:
      "Latest Kling — multi-shot narrative, native audio, best character consistency.",
    maxResolution: "1080p",
    avgGenerationTime: 150,
    creditCost: { "720p": 250, "1080p": 350 },
    gpuRequirement: "Managed (FAL.AI)",
    license: "Commercial",
    provider: "fal",
    hasAudio: true,
    falModelId: "fal-ai/kling-video/v3/pro/text-to-video",
    falModelIdI2V: "fal-ai/kling-video/v3/pro/image-to-video",
    maxDuration: 10,
  },
  "veo-3.1": {
    id: "veo-3.1",
    name: "Veo 3.1",
    tier: "hollywood",
    types: ["t2v"],
    description:
      "Google's best — perfect lip sync, environmental audio, cinematic quality.",
    maxResolution: "1080p",
    avgGenerationTime: 180,
    creditCost: { "720p": 400, "1080p": 600 },
    gpuRequirement: "Managed (FAL.AI)",
    license: "Commercial",
    provider: "fal",
    hasAudio: true,
    falModelId: "fal-ai/veo3",
    maxDuration: 8,
  },
  "seedance-1.5": {
    id: "seedance-1.5",
    name: "Seedance 1.5 Pro",
    tier: "hollywood",
    types: ["t2v"],
    description:
      "Multi-scene narrative videos. Great motion quality at lower cost.",
    maxResolution: "1080p",
    avgGenerationTime: 90,
    creditCost: { "720p": 80, "1080p": 120 },
    gpuRequirement: "Managed (FAL.AI)",
    license: "Commercial",
    provider: "fal",
    hasAudio: false,
    falModelId: "fal-ai/seedance/v1.5/pro",
    maxDuration: 8,
  },
};

// --- Pricing Plans ---
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceZAR: 0,
    credits: 50,
    maxResolution: "720p",
    features: [
      "50 credits/month",
      "720p max resolution",
      "Watermarked output",
      "Auto Captions (3/month)",
      "AI Thumbnails (3/month)",
      "AI Voiceover (3/month)",
      "Community support",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    price: 12,
    priceZAR: 220,
    credits: 500,
    maxResolution: "1080p",
    features: [
      "500 credits/month",
      "1080p output",
      "No watermark",
      "All video models",
      "AI Voiceover (all voices)",
      "Auto Captions (unlimited)",
      "Video Upscaler (to 1080p)",
      "AI Thumbnails (unlimited)",
      "Brain Studio (3 productions)",
      "API access",
    ],
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    priceZAR: 535,
    credits: 2000,
    maxResolution: "4k",
    popular: true,
    features: [
      "2,000 credits/month",
      "4K output",
      "No watermark",
      "All models + Turbo",
      "Talking Avatar (20/month)",
      "AI Voiceover (unlimited)",
      "Video Upscaler (to 4K)",
      "Face Swap (10/month)",
      "Brain Studio (15 productions)",
      "Priority queue",
      "Full API access",
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  {
    id: "studio",
    name: "Studio",
    price: 79,
    priceZAR: 1460,
    credits: 8000,
    maxResolution: "4k",
    features: [
      "8,000 credits/month",
      "4K output",
      "Everything in Pro, highest limits",
      "Voice Cloning",
      "Talking Avatar (200/month)",
      "Face Swap (100/month)",
      "Brain Studio (50 productions)",
      "White-label API",
      "Dedicated support",
      "Lowest cost per credit ($0.0099)",
    ],
    stripePriceId: process.env.STRIPE_STUDIO_PRICE_ID,
  },
];

// --- Credit Packs ---
export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-500", credits: 500, price: 10, priceZAR: 185 },
  { id: "pack-2000", credits: 2000, price: 35, priceZAR: 650 },
  { id: "pack-10000", credits: 10000, price: 130, priceZAR: 2400 },
];

// --- Annual Plan Pricing (20% discount) ---
export const ANNUAL_PLANS: Record<string, { monthlyPrice: number; annualPrice: number; savings: number; stripePriceId?: string }> = {
  creator: {
    monthlyPrice: 12,
    annualPrice: 115, // $9.60/mo billed annually
    savings: 29,
    stripePriceId: process.env.STRIPE_CREATOR_ANNUAL_PRICE_ID,
  },
  pro: {
    monthlyPrice: 29,
    annualPrice: 278, // $23.20/mo billed annually
    savings: 70,
    stripePriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  },
  studio: {
    monthlyPrice: 79,
    annualPrice: 758, // $63.20/mo billed annually
    savings: 190,
    stripePriceId: process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID,
  },
};

// --- Referral Program ---
export const REFERRAL_REWARDS = {
  referrerCredits: 100,    // Credits the referrer gets
  refereeCredits: 50,      // Credits the new user gets (bonus on signup)
  maxReferrals: 50,        // Max referrals per user
  minPlanRequired: "free" as const, // Any plan can refer
};

// --- Credit Pack Upsell Thresholds ---
export const UPSELL_THRESHOLDS = {
  lowCreditWarning: 20,     // Show "running low" warning
  outOfCreditsUpsell: true,  // Show pack upsell when credits hit 0
  postGenerationUpsell: 5,   // Show upsell after N generations
  upgradePromptAt: 0.8,     // Show plan upgrade when 80% of monthly credits used
};

// --- Resolution Options ---
export const RESOLUTIONS = [
  { value: "480p", label: "480p (SD)", width: 854, height: 480 },
  { value: "720p", label: "720p (HD)", width: 1280, height: 720 },
  { value: "1080p", label: "1080p (Full HD)", width: 1920, height: 1080 },
  { value: "4k", label: "4K (Ultra HD)", width: 3840, height: 2160 },
];

// --- Vertical (Reel) Resolution Options ---
export const REEL_RESOLUTIONS = [
  { value: "480p", label: "480p Vertical", width: 480, height: 854 },
  { value: "720p", label: "720p Vertical", width: 720, height: 1280 },
  { value: "1080p", label: "1080p Vertical", width: 1080, height: 1920 },
];

// --- Duration Options ---
export const DURATIONS = [3, 5, 6, 8, 10];

// --- Reel Duration Options ---
export const REEL_DURATIONS = [5, 10, 15, 30, 60];

// --- FPS Options ---
export const FPS_OPTIONS = [24, 30];

// --- Built-in Audio Tracks Library ---
export const AUDIO_GENRES = [
  "Cinematic",
  "Electronic",
  "Lo-Fi",
  "Hip Hop",
  "Ambient",
  "Pop",
  "Rock",
  "Classical",
] as const;

export type AudioGenre = (typeof AUDIO_GENRES)[number];

export const BUILT_IN_AUDIO_TRACKS: AudioTrack[] = [
  {
    id: "track-cinematic-epic",
    name: "Epic Rising",
    genre: "Cinematic",
    duration: 60,
    url: "/audio/cinematic-epic.mp3",
    bpm: 120,
    isBuiltIn: true,
  },
  {
    id: "track-cinematic-emotional",
    name: "Emotional Journey",
    genre: "Cinematic",
    duration: 45,
    url: "/audio/cinematic-emotional.mp3",
    bpm: 80,
    isBuiltIn: true,
  },
  {
    id: "track-electronic-pulse",
    name: "Digital Pulse",
    genre: "Electronic",
    duration: 60,
    url: "/audio/electronic-pulse.mp3",
    bpm: 128,
    isBuiltIn: true,
  },
  {
    id: "track-electronic-future",
    name: "Future Bass",
    genre: "Electronic",
    duration: 30,
    url: "/audio/electronic-future.mp3",
    bpm: 140,
    isBuiltIn: true,
  },
  {
    id: "track-lofi-chill",
    name: "Chill Vibes",
    genre: "Lo-Fi",
    duration: 60,
    url: "/audio/lofi-chill.mp3",
    bpm: 85,
    isBuiltIn: true,
  },
  {
    id: "track-lofi-study",
    name: "Study Beats",
    genre: "Lo-Fi",
    duration: 45,
    url: "/audio/lofi-study.mp3",
    bpm: 75,
    isBuiltIn: true,
  },
  {
    id: "track-hiphop-trap",
    name: "Trap Energy",
    genre: "Hip Hop",
    duration: 30,
    url: "/audio/hiphop-trap.mp3",
    bpm: 140,
    isBuiltIn: true,
  },
  {
    id: "track-ambient-space",
    name: "Deep Space",
    genre: "Ambient",
    duration: 60,
    url: "/audio/ambient-space.mp3",
    bpm: 60,
    isBuiltIn: true,
  },
  {
    id: "track-pop-upbeat",
    name: "Upbeat Pop",
    genre: "Pop",
    duration: 30,
    url: "/audio/pop-upbeat.mp3",
    bpm: 120,
    isBuiltIn: true,
  },
  {
    id: "track-rock-drive",
    name: "Driving Rock",
    genre: "Rock",
    duration: 45,
    url: "/audio/rock-drive.mp3",
    bpm: 130,
    isBuiltIn: true,
  },
  {
    id: "track-classical-piano",
    name: "Piano Serenade",
    genre: "Classical",
    duration: 60,
    url: "/audio/classical-piano.mp3",
    bpm: 72,
    isBuiltIn: true,
  },
];

// --- Motion Library Presets ---
export const MOTION_CATEGORIES = [
  "All",
  "Dance",
  "Walk",
  "Gesture",
  "Sport",
  "Expression",
] as const;

// Motion reference presets — real human motion videos from stock library.
// These are used as pose/motion references for MimicMotion, not for display.
export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "motion-dance-hiphop",
    name: "Hip Hop Dance",
    description: "Urban dance moves with groove",
    thumbnailUrl: "https://assets.mixkit.co/videos/34588/34588-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/34588/34588-720.mp4",
    category: "dance",
  },
  {
    id: "motion-dance-contemporary",
    name: "Contemporary Dance",
    description: "Flowing contemporary dance movement",
    thumbnailUrl: "https://assets.mixkit.co/videos/32807/32807-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/32807/32807-720.mp4",
    category: "dance",
  },
  {
    id: "motion-dance-freestyle",
    name: "Freestyle Groove",
    description: "Energetic freestyle dance moves",
    thumbnailUrl: "https://assets.mixkit.co/videos/4793/4793-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/4793/4793-720.mp4",
    category: "dance",
  },
  {
    id: "motion-walk-forward",
    name: "Walk Forward",
    description: "Natural walking motion, forward facing",
    thumbnailUrl: "https://assets.mixkit.co/videos/1582/1582-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/1582/1582-720.mp4",
    category: "walk",
  },
  {
    id: "motion-walk-casual",
    name: "Casual Stroll",
    description: "Relaxed walking with arm swing",
    thumbnailUrl: "https://assets.mixkit.co/videos/4764/4764-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/4764/4764-720.mp4",
    category: "walk",
  },
  {
    id: "motion-walk-runway",
    name: "Runway Walk",
    description: "Confident fashion-style walk",
    thumbnailUrl: "https://assets.mixkit.co/videos/4458/4458-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/4458/4458-720.mp4",
    category: "walk",
  },
  {
    id: "motion-wave",
    name: "Friendly Wave",
    description: "Casual hand wave greeting",
    thumbnailUrl: "https://assets.mixkit.co/videos/50283/50283-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/50283/50283-720.mp4",
    category: "gesture",
  },
  {
    id: "motion-point",
    name: "Point & Present",
    description: "Pointing gesture for presentations",
    thumbnailUrl: "https://assets.mixkit.co/videos/39791/39791-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/39791/39791-720.mp4",
    category: "gesture",
  },
  {
    id: "motion-clap",
    name: "Clapping",
    description: "Enthusiastic clapping motion",
    thumbnailUrl: "https://assets.mixkit.co/videos/19510/19510-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/19510/19510-720.mp4",
    category: "gesture",
  },
  {
    id: "motion-run-sprint",
    name: "Sprint",
    description: "Full speed running motion",
    thumbnailUrl: "https://assets.mixkit.co/videos/1928/1928-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/1928/1928-720.mp4",
    category: "sport",
  },
  {
    id: "motion-jumping-jack",
    name: "Jumping Jacks",
    description: "Classic exercise jumping jacks",
    thumbnailUrl: "https://assets.mixkit.co/videos/23227/23227-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/23227/23227-720.mp4",
    category: "sport",
  },
  {
    id: "motion-yoga-pose",
    name: "Yoga Flow",
    description: "Smooth yoga pose transitions",
    thumbnailUrl: "https://assets.mixkit.co/videos/4645/4645-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/4645/4645-720.mp4",
    category: "sport",
  },
  {
    id: "motion-smile",
    name: "Smile & Laugh",
    description: "Natural smiling expression",
    thumbnailUrl: "https://assets.mixkit.co/videos/1168/1168-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/1168/1168-720.mp4",
    category: "expression",
  },
  {
    id: "motion-surprise",
    name: "Surprise Reaction",
    description: "Expressive surprise face and body",
    thumbnailUrl: "https://assets.mixkit.co/videos/43031/43031-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/43031/43031-720.mp4",
    category: "expression",
  },
  {
    id: "motion-talk",
    name: "Talking Head",
    description: "Natural talking with hand gestures",
    thumbnailUrl: "https://assets.mixkit.co/videos/42345/42345-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/42345/42345-720.mp4",
    category: "expression",
  },
  {
    id: "motion-sit-down",
    name: "Sit Down",
    description: "Standing to sitting transition",
    thumbnailUrl: "https://assets.mixkit.co/videos/42082/42082-720.mp4",
    previewVideoUrl: "https://assets.mixkit.co/videos/42082/42082-720.mp4",
    category: "gesture",
  },
];

// --- Plan access control ---
export const MODEL_ACCESS: Record<string, ModelId[]> = {
  free: ["wan-2.2", "seedance-1.5", "mimic-motion"],
  creator: [
    "wan-2.2",
    "seedance-1.5",
    "kling-2.6",
    "mimic-motion",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "mochi-1",
    "cogvideo-x",
  ],
  pro: [
    "wan-2.2",
    "seedance-1.5",
    "kling-2.6",
    "kling-3.0",
    "veo-3.1",
    "mimic-motion",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "mochi-1",
    "cogvideo-x",
  ],
  studio: [
    "wan-2.2",
    "seedance-1.5",
    "kling-2.6",
    "kling-3.0",
    "veo-3.1",
    "mimic-motion",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "mochi-1",
    "cogvideo-x",
  ],
};

// --- RunPod Hub Features ---
export const FEATURES: FeatureConfig[] = [
  {
    id: "talking-avatar",
    name: "Talking Avatar",
    description: "Upload a photo + audio/text to create a talking video with lip sync",
    category: "create",
    creditCost: "15 credits / 10s",
    minPlan: "pro",
    endpointEnvKey: "RUNPOD_ENDPOINT_TALKING_AVATAR",
  },
  {
    id: "avatar-generator",
    name: "Avatar Generator",
    description: "Full body animation from a photo + audio input",
    category: "create",
    creditCost: "20 credits / 15s",
    minPlan: "pro",
    endpointEnvKey: "RUNPOD_ENDPOINT_AVATAR_GENERATOR",
    comingSoon: true,
  },
  {
    id: "voiceover",
    name: "AI Voiceover",
    description: "Generate natural AI voiceover from text with 20+ voices",
    category: "audio",
    creditCost: "3 credits / 30s",
    minPlan: "free",
    endpointEnvKey: "", // Uses Edge TTS — no external endpoint required
  },
  {
    id: "captions",
    name: "Auto Captions",
    description: "Transcribe and add subtitles to any video in 75+ languages",
    category: "audio",
    creditCost: "2 credits / min",
    minPlan: "free",
    endpointEnvKey: "RUNPOD_ENDPOINT_CAPTIONS",
  },
  {
    id: "voice-clone",
    name: "Voice Clone",
    description: "Clone your voice from a 60-second sample for AI voiceovers",
    category: "audio",
    creditCost: "50 credits setup",
    minPlan: "studio",
    endpointEnvKey: "RUNPOD_ENDPOINT_VOICE_CLONE",
    comingSoon: true,
  },
  {
    id: "video-effects",
    name: "Video Effects",
    description: "Apply glitch, VHS, zoom, slow-mo and more to any video",
    category: "enhance",
    creditCost: "3 credits / effect",
    minPlan: "creator",
    endpointEnvKey: "RUNPOD_ENDPOINT_VIDEO_EFFECTS",
    comingSoon: true,
  },
  {
    id: "video-upscale",
    name: "Video Upscaler",
    description: "Upscale 480p/720p video to 1080p or 4K with AI enhancement",
    category: "enhance",
    creditCost: "5 credits / 5s",
    minPlan: "creator",
    endpointEnvKey: "RUNPOD_ENDPOINT_UPSCALE",
  },
  {
    id: "face-swap",
    name: "Face Swap",
    description: "Swap faces in any video with AI face restoration",
    category: "enhance",
    creditCost: "10 credits / swap",
    minPlan: "pro",
    endpointEnvKey: "RUNPOD_ENDPOINT_FACE_SWAP",
    comingSoon: true,
  },
  {
    id: "thumbnails",
    name: "AI Thumbnails",
    description: "Generate YouTube/Instagram thumbnails from text or video concept",
    category: "image",
    creditCost: "2 credits / 4 images",
    minPlan: "free",
    endpointEnvKey: "FAL_KEY", // Switched from RunPod SDXL to FAL.AI FLUX Pro
  },
  {
    id: "character-designer",
    name: "Character Designer",
    description: "Design consistent AI characters for use across all videos",
    category: "image",
    creditCost: "5 credits / character",
    minPlan: "creator",
    endpointEnvKey: "RUNPOD_ENDPOINT_CHARACTER",
    comingSoon: true,
  },
  {
    id: "image-upscale",
    name: "Image Upscaler",
    description: "Upscale any image 2x or 4x with Real-ESRGAN",
    category: "image",
    creditCost: "1 credit / image",
    minPlan: "free",
    endpointEnvKey: "RUNPOD_ENDPOINT_IMAGE_UPSCALE",
    comingSoon: true,
  },
  {
    id: "presentations",
    name: "Presentations",
    description: "Convert slides + audio into professional video presentations",
    category: "create",
    creditCost: "5 credits / min",
    minPlan: "creator",
    endpointEnvKey: "RUNPOD_ENDPOINT_PRESENTATIONS",
    comingSoon: true,
  },
];

// --- Feature access by plan ---
export const FEATURE_ACCESS: Record<string, string[]> = {
  free: ["captions", "voiceover", "thumbnails", "image-upscale"],
  creator: ["captions", "voiceover", "thumbnails", "image-upscale", "video-effects", "video-upscale", "character-designer", "presentations"],
  pro: ["captions", "voiceover", "thumbnails", "image-upscale", "video-effects", "video-upscale", "character-designer", "presentations", "talking-avatar", "avatar-generator", "face-swap"],
  studio: ["captions", "voiceover", "thumbnails", "image-upscale", "video-effects", "video-upscale", "character-designer", "presentations", "talking-avatar", "avatar-generator", "face-swap", "voice-clone"],
};

// --- Voice options for AI Voiceover ---
export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "voice-aria", name: "Aria", gender: "female", language: "en" },
  { id: "voice-james", name: "James", gender: "male", language: "en" },
  { id: "voice-luna", name: "Luna", gender: "female", language: "en" },
  { id: "voice-alex", name: "Alex", gender: "male", language: "en" },
  { id: "voice-sophia", name: "Sophia", gender: "female", language: "en" },
  { id: "voice-marcus", name: "Marcus", gender: "male", language: "en" },
  { id: "voice-naledi", name: "Naledi", gender: "female", language: "en-ZA" },
  { id: "voice-thabo", name: "Thabo", gender: "male", language: "en-ZA" },
  { id: "voice-sakura", name: "Sakura", gender: "female", language: "ja" },
  { id: "voice-carlos", name: "Carlos", gender: "male", language: "es" },
  { id: "voice-amelie", name: "Amelie", gender: "female", language: "fr" },
  { id: "voice-hans", name: "Hans", gender: "male", language: "de" },
];
