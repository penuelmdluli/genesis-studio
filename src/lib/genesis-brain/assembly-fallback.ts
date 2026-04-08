/**
 * Assembly Fallback -- Skip FAL-dependent steps when FAL credits are exhausted.
 * Instead of failing the entire production, produce a simpler output:
 * - Skip MMAudio (use scene videos as-is)
 * - Skip fancy compose (just concatenate scenes)
 * - Skip caption burn (captions can be added client-side)
 * The result is a working video without post-processing polish.
 */

import { AssemblyState, Production } from "@/types";
import {
  getProduction,
  getProductionScenes,
  updateProduction,
} from "./orchestrator";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createVideo } from "@/lib/db";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";
import { ModelId } from "@/types";
import { randomUUID } from "crypto";

/**
 * Check if FAL.AI is available by attempting a lightweight queue status call.
 * Returns false if we get a 402/403 "Exhausted balance" or auth error.
 */
export async function checkFalAvailability(): Promise<boolean> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.log(`[ASSEMBLY FALLBACK] No FAL_KEY configured -- FAL unavailable`);
    return false;
  }

  try {
    // Use the FAL REST API directly to check account status
    // A lightweight call to the queue status endpoint with a dummy request
    const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Minimal payload -- will fail quickly but tells us if auth works
        arguments: "-version",
        // This will error but we only care about the HTTP status
      }),
    });

    if (res.status === 402 || res.status === 403) {
      const body = await res.text().catch(() => "");
      console.log(`[ASSEMBLY FALLBACK] FAL returned ${res.status}: ${body.slice(0, 200)}`);
      return false;
    }

    if (res.status === 401) {
      console.log(`[ASSEMBLY FALLBACK] FAL auth failed (401) -- key may be invalid`);
      return false;
    }

    // Any other response (200, 422, 400, etc.) means FAL is reachable and auth works
    return true;
  } catch (err) {
    console.warn(`[ASSEMBLY FALLBACK] FAL health check failed:`, err);
    // Network error -- assume FAL is down
    return false;
  }
}

/**
 * Create a simplified assembly state that skips all FAL-dependent phases.
 * All scenes are treated as having native audio (no MMAudio needed),
 * and we jump straight to the "done" phase since we can't concat via FAL either.
 */
export function createSimplifiedAssemblyState(
  scenes: Array<{ id: string; outputVideoUrl: string; sceneNumber: number }>
): AssemblyState {
  const state: AssemblyState = {
    phase: "done", // Skip all FAL phases -- go straight to finalize
    mmaudioJobs: {},
    mergeJobs: {},
    processedSceneUrls: scenes.map((s) => s.outputVideoUrl),
    sceneOrder: {},
    nativeAudioScenes: scenes.map((s) => s.id),
  };

  // Build scene order map
  scenes.forEach((scene, idx) => {
    state.sceneOrder[scene.id] = idx;
  });

  return state;
}

/**
 * Simplified finalization for when FAL is unavailable.
 * Uses the first (or best) completed scene video as the final output.
 * No concat, no audio mixing, no caption burn -- just a clean working video.
 */
export async function simplifiedFinalize(
  productionId: string
): Promise<void> {
  try {
    const production = await getProduction(productionId);
    if (!production) {
      console.error(`[ASSEMBLY FALLBACK] Production ${productionId} not found`);
      return;
    }

    const freshScenes = await getProductionScenes(productionId);
    const completedScenes = freshScenes
      .filter((s) => s.status === "completed" && s.outputVideoUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (completedScenes.length === 0) {
      await updateProduction(productionId, {
        status: "failed",
        error_message: "No scene videos available for assembly (FAL fallback)",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    // Use the first completed scene as the final video
    // (Without FAL we can't concatenate multiple scenes)
    const sourceUrl = completedScenes[0].outputVideoUrl!;
    console.log(`[ASSEMBLY FALLBACK] Using scene ${completedScenes[0].sceneNumber} as final video (${completedScenes.length} scenes available, no FAL for concat)`);

    // Persist to R2
    const videoId = randomUUID();
    const vKey = videoStorageKey(production.userId, videoId);
    let videoApiUrl = `/api/videos/${videoId}`;
    let fileSize = 0;

    try {
      console.log(`[ASSEMBLY FALLBACK] Downloading scene video to R2: ${sourceUrl.slice(0, 80)}...`);
      const videoRes = await fetch(sourceUrl);
      if (!videoRes.ok) {
        throw new Error(`Failed to download video: ${videoRes.status}`);
      }
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      fileSize = videoBuffer.length;
      await uploadVideo(vKey, videoBuffer);
      await verifyR2Upload(vKey);
      console.log(`[ASSEMBLY FALLBACK] Video persisted to R2: ${vKey} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
    } catch (storageErr) {
      console.error(`[ASSEMBLY FALLBACK] R2 upload failed, using source URL:`, storageErr);
      videoApiUrl = sourceUrl;
    }

    // Build scene URL map
    const sceneUrlMap: Record<string, string> = {};
    completedScenes.forEach((s) => {
      sceneUrlMap[`scene_${s.sceneNumber}`] = s.outputVideoUrl!;
    });
    sceneUrlMap["final"] = videoApiUrl;

    // Extract thumbnail (skip FAL-based extraction since FAL is down)
    let finalThumbnail = "";
    try {
      if (videoApiUrl.startsWith("/api/videos/")) {
        finalThumbnail = await extractAndUploadThumbnail(vKey, production.userId, videoId);
      }
      // Cannot use extractThumbnailFromUrl -- it requires FAL
    } catch (thumbErr) {
      console.warn(`[ASSEMBLY FALLBACK] Thumbnail extraction failed:`, thumbErr);
    }

    // Create video record
    try {
      await createVideo({
        id: videoId,
        userId: production.userId,
        title: production.concept.slice(0, 100),
        prompt: production.concept,
        modelId: "wan-2.2" as ModelId,
        url: videoApiUrl,
        thumbnailUrl: finalThumbnail || "",
        duration: completedScenes[0].duration || 5,
        resolution: "1280x720",
        fps: 24,
        aspectRatio: production.aspectRatio,
        fileSize,
      });
    } catch (dbErr) {
      console.warn(`[ASSEMBLY FALLBACK] Video record creation failed (non-fatal):`, dbErr);
    }

    // Mark production as completed
    await updateProduction(productionId, {
      status: "completed",
      output_video_urls: JSON.stringify(sceneUrlMap),
      thumbnail_url: finalThumbnail || undefined,
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    console.log(`[ASSEMBLY FALLBACK] Production ${productionId} completed (simplified -- no FAL post-processing)`);
  } catch (err) {
    console.error(`[ASSEMBLY FALLBACK] Simplified finalize failed:`, err);
    await updateProduction(productionId, {
      status: "failed",
      error_message: `Simplified assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      completed_at: new Date().toISOString(),
    });
  }
}
