// ============================================
// GENESIS STUDIO — Thumbnail Extraction
// Extracts a poster frame from a video and
// uploads it to R2 for instant display.
// ============================================

import { fal } from "@fal-ai/client";
import { uploadThumbnail, thumbnailStorageKey, getSignedDownloadUrl } from "./storage";

/**
 * Extract a thumbnail frame from a video and upload to R2.
 * Returns the API URL for the thumbnail, or empty string on failure.
 *
 * This is fire-and-forget safe — failures are logged but never thrown.
 * Call this after every successful video generation.
 */
export async function extractAndUploadThumbnail(
  videoR2Key: string,
  userId: string,
  videoId: string
): Promise<string> {
  try {
    // Get a signed URL so FAL can access our R2 video
    const signedUrl = await getSignedDownloadUrl(videoR2Key, 600);

    // Extract middle frame via FAL FFmpeg API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.run("fal-ai/ffmpeg-api/extract-frame", {
      input: {
        video_url: signedUrl,
        frame_type: "middle",
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    // FAL client wraps response in { data: ... }
    const responseData = result?.data || result;
    const frameUrl = responseData?.images?.[0]?.url;

    if (!frameUrl) {
      console.warn(`[THUMBNAIL] No frame URL returned for video ${videoId}`);
      return "";
    }

    // Download the frame
    const frameRes = await fetch(frameUrl);
    if (!frameRes.ok) {
      console.warn(`[THUMBNAIL] Frame download failed: ${frameRes.status}`);
      return "";
    }

    const frameBuffer = Buffer.from(await frameRes.arrayBuffer());
    if (frameBuffer.length < 1000) {
      console.warn(`[THUMBNAIL] Frame too small: ${frameBuffer.length} bytes`);
      return "";
    }

    // Upload to R2
    const thumbKey = thumbnailStorageKey(userId, videoId);
    await uploadThumbnail(thumbKey, frameBuffer, "image/jpeg");

    // Return the API URL for serving
    const thumbApiUrl = `/api/thumbnails/${videoId}`;
    console.log(`[THUMBNAIL] Created for ${videoId}: ${thumbApiUrl} (${frameBuffer.length} bytes)`);
    return thumbApiUrl;
  } catch (err) {
    console.error(`[THUMBNAIL] Extraction failed for ${videoId}:`, err instanceof Error ? err.message : err);
    return "";
  }
}

/**
 * Extract thumbnail from an external video URL (not in R2).
 * Used for FAL-generated videos before they're persisted.
 */
export async function extractThumbnailFromUrl(
  videoUrl: string,
  userId: string,
  videoId: string
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.run("fal-ai/ffmpeg-api/extract-frame", {
      input: {
        video_url: videoUrl,
        frame_type: "middle",
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const responseData = result?.data || result;
    const frameUrl = responseData?.images?.[0]?.url;

    if (!frameUrl) {
      console.warn(`[THUMBNAIL] No frame URL for ${videoId}`);
      return "";
    }

    const frameRes = await fetch(frameUrl);
    if (!frameRes.ok) return "";

    const frameBuffer = Buffer.from(await frameRes.arrayBuffer());
    if (frameBuffer.length < 1000) return "";

    const thumbKey = thumbnailStorageKey(userId, videoId);
    await uploadThumbnail(thumbKey, frameBuffer, "image/jpeg");

    const thumbApiUrl = `/api/thumbnails/${videoId}`;
    console.log(`[THUMBNAIL] Created for ${videoId}: ${thumbApiUrl}`);
    return thumbApiUrl;
  } catch (err) {
    console.error(`[THUMBNAIL] URL extraction failed for ${videoId}:`, err instanceof Error ? err.message : err);
    return "";
  }
}
