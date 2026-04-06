// ============================================
// GENESIS STUDIO — Auto-Publish to Explore Feed
// Free-tier videos auto-publish with full branding
// Paid-tier users opt-in from Gallery
// ============================================

import { createSupabaseAdmin } from "@/lib/supabase";
import { brandVideo, getPlanTier } from "@/lib/branding";
import { persistExternalVideo, exploreVideoStorageKey } from "@/lib/storage";
import { randomUUID } from "crypto";

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
 * After branding, the video is downloaded and persisted to R2 permanent storage
 * to prevent FAL URL expiration (FAL URLs expire after ~7 days).
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

    // Persist branded video to R2 permanent storage
    // FAL branded URLs expire after ~7 days — this makes them permanent
    const exploreId = randomUUID();
    const storageKey = exploreVideoStorageKey(exploreId);
    let permanentUrl = brandedUrl; // fallback to branded URL if persist fails

    try {
      await persistExternalVideo(brandedUrl, storageKey);
      permanentUrl = `/api/explore/video/${exploreId}`;
      console.log(`[AUTO-PUBLISH] Persisted to R2: ${storageKey}`);
    } catch (persistErr) {
      console.error("[AUTO-PUBLISH] R2 persist failed, using branded URL:", persistErr);
      // Fall through with branded URL — better than no publish at all
    }

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

    // Publish to explore feed with permanent URL
    const { error } = await supabase.from("explore_videos").insert({
      id: exploreId,
      source_video_id: params.jobId,
      user_id: params.userId,
      prompt: params.prompt,
      model_id: params.modelId,
      video_url: permanentUrl,
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
