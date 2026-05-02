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

    // Fallback: concatenate ALL scenes via FFmpeg (no TTS/subtitles, but full video)
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
        error_message: "No scene videos available for assembly (fallback)",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    console.log(`[ASSEMBLY FALLBACK] Concatenating ${completedScenes.length} scenes via FFmpeg...`);

    // Try FFmpeg concat of all scenes
    let finalBuffer: Buffer | null = null;
    let totalDuration = completedScenes.reduce((sum, s) => sum + (s.duration || 8), 0);

    try {
      const { execSync } = await import("child_process");
      const { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, statSync } = await import("fs");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      // Find FFmpeg
      let ffmpeg = "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const installer = require("@ffmpeg-installer/ffmpeg");
        if (installer?.path) ffmpeg = installer.path;
      } catch { /* fallthrough */ }
      if (!ffmpeg) {
        for (const cmd of ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
          try { execSync(`"${cmd}" -version`, { stdio: "pipe", timeout: 5000 }); ffmpeg = cmd; break; } catch { /* next */ }
        }
      }

      if (ffmpeg) {
        const workDir = join(tmpdir(), `genesis-concat-${productionId.slice(0, 8)}`);
        if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

        // Download all scenes
        const sceneFiles: string[] = [];
        for (const scene of completedScenes) {
          const fp = join(workDir, `scene_${scene.sceneNumber}.mp4`);
          const res = await fetch(scene.outputVideoUrl!);
          if (!res.ok) throw new Error(`Download scene ${scene.sceneNumber} failed: ${res.status}`);
          writeFileSync(fp, Buffer.from(await res.arrayBuffer()));
          sceneFiles.push(fp);
        }

        // Concat
        const concatList = join(workDir, "list.txt");
        writeFileSync(concatList, sceneFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
        const concatOut = join(workDir, "final.mp4");

        try {
          execSync(`"${ffmpeg}" -y -f concat -safe 0 -i "${concatList}" -c copy "${concatOut}"`, { stdio: "pipe", timeout: 60000 });
        } catch {
          execSync(`"${ffmpeg}" -y -f concat -safe 0 -i "${concatList}" -c:v libx264 -preset fast -crf 23 -an "${concatOut}"`, { stdio: "pipe", timeout: 120000 });
        }

        // Try adding music
        const musicPath = join(process.cwd(), "public", "audio", "cinematic-epic.mp3");
        if (existsSync(musicPath) && existsSync(concatOut)) {
          const musicOut = join(workDir, "with_music.mp4");
          try {
            execSync(
              `"${ffmpeg}" -y -i "${concatOut}" -i "${musicPath}" ` +
              `-filter_complex "[1:a]volume=0.4,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300[mu]" ` +
              `-map 0:v -map "[mu]" -c:v copy -c:a aac -b:a 192k -shortest "${musicOut}"`,
              { stdio: "pipe", timeout: 60000 }
            );
            if (existsSync(musicOut) && statSync(musicOut).size > 10000) {
              finalBuffer = readFileSync(musicOut);
              console.log(`[ASSEMBLY FALLBACK] All scenes concatenated + music added`);
            }
          } catch (musicErr) {
            console.warn(`[ASSEMBLY FALLBACK] Music mix failed:`, musicErr);
          }
        }

        if (!finalBuffer && existsSync(concatOut)) {
          finalBuffer = readFileSync(concatOut);
          console.log(`[ASSEMBLY FALLBACK] All scenes concatenated (no music)`);
        }

        // Probe duration
        try {
          const probe = execSync(`"${ffmpeg}" -i "${concatOut}" 2>&1`, { stdio: "pipe", timeout: 10000, shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" as string }).toString();
          const m = probe.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
          if (m) totalDuration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        } catch { /* use sum */ }

        // Cleanup
        try { sceneFiles.forEach(f => { try { unlinkSync(f); } catch {} }); unlinkSync(concatList); } catch { /* ignore */ }
      }
    } catch (ffmpegErr) {
      console.warn(`[ASSEMBLY FALLBACK] FFmpeg concat failed:`, ffmpegErr);
    }

    // If FFmpeg failed, download scene 1 as last resort
    if (!finalBuffer) {
      console.log(`[ASSEMBLY FALLBACK] FFmpeg unavailable — using scene 1 only`);
      const res = await fetch(completedScenes[0].outputVideoUrl!);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      finalBuffer = Buffer.from(await res.arrayBuffer());
      totalDuration = completedScenes[0].duration || 8;
    }

    const videoId = randomUUID();
    const vKey = videoStorageKey(production.userId, videoId);
    const videoApiUrl = `/api/videos/${videoId}`;
    const fileSize = finalBuffer.length;

    console.log(`[ASSEMBLY FALLBACK] Final: ${(fileSize / 1024 / 1024).toFixed(1)} MB, ${totalDuration.toFixed(0)}s`);

    await uploadVideo(vKey, finalBuffer);
    await verifyR2Upload(vKey);

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
        modelId: "seedance-1.5" as ModelId,
        url: videoApiUrl,
        thumbnailUrl: "",
        duration: Math.round(totalDuration),
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

    console.log(`[ASSEMBLY FALLBACK] Production ${productionId} completed (${completedScenes.length} scenes)`);
  } catch (err) {
    console.error(`[ASSEMBLY FALLBACK] Failed:`, err);
    await updateProduction(productionId, {
      status: "failed",
      error_message: `Assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      completed_at: new Date().toISOString(),
    });
  }
}
