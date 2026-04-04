// ============================================
// GENESIS STUDIO — Core Type Definitions
// ============================================

// --- AI Models ---
export type ModelId =
  | "wan-2.2"
  | "hunyuan-video"
  | "ltx-video"
  | "wan-2.1-turbo"
  | "mochi-1"
  | "cogvideo-x";

export type ModelTier =
  | "flagship"
  | "workhorse"
  | "speed"
  | "turbo"
  | "realism"
  | "budget";

export type GenerationType = "t2v" | "i2v" | "v2v" | "motion";
export type AspectRatio = "landscape" | "portrait" | "square";
export type VideoFormat = "standard" | "reel";

export interface AIModel {
  id: ModelId;
  name: string;
  tier: ModelTier;
  types: GenerationType[];
  description: string;
  maxResolution: "480p" | "720p" | "1080p" | "4k";
  avgGenerationTime: number; // seconds
  creditCost: Record<string, number>; // resolution -> credits
  gpuRequirement: string;
  license: string;
  runpodEndpointId?: string;
}

// --- Users & Auth ---
export type PlanId = "free" | "creator" | "pro" | "studio";

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  creditBalance: number;
  monthlyCreditsUsed: number;
  monthlyCreditsLimit: number;
  apiKeyHash?: string;
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Credits ---
export type CreditTransactionType =
  | "subscription_grant"
  | "pack_purchase"
  | "generation_debit"
  | "generation_refund"
  | "admin_adjustment";

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number; // positive = credit, negative = debit
  balance: number; // balance after transaction
  description: string;
  jobId?: string;
  createdAt: string;
}

// --- Video Generation Jobs ---
export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationJob {
  id: string;
  userId: string;
  status: JobStatus;
  type: GenerationType;
  modelId: ModelId;
  prompt: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  inputVideoUrl?: string;
  resolution: string;
  duration: number; // seconds
  fps: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  isDraft: boolean;
  aspectRatio?: AspectRatio;
  audioTrackId?: string;
  audioUrl?: string;
  creditsCost: number;
  outputVideoUrl?: string;
  thumbnailUrl?: string;
  runpodJobId?: string;
  gpuTime?: number; // seconds
  errorMessage?: string;
  progress: number; // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// --- Audio Tracks ---
export interface AudioTrack {
  id: string;
  name: string;
  genre: string;
  duration: number; // seconds
  url: string; // R2 storage URL or built-in path
  bpm?: number;
  isBuiltIn: boolean;
}

// --- Videos ---
export interface Video {
  id: string;
  userId: string;
  jobId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  modelId: ModelId;
  prompt: string;
  resolution: string;
  duration: number;
  fps: number;
  fileSize: number;
  isPublic: boolean;
  aspectRatio?: AspectRatio;
  audioUrl?: string;
  audioTrackId?: string;
  createdAt: string;
}

// --- API Keys ---
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string; // first 8 chars for display
  keyHash: string;
  lastUsedAt?: string;
  createdAt: string;
  isActive: boolean;
}

// --- Pricing ---
export interface Plan {
  id: PlanId;
  name: string;
  price: number; // monthly in dollars (USD)
  priceZAR?: number; // monthly in South African Rand
  credits: number; // monthly credits, -1 for unlimited
  maxResolution: string;
  features: string[];
  stripePriceId?: string;
  popular?: boolean;
}

export interface CreditPack {
  id: string;
  credits: number;
  price: number; // USD
  priceZAR?: number; // South African Rand
  stripePriceId?: string;
}

// --- API Request/Response ---
export interface GenerateRequest {
  type: GenerationType;
  modelId: ModelId;
  prompt: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  inputVideoUrl?: string;
  resolution?: string;
  duration?: number;
  fps?: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  isDraft?: boolean;
  aspectRatio?: AspectRatio;
  audioTrackId?: string;
  // Motion control fields
  motionVideoUrl?: string;
  characterImageUrl?: string;
  characterOrientation?: CharacterOrientation;
  motionPresetId?: string;
}

export interface GenerateResponse {
  jobId: string;
  status: JobStatus;
  estimatedTime: number;
  creditsCost: number;
}

// --- Motion Control ---
export type CharacterOrientation = "match_video" | "match_image";

export interface MotionPreset {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  category: MotionCategory;
}

export type MotionCategory =
  | "dance"
  | "walk"
  | "gesture"
  | "sport"
  | "expression"
  | "custom";

export interface MotionControlRequest {
  modelId: ModelId;
  prompt: string;
  negativePrompt?: string;
  motionVideoUrl: string; // reference video with actions to mimic
  characterImageUrl: string; // character to apply motion to
  characterOrientation: CharacterOrientation;
  resolution?: string;
  duration?: number;
  fps?: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  aspectRatio?: AspectRatio;
}

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  outputVideoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
}

// --- Genesis Brain ---
export type VideoStyle =
  | "cinematic"
  | "social"
  | "commercial"
  | "story"
  | "meme"
  | "tutorial"
  | "documentary"
  | "music_video"
  | "explainer"
  | "vlog";

export type TransitionType =
  | "cut"
  | "crossfade"
  | "fade_black"
  | "fade_white"
  | "wipe_left"
  | "wipe_right"
  | "zoom_in"
  | "zoom_out"
  | "glitch"
  | "blur";

export type ProductionStatus =
  | "planning"
  | "planned"
  | "generating"
  | "assembling"
  | "completed"
  | "failed"
  | "cancelled";

export interface BrainInput {
  concept: string;
  targetDuration: number; // 15-120 seconds
  style: VideoStyle;
  aspectRatio: AspectRatio;
  voiceover: boolean;
  voiceoverLanguage?: string;
  voiceoverVoice?: string;
  captions: boolean;
  music: boolean;
  characterRefs?: string[];
  brandKit?: BrandKit;
  outputFormats?: AspectRatio[];
  template?: string;
}

export interface BrandKit {
  logo?: string;
  colors?: string[];
  font?: string;
  watermark?: string;
  watermarkPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface ScenePlan {
  title: string;
  totalDuration: number;
  scenes: SceneDefinition[];
  characters: CharacterDefinition[];
  musicMood: string;
  musicTempo: "slow" | "medium" | "fast";
  colorPalette: string[];
  overallStyle: string;
  voiceoverScript?: string;
  voiceoverTimings?: VoiceoverTiming[];
}

export interface SceneDefinition {
  sceneNumber: number;
  description: string;
  prompt: string;
  negativePrompt: string;
  modelId: ModelId;
  duration: number;
  resolution: string;
  cameraMovement: string;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  textOverlay?: TextOverlay;
  voiceoverLine?: string;
  soundEffect?: string;
  characterIds?: string[];
  colorGrade?: string;
}

export interface TextOverlay {
  text: string;
  position: "top" | "center" | "bottom";
  style: "title" | "subtitle" | "caption" | "cta";
  animateIn: "fade" | "slide-up" | "typewriter" | "none";
  animateOut: "fade" | "slide-down" | "none";
  startTime: number;
  endTime: number;
}

export interface VoiceoverTiming {
  sceneNumber: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  description: string;
  referenceImageUrl?: string;
  appearsInScenes: number[];
  clothing?: string;
  age?: string;
  ethnicity?: string;
  distinguishingFeatures?: string;
}

export interface Production {
  id: string;
  userId: string;
  status: ProductionStatus;
  concept: string;
  style: VideoStyle;
  targetDuration: number;
  aspectRatio: AspectRatio;
  plan?: ScenePlan;
  voiceover: boolean;
  music: boolean;
  captions: boolean;
  totalCredits: number;
  outputVideoUrls?: Record<string, string>; // aspectRatio -> url
  thumbnailUrl?: string;
  gifPreviewUrl?: string;
  voiceoverUrl?: string;
  musicUrl?: string;
  captionsUrl?: string;
  errorMessage?: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProductionScene {
  id: string;
  productionId: string;
  sceneNumber: number;
  status: JobStatus;
  prompt: string;
  modelId: ModelId;
  duration: number;
  resolution: string;
  outputVideoUrl?: string;
  runpodJobId?: string;
  gpuTime?: number;
  errorMessage?: string;
  progress: number;
  createdAt: string;
}

export interface ProductionTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  concept: string;
  style: VideoStyle;
  aspectRatio: AspectRatio;
  targetDuration: number;
  voiceover: boolean;
  music: boolean;
  captions: boolean;
  sceneStructure?: ScenePlan;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
}
