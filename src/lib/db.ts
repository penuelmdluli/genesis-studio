// ============================================
// GENESIS STUDIO — Database Operations
// ============================================

import { createSupabaseAdmin } from "./supabase";
import {
  GenerationJob,
  JobStatus,
  ModelId,
  PlanId,
  GenerationType,
  AspectRatio,
  Video,
  ApiKey,
} from "@/types";

function getSupabase() {
  return createSupabaseAdmin();
}

// --- User Operations ---

export async function getUserByClerkId(clerkId: string) {
  const { data, error } = await getSupabase()
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return data;
}

export async function createUser(params: {
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  const { data, error } = await getSupabase()
    .from("users")
    .insert({
      clerk_id: params.clerkId,
      email: params.email,
      name: params.name,
      avatar_url: params.avatarUrl,
      plan: "free",
      credit_balance: 50,
      monthly_credits_used: 0,
      monthly_credits_limit: 50,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data;
}

export async function updateUserPlan(
  userId: string,
  plan: PlanId,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
) {
  const creditLimits: Record<PlanId, number> = {
    free: 50,
    creator: 500,
    pro: 2000,
    studio: 8000,
  };

  const { error } = await getSupabase()
    .from("users")
    .update({
      plan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      monthly_credits_limit: creditLimits[plan],
    })
    .eq("id", userId);

  if (error) throw new Error(`Failed to update plan: ${error.message}`);
}

// --- Job Operations ---

export async function createJob(params: {
  userId: string;
  type: GenerationType;
  modelId: ModelId;
  prompt: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  inputVideoUrl?: string;
  resolution: string;
  duration: number;
  fps: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  isDraft: boolean;
  creditsCost: number;
  aspectRatio?: AspectRatio;
  audioTrackId?: string;
  audioUrl?: string;
}) {
  const { data, error } = await getSupabase()
    .from("generation_jobs")
    .insert({
      user_id: params.userId,
      status: "queued",
      type: params.type,
      model_id: params.modelId,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      input_image_url: params.inputImageUrl,
      input_video_url: params.inputVideoUrl,
      resolution: params.resolution,
      duration: params.duration,
      fps: params.fps,
      seed: params.seed,
      guidance_scale: params.guidanceScale,
      num_inference_steps: params.numInferenceSteps,
      is_draft: params.isDraft,
      credits_cost: params.creditsCost,
      progress: 0,
      aspect_ratio: params.aspectRatio,
      audio_track_id: params.audioTrackId,
      audio_url: params.audioUrl,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return data;
}

export async function updateJobStatus(
  jobId: string,
  updates: {
    status?: JobStatus;
    runpodJobId?: string;
    progress?: number;
    outputVideoUrl?: string;
    thumbnailUrl?: string;
    errorMessage?: string;
    gpuTime?: number;
    startedAt?: string;
    completedAt?: string;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.runpodJobId) updateData.runpod_job_id = updates.runpodJobId;
  if (updates.progress !== undefined) updateData.progress = updates.progress;
  if (updates.outputVideoUrl)
    updateData.output_video_url = updates.outputVideoUrl;
  if (updates.thumbnailUrl) updateData.thumbnail_url = updates.thumbnailUrl;
  if (updates.errorMessage) updateData.error_message = updates.errorMessage;
  if (updates.gpuTime) updateData.gpu_time = updates.gpuTime;
  if (updates.startedAt) updateData.started_at = updates.startedAt;
  if (updates.completedAt) updateData.completed_at = updates.completedAt;

  const { error } = await getSupabase()
    .from("generation_jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) throw new Error(`Failed to update job: ${error.message}`);
}

export async function getJob(jobId: string) {
  const { data, error } = await getSupabase()
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(`Failed to get job: ${error.message}`);
  return data;
}

export async function getUserJobs(
  userId: string,
  limit = 20,
  offset = 0,
  status?: JobStatus
) {
  let query = getSupabase()
    .from("generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get jobs: ${error.message}`);
  return data;
}

// --- Video Operations ---

export async function createVideo(params: {
  id?: string;
  userId: string;
  jobId?: string | null;
  title: string;
  url: string;
  thumbnailUrl: string;
  modelId: ModelId;
  prompt: string;
  resolution: string;
  duration: number;
  fps: number;
  fileSize: number;
  aspectRatio?: AspectRatio;
  audioUrl?: string;
  audioTrackId?: string;
}) {
  const insertData: Record<string, unknown> = {
    user_id: params.userId,
    job_id: params.jobId || null,
    title: params.title,
    url: params.url,
    thumbnail_url: params.thumbnailUrl,
    model_id: params.modelId,
    prompt: params.prompt,
    resolution: params.resolution,
    duration: params.duration,
    fps: params.fps,
    file_size: params.fileSize,
    is_public: false,
    aspect_ratio: params.aspectRatio,
    audio_url: params.audioUrl,
    audio_track_id: params.audioTrackId,
  };
  if (params.id) insertData.id = params.id;

  const { data, error } = await getSupabase()
    .from("videos")
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create video: ${error.message}`);
  return data;
}

export async function getUserVideos(
  userId: string,
  limit = 20,
  offset = 0
) {
  const { data, error } = await getSupabase()
    .from("videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get videos: ${error.message}`);
  return data;
}

export async function deleteVideo(videoId: string, userId: string) {
  const { error } = await getSupabase()
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete video: ${error.message}`);
}

// --- API Key Operations ---

export async function createApiKey(params: {
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
}) {
  const { data, error } = await getSupabase()
    .from("api_keys")
    .insert({
      user_id: params.userId,
      name: params.name,
      key_prefix: params.keyPrefix,
      key_hash: params.keyHash,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create API key: ${error.message}`);
  return data;
}

export async function getUserApiKeys(userId: string) {
  const { data, error } = await getSupabase()
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to get API keys: ${error.message}`);
  return data;
}

export async function validateApiKey(keyHash: string) {
  const { data, error } = await getSupabase()
    .from("api_keys")
    .select("*, users(*)")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error) return null;

  // Update last used timestamp
  await getSupabase()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}

export async function revokeApiKey(keyId: string, userId: string) {
  const { error } = await getSupabase()
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to revoke API key: ${error.message}`);
}
