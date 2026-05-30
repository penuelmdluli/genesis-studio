/**
 * GENESIS STUDIO — Video Branding
 *
 * Adds a "Made with Genesis Studio" watermark and marketing outro
 * to owner-produced videos. This brands all content created by the
 * operator's accounts for cross-platform marketing.
 */

import { isOwnerClerkId } from "@/lib/credits";

// Marketing tagline appended to voiceover scripts for owner accounts
export const OWNER_VOICEOVER_OUTRO =
  "Created with Genesis Studio. AI video generation for African creators. Try it free at genesis studio dot app.";

// Watermark text burned into the bottom of owner videos
export const OWNER_WATERMARK_TEXT = "ivideostudio.ai";

// Short marketing CTA for captions/subtitles
export const OWNER_CAPTION_CTA = "Made with Genesis Studio — ivideostudio.ai";

/**
 * Check if a user is an owner account (gets branding applied).
 */
export function shouldApplyBranding(clerkId: string): boolean {
  return isOwnerClerkId(clerkId);
}

/**
 * Check if a userId (not clerkId) is an owner. Requires DB lookup.
 */
export async function shouldApplyBrandingByUserId(userId: string): Promise<boolean> {
  const { getDb } = await import("@/lib/db-driver");
  const sb = getDb();
  const { data } = await sb.from("users").select("clerk_id").eq("id", userId).single();
  if (!data?.clerk_id) return false;
  return isOwnerClerkId(data.clerk_id);
}

/**
 * Append the marketing outro to a voiceover script.
 * Only for owner accounts — regular users don't get marketing in their videos.
 */
export function appendMarketingOutro(script: string, isOwner: boolean): string {
  if (!isOwner) return script;
  // Add a pause then the CTA
  return `${script.trim()} ... ${OWNER_VOICEOVER_OUTRO}`;
}

/**
 * Get FAL auto-subtitle input with watermark for owner videos.
 * Adds a text overlay at the bottom with the Genesis Studio URL.
 */
export function getWatermarkSubtitleConfig(isOwner: boolean) {
  if (!isOwner) return {};
  return {
    // The auto-subtitle endpoint supports a persistent text overlay
    // that stays visible throughout the video
    watermark_text: OWNER_WATERMARK_TEXT,
  };
}
