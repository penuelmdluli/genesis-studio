// ============================================
// GENESIS STUDIO — Constants & Configuration
// ============================================

import { AIModel, Plan, CreditPack, ModelId, AudioTrack } from "@/types";

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
    creditCost: { "480p": 5, "720p": 8 },
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
    creditCost: { "480p": 3 },
    gpuRequirement: "16GB+",
    license: "Apache 2.0",
  },
};

// --- Pricing Plans ---
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 50,
    maxResolution: "720p",
    features: [
      "50 credits/month",
      "720p max resolution",
      "Watermarked output",
      "CogVideoX only",
      "Community support",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    price: 15,
    credits: 500,
    maxResolution: "1080p",
    features: [
      "500 credits/month",
      "1080p output",
      "No watermark",
      "All models",
      "API access",
      "Priority queue",
    ],
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
  },
  {
    id: "pro",
    name: "Pro",
    price: 39,
    credits: 2000,
    maxResolution: "4k",
    popular: true,
    features: [
      "2,000 credits/month",
      "4K output",
      "No watermark",
      "All models + Turbo",
      "Full API access",
      "Batch render",
      "Custom LoRA",
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  {
    id: "studio",
    name: "Studio",
    price: 99,
    credits: -1,
    maxResolution: "4k",
    features: [
      "Unlimited credits*",
      "4K output",
      "No watermark",
      "All models + Priority",
      "Full API access",
      "White-label",
      "Custom fine-tune",
      "Dedicated support",
    ],
    stripePriceId: process.env.STRIPE_STUDIO_PRICE_ID,
  },
];

// --- Credit Packs ---
export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-500", credits: 500, price: 12 },
  { id: "pack-2000", credits: 2000, price: 40 },
  { id: "pack-10000", credits: 10000, price: 150 },
];

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

// --- Plan access control ---
export const MODEL_ACCESS: Record<string, ModelId[]> = {
  free: ["cogvideo-x", "wan-2.2", "mochi-1"],
  creator: [
    "cogvideo-x",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "wan-2.2",
    "mochi-1",
  ],
  pro: [
    "cogvideo-x",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "wan-2.2",
    "mochi-1",
  ],
  studio: [
    "cogvideo-x",
    "ltx-video",
    "hunyuan-video",
    "wan-2.1-turbo",
    "wan-2.2",
    "mochi-1",
  ],
};
