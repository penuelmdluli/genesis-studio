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
  | "cogvideo-x"
  | "mimic-motion"
  | "kling-2.6"
  | "kling-3.0"
  | "veo-3.1"
  | "seedance-1.5";

export type ModelTier =
  | "flagship"
  | "workhorse"
  | "speed"
  | "turbo"
  | "realism"
  | "budget"
  | "motion"
  | "hollywood";

export type VideoProvider = "runpod-hub" | "runpod-custom" | "fal";

export type GenerationType = "t2v" | "i2v" | "v2v" | "motion";

// --- Feature Types (RunPod Hub Expansion) ---
export type FeatureId =
  | "talking-avatar"
  | "voiceover"
  | "captions"
  | "thumbnails"
  | "video-effects"
  | "video-upscale"
  | "face-swap"
  | "avatar-generator"
  | "character-designer"
  | "voice-clone"
  | "presentations"
  | "image-upscale";

export type FeatureCategory = "create" | "enhance" | "audio" | "image";

export interface FeatureConfig {
  id: FeatureId;
  name: string;
  description: string;
  category: FeatureCategory;
  creditCost: string; // e.g. "2 credits/min" — for display
  minPlan: PlanId;
  endpointEnvKey: string; // e.g. "RUNPOD_ENDPOINT_CAPTIONS"
  comingSoon?: boolean;
}

// --- Voiceover Types ---
export interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female";
  language: string;
  preview?: string;
  isClone?: boolean;
}

// --- Caption Types ---
export type CaptionStyle = "tiktok" | "youtube" | "cinematic" | "custom";

export interface CaptionResult {
  srt: string;
  words: { word: string; start: number; end: number }[];
  language: string;
}

// --- Thumbnail Types ---
export interface ThumbnailResult {
  images: string[]; // base64 or URLs of generated thumbnails
  prompt: string;
}
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
  comingSoon?: boolean;
  // Provider & audio support
  provider?: VideoProvider;
  hasAudio?: boolean;
  falModelId?: string;      // FAL.AI model ID for t2v
  falModelIdI2V?: string;   // FAL.AI model ID for i2v
  maxDuration?: number;     // max duration in seconds
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
  credits: number; // monthly credits allocation
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
  soundEffects: boolean; // Hollywood Sound Design: ambient, SFX, foley per scene
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
  soundDesign?: SoundDesign;
}

export interface SoundDesign {
  ambientDescription: string;
  dialogueLines: Array<{ speaker: string; line: string }>;
  sfxCues: string[];
}

/** Enhanced sound design with timed SFX layers (for Hollywood Sound Design mode) */
export interface EnhancedSoundDesign {
  sceneNumber: number;
  ambient: {
    description: string;    // "Heavy rain on window, distant thunder"
    duration: number;       // Match scene duration
    loop: boolean;          // Ambient sounds usually loop
  };
  sfx: Array<{
    description: string;    // "Heavy wooden door creaking open"
    timestamp: number;      // When in the scene (seconds from scene start)
    duration: number;       // How long the sound lasts
  }>;
  foley: Array<{
    description: string;    // "Leather shoes on hardwood floor, slow steps"
    timestamp: number;
    duration: number;
  }>;
}

/** Generated audio assets for a scene's sound design */
export interface SceneSoundAssets {
  sceneNumber: number;
  ambientUrl?: string;
  ambientDurationMs?: number;
  sfxClips: Array<{ url: string; timestampMs: number; durationMs: number; description: string }>;
  foleyClips: Array<{ url: string; timestampMs: number; durationMs: number; description: string }>;
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

// Assembly state machine — tracks async FAL jobs during assembly
export interface AssemblyState {
  phase: "mmaudio" | "merge_audio" | "speed_adjust" | "concat" | "compose_audio" | "mix_final" | "trim_final" | "burn_captions" | "normalize" | "done";
  // Trim final video to voiceover duration
  trimFinalJob?: { requestId: string; status: string; videoUrl?: string };
  // Burn captions into video (auto-subtitle)
  burnCaptionsJob?: { requestId: string; status: string; videoUrl?: string };
  // Per-scene MMAudio jobs: sceneId -> FAL request_id
  mmaudioJobs: Record<string, { requestId: string; status: string; audioUrl?: string }>;
  // Per-scene merge-audio-video jobs: sceneId -> FAL request_id
  mergeJobs: Record<string, { requestId: string; status: string; mergedUrl?: string }>;
  // Final concatenation job
  concatJob?: { requestId: string; status: string; videoUrl?: string };
  // Compose voiceover + music into single audio track
  composeAudioJob?: { requestId: string; status: string; audioUrl?: string };
  // Final merge of combined audio onto video
  mixFinalJob?: { requestId: string; status: string; videoUrl?: string };
  // Final audio normalization job (loudnorm on the complete output)
  normalizeJob?: { requestId: string; status: string; videoUrl?: string };
  // Ordered scene URLs ready for concat (populated as merge/skip completes)
  processedSceneUrls: string[];
  // Scene order map: sceneId -> index in processedSceneUrls
  sceneOrder: Record<string, number>;
  // Scenes that have native audio (skip MMAudio)
  nativeAudioScenes: string[];
  // Per-scene voiceover clips from orchestration (placed at scene timestamps in compose)
  voiceoverClips?: Array<{ url: string; startMs: number; durationMs: number; sceneNumber?: number }>;
  // Per-scene actual audio durations in ms (from TTS generation, used for alignment)
  sceneAudioDurations?: Record<number, number>;
  // Word-level subtitle data from Whisper transcription
  subtitleData?: Array<{ start: number; end: number; text: string; sceneNumber?: number }>;
  // Scene transition type from plan (used during concat)
  transitionType?: string;
  // Per-scene speed adjustment jobs (stretch/compress video to match voiceover duration)
  speedAdjustJobs?: Record<string, { requestId: string; status: string; adjustedUrl?: string }>;
  // Actual concat video duration in ms (used by trim_final to cut music padding)
  concatDurationMs?: number;
  // Per-scene sound design assets (ambient, SFX, foley URLs with timing)
  soundAssets?: Array<SceneSoundAssets>;
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
  assemblyState?: AssemblyState;
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
