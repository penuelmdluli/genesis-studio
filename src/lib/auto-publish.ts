// ============================================
// GENESIS STUDIO — Auto-Publish to Explore Feed
// Free-tier videos auto-publish with full branding
// Paid-tier users opt-in from Gallery
// ============================================

import { createSupabaseAdmin } from "@/lib/supabase";
import { brandVideo, getPlanTier } from "@/lib/branding";

interface AutoPublishParams {
  jobId: string;
  userId: string;
  prompt: string;
  modelId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  hasAudio?: boolean;
  type?: string; // 'standard' | 'motion' | 'brain'
  userPlan?: string;
  creatorName?: string;
  creatorAvatarUrl?: string;
}

/**
 * Auto-publish a completed video to the Explore feed.
 *
 * - Free tier: auto-publish with full branding (watermark + prompt overlay + outro)
 * - Paid tier: NOT auto-published (user can opt-in from Gallery)
 *
 * This is called from the webhook handler when a job completes.
 * It should always be fire-and-forget — failures here must never
 * break the main webhook flow.
 */
export async function autoPublishToExplore(
  params: AutoPublishParams
): Promise<void> {
  const plan = getPlanTier(params.userPlan);

  // Only auto-publish free tier videos
  if (plan !== "free") {
    console.log(
      `[AUTO-PUBLISH] Skipping — user is on ${plan} plan (opt-in only)`
    );
    return;
  }

  try {
    // Brand the video with watermark + prompt overlay + outro
    const brandedUrl = await brandVideo({
      videoUrl: params.videoUrl,
      prompt: params.prompt,
      plan: "free",
      creatorName: params.creatorName,
    });

    const supabase = createSupabaseAdmin();

    // Check if already published (prevent duplicates from webhook retries)
    const { data: existing } = await supabase
      .from("explore_videos")
      .select("id")
      .eq("source_video_id", params.jobId)
      .maybeSingle();

    if (existing) {
      console.log(`[AUTO-PUBLISH] Already published: ${params.jobId}`);
      return;
    }

    // Publish to explore feed
    const { error } = await supabase.from("explore_videos").insert({
      source_video_id: params.jobId,
      user_id: params.userId,
      prompt: params.prompt,
      model_id: params.modelId,
      video_url: brandedUrl,
      thumbnail_url: params.thumbnailUrl || null,
      duration: params.duration || null,
      resolution: params.resolution || null,
      has_audio: params.hasAudio || false,
      type: params.type || "standard",
      is_free_tier: true,
      creator_name: params.creatorName || "Genesis Creator",
      creator_avatar_url: params.creatorAvatarUrl || null,
      is_published: true,
    });

    if (error) {
      console.error("[AUTO-PUBLISH] DB insert failed:", error.message);
    } else {
      console.log(
        `[AUTO-PUBLISH] Published to Explore: "${params.prompt.slice(0, 50)}..."`
      );
    }
  } catch (err) {
    // Auto-publish failure should NEVER break the main flow
    console.error("[AUTO-PUBLISH] Error:", err);
  }
}
