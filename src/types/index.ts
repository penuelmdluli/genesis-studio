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

export type GenerationType = "t2v" | "i2v" | "v2v";
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
  price: number; // monthly in dollars
  credits: number; // monthly credits, -1 for unlimited
  maxResolution: string;
  features: string[];
  stripePriceId?: string;
  popular?: boolean;
}

export interface CreditPack {
  id: string;
  credits: number;
  price: number;
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
}

export interface GenerateResponse {
  jobId: string;
  status: JobStatus;
  estimatedTime: number;
  creditsCost: number;
}

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  outputVideoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
}
