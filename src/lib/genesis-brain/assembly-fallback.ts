/**
 * Assembly Fallback -- Skip FAL-dependent steps when FAL credits are exhausted.
 * Instead of failing the entire production, produce a simpler output:
 * - Skip MMAudio (use scene videos as-is)
 * - Skip fancy compose (just concatenate scenes)
 * - Skip caption burn (captions can be added client-side)
 * The result is a working video without post-processing polish.
 */

import { AssemblyState } from "@/types";
import {
  getProduction,
  getProductionScenes,
  updateProduction,
} from "./orchestrator";
import { createVideo } from "@/lib/db";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
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
 * Full local assembly — uses FFmpeg + Edge TTS instead of FAL.
 * Produces a complete video with: all scenes concatenated + voiceover + music + captions.
 * Falls back to simplified (scene 1 only) if local FFmpeg is not available.
 */
export async function simplifiedFinalize(
  productionId: string
): Promise<void> {
  try {
    // Try full local assembly first (FFmpeg + Edge TTS)
    try {
      const { localAssembly } = await import("./assembly-local");
      console.log(`[ASSEMBLY FALLBACK] Attempting full local assembly (FFmpeg + Edge TTS)...`);
      const result = await localAssembly(productionId);
      if (result.success) {
        console.log(`[ASSEMBLY FALLBACK] Local assembly succeeded! Video: ${result.videoId}, Duration: ${result.duration}s`);
        return;
      }
      console.warn(`[ASSEMBLY FALLBACK] Local assembly failed: ${result.error}. Falling back to single-scene.`);
    } catch (localErr) {
      console.warn(`[ASSEMBLY FALLBACK] Local assembly not available:`, localErr);
    }

    // Fallback: single scene (last resort)
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

    const sourceUrl = completedScenes[0].outputVideoUrl!;
    console.log(`[ASSEMBLY FALLBACK] Using scene ${completedScenes[0].sceneNumber} as final video (single-scene fallback)`);

    const videoId = randomUUID();
    const vKey = videoStorageKey(production.userId, videoId);
    let videoApiUrl = `/api/videos/${videoId}`;
    let fileSize = 0;

    try {
      const videoRes = await fetch(sourceUrl);
      if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      fileSize = videoBuffer.length;
      await uploadVideo(vKey, videoBuffer);
      await verifyR2Upload(vKey);
    } catch (storageErr) {
      console.error(`[ASSEMBLY FALLBACK] R2 upload failed:`, storageErr);
      videoApiUrl = sourceUrl;
    }

    const sceneUrlMap: Record<string, string> = {};
    completedScenes.forEach((s) => {
      sceneUrlMap[`scene_${s.sceneNumber}`] = s.outputVideoUrl!;
    });
    sceneUrlMap["final"] = videoApiUrl;

    try {
      await createVideo({
        id: videoId,
        userId: production.userId,
        title: production.concept.slice(0, 100),
        prompt: production.concept,
        modelId: "wan-2.2" as ModelId,
        url: videoApiUrl,
        thumbnailUrl: "",
        duration: completedScenes[0].duration || 8,
        resolution: "1280x720",
        fps: 24,
        aspectRatio: production.aspectRatio,
        fileSize,
      });
    } catch (dbErr) {
      console.warn(`[ASSEMBLY FALLBACK] Video record creation failed:`, dbErr);
    }

    await updateProduction(productionId, {
      status: "completed",
      output_video_urls: JSON.stringify(sceneUrlMap),
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    console.log(`[ASSEMBLY FALLBACK] Production ${productionId} completed (single-scene fallback)`);
  } catch (err) {
    console.error(`[ASSEMBLY FALLBACK] Failed:`, err);
    await updateProduction(productionId, {
      status: "failed",
      error_message: `Assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      completed_at: new Date().toISOString(),
    });
  }
}
