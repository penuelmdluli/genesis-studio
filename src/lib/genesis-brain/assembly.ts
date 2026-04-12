// ============================================
// GENESIS BRAIN — Async Cinematic Assembly
// State-machine design: submit FAL jobs, poll
// each step, advance phases. No timeouts.
// ============================================

import {
  getProduction,
  getProductionScenes,
  updateProduction,
} from "./orchestrator";
import {
  buildAudioPromptFromSoundDesign,
  submitMMAudioJob,
  submitMergeAudioVideoJob,
  submitMergeVideosJob,
  submitComposeVideoJob,
  submitSpeedAdjustJob,
  submitTrimVideoJob,
  submitLoudnormJob,
  trimSceneStart,
  getMediaDuration,
  checkFalQueueStatus,
  getFalQueueResult,
  generateWordLevelSubtitles,
  generatePerSceneVoiceover,
  selectMusic,
} from "./audio";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createVideo } from "@/lib/db";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { refundCredits } from "@/lib/credits";
import { extractThumbnailFromUrl, extractAndUploadThumbnail } from "@/lib/thumbnails";
import { AI_MODELS } from "@/lib/constants";
import { ModelId, SoundDesign, AspectRatio, AssemblyState, Production } from "@/types";
import { randomUUID } from "crypto";
import { fal } from "@fal-ai/client";

/**
 * Centralized failure handler — marks production failed AND refunds credits.
 * Every assembly failure MUST go through this to prevent credit leaks.
 */
async function failAssembly(
  productionId: string,
  errorMsg: string
): Promise<void> {
  try {
    const prod = await getProduction(productionId);
    await updateProduction(productionId, {
      status: "failed",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });
    // Refund credits on assembly failure (idempotent: only if not already refunded)
    if (prod && prod.totalCredits > 0 && prod.userId) {
      try {
        await refundCredits(
          prod.userId,
          prod.totalCredits,
          productionId,
          `Brain Studio assembly failed — automatic refund: ${errorMsg.slice(0, 120)}`
        );
        console.log(`[ASSEMBLY] Refunded ${prod.totalCredits} credits to ${prod.userId} for ${productionId}`);
      } catch (refundErr) {
        console.error(`[ASSEMBLY] Refund FAILED for ${productionId}:`, refundErr);
      }
    }
  } catch (err) {
    console.error(`[ASSEMBLY] failAssembly error for ${productionId}:`, err);
  }
}

// ---- PHASE 1: START ASSEMBLY (called once) ----

/**
 * Kick off async assembly — submits MMAudio jobs for silent scenes
 * and returns immediately. Each call takes <3s.
 */
export async function startAssembly(
  productionId: string
): Promise<void> {
  try {
    const freshScenes = await getProductionScenes(productionId);
    const completedScenes = freshScenes
      .filter((s) => s.status === "completed" && s.outputVideoUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (completedScenes.length === 0) {
      await failAssembly(productionId, "No scene videos available for assembly");
      return;
    }

    // Check if FAL is available -- if not, use simplified assembly
    const { checkFalAvailability, simplifiedFinalize } = await import("./assembly-fallback");
    const falAvailable = await checkFalAvailability();

    if (!falAvailable) {
      console.log(`[ASSEMBLY] FAL credits exhausted -- using simplified assembly (scene videos only)`);
      // Skip MMAudio, concat, and all FAL-dependent phases.
      // Use the completed scene videos directly as the final output.
      await simplifiedFinalize(productionId);
      return;
    }

    const production = await getProduction(productionId);
    const plan = production?.plan;
    const supabase = createSupabaseAdmin();

    // ---- Audio Recovery ----
    // If after() died before audio generation, generate missing audio now.
    // This is the safety net: scenes are already done, we just need audio.
    const existingState = production?.assemblyState as Record<string, unknown> | undefined;

    // Recover voiceover if requested but missing
    if (production?.voiceover && !production.voiceoverUrl && plan?.scenes) {
      const scenesWithVO = plan.scenes.filter((s: { voiceoverLine?: string }) => s.voiceoverLine?.trim());
      if (scenesWithVO.length > 0) {
        console.log(`[ASSEMBLY] Recovering missing voiceover for ${scenesWithVO.length} scenes...`);
        try {
          const voResult = await generatePerSceneVoiceover(
            plan.scenes,
            (production as unknown as Record<string, unknown>)?.voiceoverLanguage as string || "en-US"
          );
          if (voResult.clips.length > 0) {
            // Store voiceover URL
            await updateProduction(productionId, { voiceover_url: voResult.fullUrl });
            // Store clips + durations in assembly pre-state
            // IMPORTANT: Pass raw object, NOT JSON.stringify! Supabase JSONB stores
            // stringified values as JSON strings, making properties inaccessible.
            const preState: Record<string, unknown> = {
              ...(existingState || {}),
              voiceoverClips: voResult.clips.map((c) => ({
                url: c.url,
                startMs: c.startMs,
                durationMs: c.durationMs,
                sceneNumber: c.sceneNumber,
              })),
              sceneAudioDurations: voResult.sceneAudioDurations,
            };
            await supabase
              .from("productions")
              .update({ assembly_state: preState })
              .eq("id", productionId);
            // Update in-memory reference
            if (production) {
              production.voiceoverUrl = voResult.fullUrl;
            }
            console.log(`[ASSEMBLY] Voiceover recovered: ${voResult.clips.length} clips`);
          }
        } catch (voErr) {
          console.error(`[ASSEMBLY] Voiceover recovery failed (non-fatal):`, voErr);
        }
      }
    }

    // Recover music if requested but missing
    if (production?.music && !production.musicUrl && plan) {
      console.log(`[ASSEMBLY] Recovering missing music...`);
      try {
        const musicResult = await selectMusic(
          plan.musicMood || "cinematic",
          plan.musicTempo || "medium",
          plan.totalDuration || 15
        );
        if (musicResult.url) {
          await updateProduction(productionId, { music_url: musicResult.url });
          if (production) {
            production.musicUrl = musicResult.url;
          }
          console.log(`[ASSEMBLY] Music recovered: ${musicResult.url.slice(0, 60)}...`);
        }
      } catch (musicErr) {
        console.error(`[ASSEMBLY] Music recovery failed (non-fatal):`, musicErr);
      }
    }

    // Re-fetch production to get updated audio URLs after recovery
    const refreshedProd = await getProduction(productionId);
    const refreshedState = refreshedProd?.assemblyState as Record<string, unknown> | undefined;

    // Preserve per-scene voiceover clips from orchestration phase (or recovery)
    const savedVoiceoverClips = refreshedState?.voiceoverClips || existingState?.voiceoverClips;

    // Build assembly state
    const state: AssemblyState = {
      phase: "mmaudio",
      mmaudioJobs: {},
      mergeJobs: {},
      processedSceneUrls: new Array(completedScenes.length).fill(""),
      sceneOrder: {},
      nativeAudioScenes: [],
    };

    // Carry forward voiceover clips from orchestration
    if (savedVoiceoverClips) {
      state.voiceoverClips = savedVoiceoverClips as AssemblyState["voiceoverClips"];
      console.log(`[ASSEMBLY] Preserved ${(savedVoiceoverClips as Array<unknown>).length} per-scene voiceover clips`);
    }

    // Carry forward per-scene audio durations and transition type
    const savedAudioDurations = refreshedState?.sceneAudioDurations || existingState?.sceneAudioDurations;
    if (savedAudioDurations) {
      state.sceneAudioDurations = savedAudioDurations as AssemblyState["sceneAudioDurations"];
    }
    const savedTransition = refreshedState?.transitionType || existingState?.transitionType;
    if (savedTransition) {
      state.transitionType = savedTransition as string;
    }

    // Carry forward sound design assets (ambient, SFX, foley per scene)
    const savedSoundAssets = refreshedState?.soundAssets || existingState?.soundAssets;
    if (savedSoundAssets) {
      state.soundAssets = savedSoundAssets as AssemblyState["soundAssets"];
      console.log(`[ASSEMBLY] Preserved sound design assets for ${(savedSoundAssets as Array<unknown>).length} scenes`);
    }

    // ── ANTI-FACE TRIM: Strip first 3 seconds from every scene ──
    // The video model (wan-2.2) generates a face/person in the opening
    // frames that fades into the real content. Trimming 3s removes it.
    const TRIM_START_SECONDS = 3;
    console.log(`[ASSEMBLY] Trimming first ${TRIM_START_SECONDS}s from ${completedScenes.length} scenes (anti-face)...`);
    const trimPromises = completedScenes.map(async (scene) => {
      if (!scene.outputVideoUrl) return;
      try {
        const trimmedUrl = await trimSceneStart(scene.outputVideoUrl, TRIM_START_SECONDS);
        if (trimmedUrl !== scene.outputVideoUrl) {
          scene.outputVideoUrl = trimmedUrl;
          console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: trimmed → ${trimmedUrl.substring(0, 50)}...`);
        }
      } catch (err) {
        console.warn(`[ASSEMBLY] Scene ${scene.sceneNumber}: trim failed, using original`, err);
      }
    });
    await Promise.all(trimPromises);
    console.log(`[ASSEMBLY] Anti-face trim complete`);

    let needsMMAudio = false;

    for (let i = 0; i < completedScenes.length; i++) {
      const scene = completedScenes[i];
      state.sceneOrder[scene.id] = i;

      // Check if model has native audio
      const { data: sceneRow } = await supabase
        .from("production_scenes")
        .select("model_id, provider, model_has_audio")
        .eq("id", scene.id)
        .single();

      const modelId = sceneRow?.model_id as ModelId | undefined;
      const model = modelId ? AI_MODELS[modelId] : null;
      const hasNativeAudio = sceneRow?.model_has_audio || model?.hasAudio || false;

      if (hasNativeAudio) {
        // Scene already has audio — use as-is, skip MMAudio
        state.processedSceneUrls[i] = scene.outputVideoUrl!;
        state.nativeAudioScenes.push(scene.id);
        console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: native audio (${modelId}), skipping MMAudio`);
      } else {
        // Silent scene — submit MMAudio job
        const sceneDef = plan?.scenes?.find(
          (s: { sceneNumber: number }) => s.sceneNumber === scene.sceneNumber
        );
        const soundDesign = sceneDef?.soundDesign as SoundDesign | undefined;
        const audioPrompt = buildAudioPromptFromSoundDesign(soundDesign);

        try {
          const { requestId } = await submitMMAudioJob(
            scene.outputVideoUrl!,
            audioPrompt,
            sceneDef?.duration || 8
          );
          state.mmaudioJobs[scene.id] = { requestId, status: "IN_QUEUE" };
          needsMMAudio = true;
          console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: MMAudio submitted (${requestId})`);
        } catch (err) {
          // MMAudio submission failed — use silent video
          console.warn(`[ASSEMBLY] Scene ${scene.sceneNumber}: MMAudio submit failed, using silent`, err);
          state.processedSceneUrls[i] = scene.outputVideoUrl!;
          state.nativeAudioScenes.push(scene.id);
        }
      }
    }

    // If no scenes need MMAudio, skip straight to concat
    if (!needsMMAudio) {
      state.phase = "concat";
      console.log(`[ASSEMBLY] All scenes have audio — skipping to concat`);
    }

    // Save state and return immediately
    await updateProduction(productionId, {
      assembly_state: state as unknown as Record<string, unknown>,
      progress: 72,
    });

    console.log(`[ASSEMBLY] startAssembly complete for ${productionId} — phase: ${state.phase}`);
  } catch (err) {
    console.error(`[ASSEMBLY] startAssembly error for ${productionId}:`, err);
    await failAssembly(
      productionId,
      `Assembly start failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

// ---- PHASE 2: POLL ASSEMBLY (called on every status poll) ----

/**
 * Advance assembly state machine one tick. Each call is fast (<5s).
 * Called by the status endpoint on each poll while status === "assembling".
 */
export async function pollAssembly(productionId: string): Promise<void> {
  try {
    const production = await getProduction(productionId);
    if (!production || production.status !== "assembling") return;

    const state = production.assemblyState;
    if (!state) {
      // No assembly state yet — startAssembly hasn't run
      console.warn(`[ASSEMBLY POLL] No assembly_state for ${productionId}`);
      return;
    }

    let updated = false;

    switch (state.phase) {
      case "mmaudio":
        updated = await pollMMAudioPhase(productionId, state);
        break;
      case "merge_audio":
        updated = await pollMergeAudioPhase(productionId, state);
        break;
      case "speed_adjust":
        // Speed_adjust is deprecated — compose API can't change playback speed.
        // Mix_final now trims output to voiceover duration instead.
        console.log(`[ASSEMBLY] Skipping deprecated speed_adjust phase → concat`);
        state.phase = "concat";
        updated = true;
        break;
      case "concat":
        updated = await pollConcatPhase(productionId, state, production);
        break;
      case "compose_audio":
        updated = await pollComposeAudioPhase(productionId, state, production);
        break;
      case "sound_premix":
        updated = await pollSoundPremixPhase(productionId, state, production);
        break;
      case "mix_final":
        updated = await pollMixFinalPhase(productionId, state, production);
        break;
      case "trim_final":
        updated = await pollTrimFinalPhase(productionId, state, production);
        break;
      case "burn_captions":
        updated = await pollBurnCaptionsPhase(productionId, state);
        break;
      case "normalize":
        // Normalize phase is deprecated — loudnorm strips video stream.
        // Any in-flight productions stuck here: skip to done immediately.
        console.log(`[ASSEMBLY] Skipping deprecated normalize phase → done`);
        state.phase = "done";
        updated = true;
        break;
      case "done":
        // Already complete — finalize
        await finalizeAssembly(productionId, state, production);
        return;
    }

    if (updated) {
      await updateProduction(productionId, {
        assembly_state: state as unknown as Record<string, unknown>,
      });
    }
  } catch (err) {
    console.error(`[ASSEMBLY POLL] Error for ${productionId}:`, err);

    // Track consecutive poll failures — fail production after 5 in a row
    const supabase = createSupabaseAdmin();
    const { data: prodRow } = await supabase
      .from("productions")
      .select("assembly_state")
      .eq("id", productionId)
      .single();

    const currentState = prodRow?.assembly_state as Record<string, unknown> | null;
    const pollErrors = ((currentState?.pollErrorCount as number) || 0) + 1;

    if (pollErrors >= 5) {
      const errMsg = err instanceof Error ? err.message : "Unknown assembly error";
      console.error(`[ASSEMBLY POLL] 5 consecutive errors — failing production ${productionId}: ${errMsg}`);
      await failAssembly(
        productionId,
        `Assembly failed after 5 poll errors: ${errMsg}`
      );
    } else {
      // Save error count for next poll
      await supabase
        .from("productions")
        .update({ assembly_state: { ...currentState, pollErrorCount: pollErrors } })
        .eq("id", productionId);
    }
  }
}

// ---- Phase handlers ----

async function pollMMAudioPhase(
  productionId: string,
  state: AssemblyState
): Promise<boolean> {
  let anyPending = false;
  let updated = false;

  for (const [sceneId, job] of Object.entries(state.mmaudioJobs)) {
    if (job.status === "COMPLETED" || job.status === "FAILED") continue;

    const result = await checkFalQueueStatus("fal-ai/mmaudio-v2", job.requestId);

    if (result.status === "COMPLETED") {
      const data = await getFalQueueResult("fal-ai/mmaudio-v2", job.requestId);
      const audioData = data?.audio as { url: string } | undefined;
      job.status = "COMPLETED";
      job.audioUrl = audioData?.url || "";
      updated = true;

      // If MMAudio returned no audio URL, fall back to silent video immediately
      if (!job.audioUrl) {
        const idx = state.sceneOrder[sceneId];
        if (idx !== undefined) {
          const scenes = await getProductionScenes(productionId);
          const scene = scenes.find(s => s.id === sceneId);
          if (scene?.outputVideoUrl) {
            state.processedSceneUrls[idx] = scene.outputVideoUrl;
          }
        }
        console.warn(`[ASSEMBLY] MMAudio completed but no audio URL for scene ${sceneId}, using silent`);
      } else {
        console.log(`[ASSEMBLY] MMAudio completed for scene ${sceneId}: ${job.audioUrl}`);
      }
    } else if (result.status === "FAILED") {
      job.status = "FAILED";
      updated = true;
      // Use silent video as fallback
      const idx = state.sceneOrder[sceneId];
      if (idx !== undefined) {
        const scenes = await getProductionScenes(productionId);
        const scene = scenes.find(s => s.id === sceneId);
        if (scene?.outputVideoUrl) {
          state.processedSceneUrls[idx] = scene.outputVideoUrl;
        }
      }
      console.warn(`[ASSEMBLY] MMAudio failed for scene ${sceneId}, using silent`);
    } else {
      anyPending = true;
    }
  }

  // Check if all MMAudio jobs are done
  if (!anyPending && updated) {
    // Submit merge-audio-video jobs for scenes that got audio
    const scenes = await getProductionScenes(productionId);
    let needsMerge = false;

    for (const [sceneId, job] of Object.entries(state.mmaudioJobs)) {
      if (job.status === "COMPLETED" && job.audioUrl) {
        // Has audio — submit merge job
        const scene = scenes.find(s => s.id === sceneId);
        if (scene?.outputVideoUrl) {
          try {
            const { requestId } = await submitMergeAudioVideoJob(
              scene.outputVideoUrl,
              job.audioUrl
            );
            state.mergeJobs[sceneId] = { requestId, status: "IN_QUEUE" };
            needsMerge = true;
            console.log(`[ASSEMBLY] Merge-audio submitted for scene ${sceneId} (${requestId})`);
          } catch (err) {
            // Merge submission failed — use silent video
            console.warn(`[ASSEMBLY] Merge submit failed for ${sceneId}`, err);
            const idx = state.sceneOrder[sceneId];
            if (idx !== undefined) state.processedSceneUrls[idx] = scene.outputVideoUrl;
          }
        }
      } else {
        // MMAudio failed or returned no audio — ensure silent fallback is set
        const idx = state.sceneOrder[sceneId];
        if (idx !== undefined && !state.processedSceneUrls[idx]) {
          const scene = scenes.find(s => s.id === sceneId);
          if (scene?.outputVideoUrl) {
            state.processedSceneUrls[idx] = scene.outputVideoUrl;
          }
        }
      }
    }

    if (needsMerge) {
      state.phase = "merge_audio";
    } else {
      // Skip speed_adjust — compose API doesn't change playback speed, just trims/pads.
      // Instead, mix_final now trims the output video to match voiceover duration.
      state.phase = "concat";
    }
    await updateProduction(productionId, { progress: 78 });
    console.log(`[ASSEMBLY] MMAudio phase done → ${state.phase}`);
  }

  if (updated) {
    await updateProduction(productionId, { progress: 75 });
  }

  return updated;
}

async function pollMergeAudioPhase(
  productionId: string,
  state: AssemblyState
): Promise<boolean> {
  let anyPending = false;
  let updated = false;

  for (const [sceneId, job] of Object.entries(state.mergeJobs)) {
    if (job.status === "COMPLETED" || job.status === "FAILED") continue;

    const result = await checkFalQueueStatus("fal-ai/ffmpeg-api/merge-audio-video", job.requestId);

    if (result.status === "COMPLETED") {
      const data = await getFalQueueResult("fal-ai/ffmpeg-api/merge-audio-video", job.requestId);
      const video = data?.video as { url: string } | undefined;
      job.status = "COMPLETED";
      job.mergedUrl = video?.url || "";
      updated = true;

      // Put merged URL into processedSceneUrls at correct position
      const idx = state.sceneOrder[sceneId];
      if (idx !== undefined && job.mergedUrl) {
        state.processedSceneUrls[idx] = job.mergedUrl;
      } else {
        // Fallback to original video
        const scenes = await getProductionScenes(productionId);
        const scene = scenes.find(s => s.id === sceneId);
        if (scene?.outputVideoUrl && idx !== undefined) {
          state.processedSceneUrls[idx] = scene.outputVideoUrl;
        }
      }
      console.log(`[ASSEMBLY] Merge-audio completed for scene ${sceneId}`);
    } else if (result.status === "FAILED") {
      job.status = "FAILED";
      updated = true;
      // Fallback to original silent video
      const idx = state.sceneOrder[sceneId];
      const scenes = await getProductionScenes(productionId);
      const scene = scenes.find(s => s.id === sceneId);
      if (scene?.outputVideoUrl && idx !== undefined) {
        state.processedSceneUrls[idx] = scene.outputVideoUrl;
      }
      console.warn(`[ASSEMBLY] Merge-audio failed for scene ${sceneId}, using silent`);
    } else {
      anyPending = true;
    }
  }

  // All merge jobs done → skip straight to concat
  // Speed_adjust is removed — compose API can't change playback speed.
  // Instead, mix_final trims the output to match voiceover duration.
  if (!anyPending && updated) {
    state.phase = "concat";
    await updateProduction(productionId, { progress: 84 });
    console.log(`[ASSEMBLY] Merge phase done → concat`);
  }

  return updated;
}

// ---- PHASE 2.5: SPEED ADJUST — Stretch/compress each scene to match voiceover ----

/**
 * For each scene: compare video duration vs voiceover duration.
 * If they differ, submit a compose job to speed-adjust the video.
 * This ensures visuals perfectly align with narration — voiceover is the spine.
 */
async function pollSpeedAdjustPhase(
  productionId: string,
  state: AssemblyState
): Promise<boolean> {
  const audioDurations = state.sceneAudioDurations;
  if (!audioDurations || Object.keys(audioDurations).length === 0) {
    state.phase = "concat";
    return true;
  }

  // Initialize speed adjust jobs if not yet started
  if (!state.speedAdjustJobs) {
    state.speedAdjustJobs = {};
    const scenes = await getProductionScenes(productionId);
    const completedScenes = scenes
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    let anySubmitted = false;

    for (let i = 0; i < completedScenes.length; i++) {
      const scene = completedScenes[i];
      const voiceoverDurationMs = audioDurations[scene.sceneNumber];
      const videoUrl = state.processedSceneUrls[i];

      if (!voiceoverDurationMs || !videoUrl) {
        // No voiceover for this scene — keep original speed
        console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: no voiceover, keeping original speed`);
        continue;
      }

      // Get actual video duration
      const videoDurationSec = await getMediaDuration(videoUrl);
      if (videoDurationSec <= 0) {
        console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: can't measure duration, keeping original`);
        continue;
      }

      const videoDurationMs = videoDurationSec * 1000;
      const ratio = voiceoverDurationMs / videoDurationMs;

      // Only adjust if mismatch is significant (>15% off)
      if (ratio >= 0.85 && ratio <= 1.15) {
        console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: ratio ${ratio.toFixed(2)} — close enough, skipping`);
        continue;
      }

      // Clamp speed to reasonable range (0.5x to 2.5x)
      const clampedTargetMs = Math.max(videoDurationMs * 0.4, Math.min(videoDurationMs * 2.5, voiceoverDurationMs));

      try {
        const { requestId } = await submitSpeedAdjustJob(videoUrl, clampedTargetMs);
        state.speedAdjustJobs[scene.id] = { requestId, status: "IN_QUEUE" };
        anySubmitted = true;
        const speedFactor = (videoDurationMs / clampedTargetMs).toFixed(2);
        const action = clampedTargetMs > videoDurationMs ? "slow-motion" : "speed-up";
        console.log(`[ASSEMBLY] Scene ${scene.sceneNumber}: ${action} ${speedFactor}x (${(videoDurationMs/1000).toFixed(1)}s → ${(clampedTargetMs/1000).toFixed(1)}s to match VO)`);
      } catch (err) {
        console.warn(`[ASSEMBLY] Speed adjust failed for scene ${scene.sceneNumber}:`, err);
      }
    }

    if (!anySubmitted) {
      // No adjustments needed — skip to concat
      state.phase = "concat";
      console.log(`[ASSEMBLY] Speed adjust: no adjustments needed → concat`);
      return true;
    }

    await updateProduction(productionId, { progress: 86 });
    return true;
  }

  // Poll speed adjust jobs
  let anyPending = false;
  let updated = false;

  const scenes = await getProductionScenes(productionId);
  const completedScenes = scenes
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  for (const [sceneId, job] of Object.entries(state.speedAdjustJobs)) {
    if (job.status === "COMPLETED" || job.status === "FAILED") continue;

    try {
      const result = await checkFalQueueStatus("fal-ai/ffmpeg-api", job.requestId);

      if (result.status === "COMPLETED") {
        try {
          const data = await getFalQueueResult("fal-ai/ffmpeg-api", job.requestId);
          const videoUrl = (data?.video_url as string) || (data?.video as { url: string })?.url || "";
          job.status = "COMPLETED";
          job.adjustedUrl = videoUrl;
          updated = true;

          // Replace processedSceneUrl with the speed-adjusted version
          const idx = state.sceneOrder[sceneId];
          if (idx !== undefined && videoUrl) {
            state.processedSceneUrls[idx] = videoUrl;
            const scene = completedScenes.find((s) => s.id === sceneId);
            console.log(`[ASSEMBLY] Scene ${scene?.sceneNumber || "?"}: speed-adjusted ✓`);
          }
        } catch (resultErr) {
          console.warn(`[ASSEMBLY] Speed adjust result failed for ${sceneId}:`, resultErr);
          job.status = "FAILED";
          updated = true;
        }
      } else if (result.status === "FAILED") {
        job.status = "FAILED";
        updated = true;
        console.warn(`[ASSEMBLY] Speed adjust failed for ${sceneId}, keeping original speed`);
      } else {
        anyPending = true;
      }
    } catch (pollErr) {
      console.warn(`[ASSEMBLY] Speed adjust poll error for ${sceneId}:`, pollErr);
      job.status = "FAILED";
      updated = true;
    }
  }

  if (!anyPending && updated) {
    // Recalculate voiceover timestamps to match adjusted video durations
    recalculateVoiceoverTimestamps(state, completedScenes);
    state.phase = "concat";
    await updateProduction(productionId, { progress: 88 });
    console.log(`[ASSEMBLY] Speed adjust done → concat (voiceover timestamps recalculated)`);
  }

  return updated;
}

/**
 * Recalculate voiceover clip startMs based on actual scene durations (post speed-adjust).
 * This ensures voiceover clips are placed at exact scene boundaries in the final compose.
 */
function recalculateVoiceoverTimestamps(
  state: AssemblyState,
  completedScenes: Array<{ sceneNumber: number; id: string }>
) {
  if (!state.voiceoverClips?.length || !state.sceneAudioDurations) return;

  // Build scene durations in order: use voiceover duration (since videos are now speed-matched)
  const sceneDurations: Record<number, number> = {};
  for (const scene of completedScenes) {
    const voDuration = state.sceneAudioDurations[scene.sceneNumber];
    if (voDuration) {
      sceneDurations[scene.sceneNumber] = voDuration;
    }
  }

  // Calculate cumulative offsets
  let offset = 0;
  const sceneOffsets: Record<number, number> = {};
  const sortedSceneNums = Object.keys(sceneDurations).map(Number).sort((a, b) => a - b);
  for (const sceneNum of sortedSceneNums) {
    sceneOffsets[sceneNum] = offset;
    offset += sceneDurations[sceneNum];
  }

  // Update voiceover clip startMs
  for (const clip of state.voiceoverClips) {
    if (clip.sceneNumber && sceneOffsets[clip.sceneNumber] !== undefined) {
      const oldStart = clip.startMs;
      clip.startMs = sceneOffsets[clip.sceneNumber];
      if (oldStart !== clip.startMs) {
        console.log(`[ASSEMBLY] VO clip scene ${clip.sceneNumber}: ${(oldStart/1000).toFixed(1)}s → ${(clip.startMs/1000).toFixed(1)}s`);
      }
    }
  }

  console.log(`[ASSEMBLY] Voiceover timestamps recalculated for ${state.voiceoverClips.length} clips`);
}

/**
 * Recalculate voiceover clip startMs based on ACTUAL VIDEO durations.
 * This ensures voiceover starts exactly when each scene appears on screen.
 * Video durations are measured from processedSceneUrls — the real source of truth.
 */
function recalculateTimestampsFromVideoDurations(state: AssemblyState) {
  if (!state.voiceoverClips?.length || !state.sceneVideoDurations) return;

  // Build cumulative offsets from actual video durations
  const sceneNums = Object.keys(state.sceneVideoDurations).map(Number).sort((a, b) => a - b);
  const sceneOffsets: Record<number, number> = {};
  let offset = 0;
  for (const sceneNum of sceneNums) {
    sceneOffsets[sceneNum] = offset;
    offset += state.sceneVideoDurations[sceneNum];
  }

  // Update voiceover clip timestamps to match video scene boundaries
  for (const clip of state.voiceoverClips) {
    if (clip.sceneNumber && sceneOffsets[clip.sceneNumber] !== undefined) {
      const oldStart = clip.startMs;
      clip.startMs = sceneOffsets[clip.sceneNumber];
      if (oldStart !== clip.startMs) {
        console.log(`[ASSEMBLY] VO clip scene ${clip.sceneNumber}: ${(oldStart / 1000).toFixed(1)}s → ${(clip.startMs / 1000).toFixed(1)}s (video-aligned)`);
      }
    }
  }

  console.log(`[ASSEMBLY] Voiceover timestamps aligned to actual video scene boundaries (${state.voiceoverClips.length} clips)`);
}

// ---- PHASE 3: CONCAT — Join all scenes into one video ----

async function pollConcatPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // If no concat job submitted yet, submit it now
  if (!state.concatJob) {
    const validUrls = state.processedSceneUrls.filter(u => u && u.length > 0);
    if (validUrls.length === 0) {
      // No valid scene URLs — fail
      await failAssembly(productionId, "No valid scene URLs for concatenation");
      return false;
    }

    // Single scene — skip concat
    if (validUrls.length === 1) {
      state.concatJob = { requestId: "skip", status: "COMPLETED", videoUrl: validUrls[0] };
      console.log(`[ASSEMBLY] Single scene — skipping concat`);
    } else {
      // Determine transition type from plan
      const transition = state.transitionType || "cut";
      const useCrossfade = transition === "crossfade" || transition === "fade_black";

      if (useCrossfade && validUrls.length > 1) {
        // CROSSFADE: Use compose API with overlapping video keyframes
        // Get actual scene durations for proper timing
        try {
          const sceneDurations: number[] = [];
          for (const url of validUrls) {
            const dur = await getMediaDuration(url);
            sceneDurations.push(dur > 0 ? dur : 8); // Default 8s if metadata fails
          }

          const crossfadeDurationSec = 0.5; // 0.5s overlap between scenes
          const crossfadeDurationMs = crossfadeDurationSec * 1000;

          // Build compose keyframes with overlapping timestamps for crossfade effect
          const videoKeyframes: Array<{ timestamp: number; duration: number; url: string }> = [];
          let currentTimestamp = 0;

          for (let i = 0; i < validUrls.length; i++) {
            const sceneDurMs = sceneDurations[i] * 1000;
            videoKeyframes.push({
              timestamp: currentTimestamp,
              duration: sceneDurMs,
              url: validUrls[i],
            });
            // Next scene starts slightly before this one ends (overlap = crossfade)
            currentTimestamp += sceneDurMs - (i < validUrls.length - 1 ? crossfadeDurationMs : 0);
          }

          const totalDurMs = currentTimestamp;
          const tracks = [{
            id: "video-crossfade",
            type: "video",
            keyframes: videoKeyframes,
          }];

          const result = await fal.queue.submit("fal-ai/ffmpeg-api/compose", {
            input: { tracks },
          });

          state.concatJob = { requestId: result.request_id, status: "IN_QUEUE" };
          console.log(`[ASSEMBLY] Crossfade concat submitted: ${result.request_id} (${validUrls.length} scenes, ${crossfadeDurationSec}s overlap)`);
        } catch (err) {
          console.warn(`[ASSEMBLY] Crossfade failed, falling back to hard cut:`, err);
          // Fallback to standard merge
          const { requestId } = await submitMergeVideosJob(validUrls);
          state.concatJob = { requestId, status: "IN_QUEUE" };
        }
      } else {
        // HARD CUT: Standard merge-videos concatenation
        try {
          const { requestId } = await submitMergeVideosJob(validUrls);
          state.concatJob = { requestId, status: "IN_QUEUE" };
          console.log(`[ASSEMBLY] Concat submitted: ${requestId} (${validUrls.length} scenes, hard cut)`);
        } catch (err) {
          console.error(`[ASSEMBLY] Concat submit failed:`, err);
          state.concatJob = { requestId: "skip", status: "COMPLETED", videoUrl: validUrls[0] };
        }
      }
    }
    return true;
  }

  // Poll concat job — check both compose and merge-videos endpoints
  if (state.concatJob.status !== "COMPLETED" && state.concatJob.status !== "FAILED") {
    // Try compose endpoint first (crossfade), then merge-videos (hard cut)
    let result = await checkFalQueueStatus("fal-ai/ffmpeg-api", state.concatJob.requestId);
    if (result.status === "FAILED") {
      // May be a merge-videos job instead
      result = await checkFalQueueStatus("fal-ai/ffmpeg-api/merge-videos", state.concatJob.requestId);
    }

    if (result.status === "COMPLETED") {
      // Try both result formats
      let data: Record<string, unknown>;
      try {
        data = await getFalQueueResult("fal-ai/ffmpeg-api", state.concatJob.requestId);
      } catch {
        data = await getFalQueueResult("fal-ai/ffmpeg-api/merge-videos", state.concatJob.requestId);
      }
      const videoUrl = (data?.video_url as string) ||
                       (data?.video as { url: string })?.url || "";
      state.concatJob.status = "COMPLETED";
      state.concatJob.videoUrl = videoUrl || state.processedSceneUrls[0];
      console.log(`[ASSEMBLY] Concat completed: ${state.concatJob.videoUrl}`);
    } else if (result.status === "FAILED") {
      state.concatJob.status = "FAILED";
      state.concatJob.videoUrl = state.processedSceneUrls[0]; // fallback
      console.warn(`[ASSEMBLY] Concat failed, using first scene`);
    } else {
      return false; // Still in progress
    }
  }

  // Concat done — check if we need audio mixing
  const hasVoiceover = !!production.voiceoverUrl;
  const hasPerSceneVO = (state.voiceoverClips?.length || 0) > 0;
  const hasMusic = !!production.musicUrl;
  const hasAnyVoiceover = hasVoiceover || hasPerSceneVO;

  if ((hasAnyVoiceover || hasMusic) && state.concatJob.videoUrl) {
    if (hasAnyVoiceover && hasMusic) {
      // Both voiceover + music → lower music volume first via loudnorm
      state.phase = "compose_audio";
      console.log(`[ASSEMBLY] Concat done → compose_audio (${hasPerSceneVO ? "per-scene VO" : "voiceover"} + music)`);
    } else {
      // Only one audio layer — check if we need sound premix first
      const hasSoundDesign = (state.soundAssets?.length || 0) > 0 &&
        state.soundAssets!.some(a => a.ambientUrl || a.sfxClips.length > 0 || a.foleyClips.length > 0);
      if (hasSoundDesign) {
        state.phase = "sound_premix";
        console.log(`[ASSEMBLY] Concat done → sound_premix (pre-mix sound design)`);
      } else {
        state.phase = "mix_final";
        console.log(`[ASSEMBLY] Concat done → mix_final (single audio layer)`);
      }
    }
    await updateProduction(productionId, { progress: 92 });
  } else {
    state.phase = "done";
    await updateProduction(productionId, { progress: 98 });
    console.log(`[ASSEMBLY] Concat done → done (no audio mix needed)`);
  }

  return true;
}

async function pollComposeAudioPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // This phase reduces music volume via loudnorm so it sits behind voiceover.
  // If loudnorm fails, we still pass the original music URL to mix_final.

  if (!state.composeAudioJob) {
    const musicUrl = production.musicUrl;

    if (!musicUrl) {
      // No music to process — check for sound design premix, else skip to mix_final
      const hasSoundDesign = (state.soundAssets?.length || 0) > 0 &&
        state.soundAssets!.some(a => a.ambientUrl || a.sfxClips.length > 0 || a.foleyClips.length > 0);
      state.phase = hasSoundDesign ? "sound_premix" : "mix_final";
      return true;
    }

    try {
      // Lower music to -28 LUFS — well below voiceover (-14 LUFS)
      // This ensures narration/dialogue is ALWAYS clearly audible above the music
      const { requestId } = await submitLoudnormJob(musicUrl, -28);
      state.composeAudioJob = { requestId, status: "IN_QUEUE" };
      console.log(`[ASSEMBLY] Loudnorm submitted for music: ${requestId} (target: -28 LUFS — background level)`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Loudnorm submit failed, using original music volume:`, err);
      // Still proceed — check for sound design premix
      const hasSoundDesign = (state.soundAssets?.length || 0) > 0 &&
        state.soundAssets!.some(a => a.ambientUrl || a.sfxClips.length > 0 || a.foleyClips.length > 0);
      state.phase = hasSoundDesign ? "sound_premix" : "mix_final";
    }
    return true;
  }

  // Poll loudnorm job
  if (state.composeAudioJob.status !== "COMPLETED" && state.composeAudioJob.status !== "FAILED") {
    try {
      const result = await checkFalQueueStatus("fal-ai/ffmpeg-api", state.composeAudioJob.requestId);

      if (result.status === "COMPLETED") {
        try {
          const data = await getFalQueueResult("fal-ai/ffmpeg-api", state.composeAudioJob.requestId);
          const audio = data?.audio as { url: string } | undefined;
          state.composeAudioJob.status = "COMPLETED";
          state.composeAudioJob.audioUrl = audio?.url || "";
          console.log(`[ASSEMBLY] Loudnorm completed — quieter music: ${state.composeAudioJob.audioUrl}`);
        } catch (resultErr) {
          console.warn(`[ASSEMBLY] Loudnorm result retrieval failed, using original music:`, resultErr);
          state.composeAudioJob.status = "FAILED";
        }
      } else if (result.status === "FAILED") {
        state.composeAudioJob.status = "FAILED";
        console.warn(`[ASSEMBLY] Loudnorm failed, using original music volume`);
      } else {
        return false; // Still in progress
      }
    } catch (pollErr) {
      console.warn(`[ASSEMBLY] Loudnorm status check failed, using original music:`, pollErr);
      state.composeAudioJob.status = "FAILED";
    }
  }

  // Loudnorm done → check if we have sound design to premix, else go to mix_final
  const hasSoundAssets = (state.soundAssets?.length || 0) > 0 &&
    state.soundAssets!.some(a => a.ambientUrl || a.sfxClips.length > 0 || a.foleyClips.length > 0);
  if (hasSoundAssets) {
    state.phase = "sound_premix";
    console.log(`[ASSEMBLY] Compose-audio done → sound_premix (pre-mix sound design to quiet bed)`);
  } else {
    state.phase = "mix_final";
    console.log(`[ASSEMBLY] Compose-audio done → mix_final (no sound design)`);
  }
  await updateProduction(productionId, { progress: 94 });
  return true;
}

/**
 * Build sound design clips from per-scene sound assets, placed at correct global timeline offsets.
 * Returns null if no sound assets exist.
 */
/**
 * Resolve a URL: if it's a full URL (http/https), return as-is.
 * If it's an R2 key (e.g. "sfx/user-id/file.mp3"), generate a presigned download URL.
 * This is needed because FAL's ffmpeg-api needs publicly accessible URLs.
 */
async function resolveAudioUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // It's an R2 key — generate a presigned download URL (valid for 1 hour)
  try {
    const { getSignedDownloadUrl } = await import("@/lib/storage");
    const signedUrl = await getSignedDownloadUrl(url, 3600);
    return signedUrl;
  } catch (err) {
    console.warn(`[ASSEMBLY] Failed to sign R2 URL for ${url}:`, err);
    // Fallback: try the app's video proxy
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    if (appUrl) {
      return `${appUrl}/api/audio/${encodeURIComponent(url)}`;
    }
    return url;
  }
}

async function buildSoundDesignClips(
  state: AssemblyState,
  production: Production
): Promise<{ ambient: Array<{ url: string; startMs: number; durationMs: number }>; sfx: Array<{ url: string; startMs: number; durationMs: number }>; foley: Array<{ url: string; startMs: number; durationMs: number }> } | null> {
  if (!state.soundAssets || state.soundAssets.length === 0) return null;

  const plan = production.plan;
  if (!plan?.scenes) return null;

  // Calculate per-scene start offset using ACTUAL VIDEO durations (not voiceover TTS durations).
  // Sound effects must sync to what's ON SCREEN, not when the narrator speaks.
  // Priority: sceneVideoDurations (measured) > sceneAudioDurations (voiceover) > plan duration
  const sceneOffsets: Record<number, number> = {};
  const sceneDurations: Record<number, number> = {};
  let offsetMs = 0;
  const sortedScenes = [...plan.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  for (const scene of sortedScenes) {
    sceneOffsets[scene.sceneNumber] = offsetMs;
    const videoDuration = state.sceneVideoDurations?.[scene.sceneNumber];
    const voDuration = state.sceneAudioDurations?.[scene.sceneNumber];
    const duration = videoDuration || voDuration || (scene.duration * 1000);
    sceneDurations[scene.sceneNumber] = duration;
    offsetMs += duration;
  }

  const ambient: Array<{ url: string; startMs: number; durationMs: number }> = [];
  const sfx: Array<{ url: string; startMs: number; durationMs: number }> = [];
  const foley: Array<{ url: string; startMs: number; durationMs: number }> = [];

  for (const assets of state.soundAssets) {
    const sceneStartMs = sceneOffsets[assets.sceneNumber] ?? 0;

    // Scene's actual duration for clamping timestamps
    const sceneMs = sceneDurations[assets.sceneNumber] || 5000;

    // Ambient — plays at scene start for the FULL scene video duration
    if (assets.ambientUrl) {
      ambient.push({
        url: await resolveAudioUrl(assets.ambientUrl),
        startMs: sceneStartMs,
        durationMs: sceneMs, // Match actual video duration, not generated audio length
      });
    }

    // SFX — placed at scene offset + clip timestamp, clamped to scene bounds
    for (const clip of assets.sfxClips) {
      const clampedTimestamp = Math.min(clip.timestampMs, Math.max(0, sceneMs - 500));
      sfx.push({
        url: await resolveAudioUrl(clip.url),
        startMs: sceneStartMs + clampedTimestamp,
        durationMs: Math.min(clip.durationMs, sceneMs - clampedTimestamp),
      });
    }

    // Foley — placed at scene offset + clip timestamp, clamped to scene bounds
    for (const clip of assets.foleyClips) {
      const clampedTimestamp = Math.min(clip.timestampMs, Math.max(0, sceneMs - 500));
      foley.push({
        url: await resolveAudioUrl(clip.url),
        startMs: sceneStartMs + clampedTimestamp,
        durationMs: Math.min(clip.durationMs, sceneMs - clampedTimestamp),
      });
    }
  }

  const total = ambient.length + sfx.length + foley.length;
  if (total === 0) return null;

  console.log(`[ASSEMBLY] Sound design: ${ambient.length} ambient, ${sfx.length} SFX, ${foley.length} foley clips`);
  return { ambient, sfx, foley };
}

// ---- PHASE: SOUND PREMIX — Compose all SFX into one quiet audio bed ----
// The FAL compose API does NOT support per-track volume control.
// So we: (1) compose all sound clips into ONE audio track, (2) loudnorm it to -35 LUFS
// This produces a single quiet "sound bed" that sits far below the voiceover.

async function pollSoundPremixPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // Step 1: Compose all sound design clips into a single audio track
  if (!state.soundPremixJob) {
    try {
      const soundDesignClips = await buildSoundDesignClips(state, production);
      if (!soundDesignClips) {
        // No sound clips — skip to mix_final
        state.phase = "mix_final";
        return true;
      }

      // Get total duration from concat video
      const totalDurationMs = state.concatDurationMs || 30000;

      // Build tracks for audio-only compose (no video track)
      const tracks: Array<{ id: string; type: string; keyframes: Array<{ timestamp: number; duration: number; url: string }> }> = [];

      // Add a silent video placeholder — compose requires at least one video track
      // Use the concat video but we only care about the audio output
      if (state.concatJob?.videoUrl) {
        tracks.push({
          id: "video-silent",
          type: "video",
          keyframes: [{ timestamp: 0, duration: totalDurationMs, url: state.concatJob.videoUrl }],
        });
      }

      if (soundDesignClips.ambient.length > 0) {
        tracks.push({
          id: "audio-ambient",
          type: "audio",
          keyframes: soundDesignClips.ambient.map((c) => ({
            timestamp: c.startMs,
            duration: c.durationMs,
            url: c.url,
          })),
        });
      }

      if (soundDesignClips.sfx.length > 0) {
        tracks.push({
          id: "audio-sfx",
          type: "audio",
          keyframes: soundDesignClips.sfx.map((c) => ({
            timestamp: c.startMs,
            duration: c.durationMs,
            url: c.url,
          })),
        });
      }

      if (soundDesignClips.foley.length > 0) {
        tracks.push({
          id: "audio-foley",
          type: "audio",
          keyframes: soundDesignClips.foley.map((c) => ({
            timestamp: c.startMs,
            duration: c.durationMs,
            url: c.url,
          })),
        });
      }

      const totalClips = (soundDesignClips.ambient.length + soundDesignClips.sfx.length + soundDesignClips.foley.length);
      console.log(`[ASSEMBLY] Sound premix: composing ${totalClips} clips into one audio bed...`);

      const result = await fal.queue.submit("fal-ai/ffmpeg-api/compose", {
        input: { tracks },
      });

      state.soundPremixJob = { requestId: result.request_id, status: "IN_QUEUE", phase: "compose" };
      console.log(`[ASSEMBLY] Sound premix compose submitted: ${result.request_id}`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Sound premix compose failed, skipping sound design:`, err);
      state.soundPremixJob = { requestId: "skip", status: "FAILED", phase: "compose" };
      state.phase = "mix_final";
    }
    return true;
  }

  // Step 1b: Poll compose job
  if (state.soundPremixJob.phase === "compose" && state.soundPremixJob.status !== "COMPLETED" && state.soundPremixJob.status !== "FAILED") {
    try {
      const result = await checkFalQueueStatus("fal-ai/ffmpeg-api", state.soundPremixJob.requestId);
      if (result.status === "COMPLETED") {
        const data = await getFalQueueResult("fal-ai/ffmpeg-api", state.soundPremixJob.requestId);
        const videoUrl = (data?.video_url as string) || (data?.video as { url: string })?.url || "";
        if (videoUrl) {
          // Compose returned a video with the mixed sound design audio.
          // Now loudnorm the audio to -35 LUFS (very quiet background level).
          state.soundPremixJob.status = "COMPLETED";
          state.soundPremixJob.audioUrl = videoUrl; // This is actually a video — we extract audio via loudnorm
          console.log(`[ASSEMBLY] Sound premix composed: ${videoUrl}`);

          // Step 2: Loudnorm to -35 LUFS — very quiet, well below voiceover (-14 LUFS) and music (-28 LUFS)
          try {
            const { requestId } = await submitLoudnormJob(videoUrl, -35);
            state.soundPremixJob.phase = "loudnorm";
            state.soundPremixJob.status = "IN_QUEUE";
            state.soundPremixLoudnormId = requestId;
            console.log(`[ASSEMBLY] Sound premix loudnorm submitted: ${requestId} (target: -35 LUFS)`);
          } catch (err) {
            console.warn(`[ASSEMBLY] Sound premix loudnorm failed, skipping sound design:`, err);
            state.soundPremixJob.audioUrl = undefined;
            state.phase = "mix_final";
          }
        } else {
          state.soundPremixJob.status = "FAILED";
          state.phase = "mix_final";
        }
      } else if (result.status === "FAILED") {
        console.warn(`[ASSEMBLY] Sound premix compose failed`);
        state.soundPremixJob.status = "FAILED";
        state.phase = "mix_final";
      } else {
        return false; // Still composing
      }
    } catch (err) {
      console.warn(`[ASSEMBLY] Sound premix poll error:`, err);
      state.soundPremixJob.status = "FAILED";
      state.phase = "mix_final";
    }
    return true;
  }

  // Step 2b: Poll loudnorm job
  if (state.soundPremixJob.phase === "loudnorm" && state.soundPremixJob.status !== "COMPLETED" && state.soundPremixJob.status !== "FAILED") {
    const requestId = state.soundPremixLoudnormId || state.soundPremixJob.requestId;
    try {
      const result = await checkFalQueueStatus("fal-ai/ffmpeg-api", requestId);
      if (result.status === "COMPLETED") {
        const data = await getFalQueueResult("fal-ai/ffmpeg-api", requestId);
        const audio = data?.audio as { url: string } | undefined;
        state.soundPremixJob.status = "COMPLETED";
        state.soundPremixJob.audioUrl = audio?.url || "";
        console.log(`[ASSEMBLY] Sound premix loudnormed to -35 LUFS: ${state.soundPremixJob.audioUrl}`);
        state.phase = "mix_final";
      } else if (result.status === "FAILED") {
        console.warn(`[ASSEMBLY] Sound premix loudnorm failed, skipping sound design`);
        state.soundPremixJob.status = "FAILED";
        state.soundPremixJob.audioUrl = undefined;
        state.phase = "mix_final";
      } else {
        return false; // Still normalizing
      }
    } catch (err) {
      console.warn(`[ASSEMBLY] Sound premix loudnorm poll error:`, err);
      state.soundPremixJob.status = "FAILED";
      state.soundPremixJob.audioUrl = undefined;
      state.phase = "mix_final";
    }
    return true;
  }

  // If we get here, premix is done (or failed) — move to mix_final
  state.phase = "mix_final";
  return true;
}

async function pollMixFinalPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // Use fal-ai/ffmpeg-api/compose to layer video + voiceover + music in one call.
  // This replaces merge-audio-video which can only add ONE audio track.
  // compose natively supports multiple audio tracks layered simultaneously.

  if (!state.mixFinalJob) {
    const videoUrl = state.concatJob?.videoUrl;
    if (!videoUrl) {
      state.phase = "done";
      return true;
    }

    // ── Measure ACTUAL video scene durations for proper audio alignment ──
    // Sound effects and voiceover must sync to the VIDEO (what you see),
    // not voiceover TTS durations (which differ from video clip lengths).
    if (!state.sceneVideoDurations) {
      const freshScenes = await getProductionScenes(productionId);
      const completedScenes = freshScenes
        .filter((s) => s.status === "completed")
        .sort((a, b) => a.sceneNumber - b.sceneNumber);

      state.sceneVideoDurations = {};
      const crossfadeSec = state.transitionType === "crossfade" ? 0.5 : 0;

      for (let i = 0; i < completedScenes.length; i++) {
        const sceneUrl = state.processedSceneUrls[i];
        if (sceneUrl) {
          const durSec = await getMediaDuration(sceneUrl);
          // Effective duration in concat = clip duration minus crossfade overlap (except last scene)
          const effectiveSec = durSec > 0
            ? durSec - (i < completedScenes.length - 1 ? crossfadeSec : 0)
            : 5;
          state.sceneVideoDurations[completedScenes[i].sceneNumber] = Math.round(effectiveSec * 1000);
          console.log(`[ASSEMBLY] Scene ${completedScenes[i].sceneNumber} actual video: ${effectiveSec.toFixed(1)}s`);
        }
      }
      console.log(`[ASSEMBLY] Measured ${Object.keys(state.sceneVideoDurations).length} actual video durations for audio alignment`);
    }

    // Recalculate voiceover timestamps to match ACTUAL video scene boundaries
    // (not voiceover TTS durations — those don't match the video)
    if (state.voiceoverClips?.length && state.sceneVideoDurations) {
      recalculateTimestampsFromVideoDurations(state);
    }

    const voiceoverUrl = production.voiceoverUrl;
    // Use loudnorm-processed music if available, else original music
    const musicUrl = state.composeAudioJob?.audioUrl || production.musicUrl;

    // Check for per-scene voiceover clips stored during orchestration
    const voiceoverClips = state.voiceoverClips;

    // Use pre-mixed + loudnormed sound design bed (from sound_premix phase)
    // This is a single quiet audio track at -35 LUFS — sits far below voiceover
    const soundBedUrl = state.soundPremixJob?.status === "COMPLETED" ? state.soundPremixJob.audioUrl : undefined;
    if (soundBedUrl) {
      console.log(`[ASSEMBLY] Using pre-mixed sound bed at -35 LUFS: ${soundBedUrl}`);
    }

    if (!voiceoverUrl && !voiceoverClips?.length && !musicUrl && !soundBedUrl) {
      // No audio to add — video is already done
      state.phase = "done";
      return true;
    }

    // Determine output duration = CONCAT VIDEO LENGTH.
    // We use ALL generated video clips — no cutting. Voiceover plays naturally
    // over the visuals; when narration ends, the remaining clips play with
    // just music/ambient. This keeps every scene the user paid for.
    let totalDurationMs: number;

    let realDurationSec = await getMediaDuration(videoUrl);
    if (realDurationSec <= 0) {
      console.log(`[ASSEMBLY] First duration check returned 0, retrying...`);
      realDurationSec = await getMediaDuration(videoUrl);
    }
    if (realDurationSec <= 0) {
      // Fallback: measure individual scene videos
      console.log(`[ASSEMBLY] Metadata failed, measuring individual scene videos...`);
      const freshScenes = await getProductionScenes(productionId);
      const completedScenes = freshScenes
        .filter((s) => s.status === "completed")
        .sort((a, b) => a.sceneNumber - b.sceneNumber);
      let sumFromScenes = 0;
      for (let i = 0; i < completedScenes.length; i++) {
        const sceneUrl = state.processedSceneUrls[i];
        if (sceneUrl) {
          const sceneDur = await getMediaDuration(sceneUrl);
          if (sceneDur > 0) {
            sumFromScenes += sceneDur;
            continue;
          }
        }
        const planData = production.plan;
        const sceneDef = planData?.scenes?.find(
          (sd: { sceneNumber: number; duration?: number }) => sd.sceneNumber === completedScenes[i].sceneNumber
        );
        sumFromScenes += sceneDef?.duration || 8;
      }
      realDurationSec = sumFromScenes;
      console.log(`[ASSEMBLY] Duration from scene measurement: ${realDurationSec}s`);
    }
    totalDurationMs = Math.ceil(realDurationSec * 1000);
    // Store concat duration for trim phase (trim music padding, not video)
    state.concatDurationMs = totalDurationMs;
    console.log(`[ASSEMBLY] Output duration: ${(totalDurationMs / 1000).toFixed(1)}s (all ${state.processedSceneUrls.filter(u=>u).length} clips preserved)`);

    // Get music duration so we can loop it if it's shorter than the video
    let musicDurationMs: number | undefined;
    if (musicUrl) {
      const musicDurSec = await getMediaDuration(musicUrl);
      if (musicDurSec > 0) {
        musicDurationMs = Math.ceil(musicDurSec * 1000);
        console.log(`[ASSEMBLY] Music duration: ${musicDurSec}s (${musicDurationMs}ms) — video: ${(totalDurationMs/1000).toFixed(1)}s`);
      }
    }

    // Always use compose — it preserves video length and layers audio correctly.
    // merge-audio-video truncates video to audio length which is a bug.
    // Per-scene voiceover clips are placed at each scene's timestamp for full coverage.
    // Sound design is passed as a single pre-mixed+loudnormed URL (not raw clips).
    try {
      const { requestId } = await submitComposeVideoJob(
        videoUrl,
        voiceoverClips?.length ? undefined : (voiceoverUrl || undefined), // Skip single URL if we have per-scene clips
        musicUrl || undefined,
        totalDurationMs,
        musicDurationMs,
        voiceoverClips?.length ? voiceoverClips : undefined,
        undefined, // No raw sound design clips — use pre-mixed bed instead
        soundBedUrl // Pre-mixed + loudnormed sound bed at -35 LUFS
      );
      state.mixFinalJob = { requestId, status: "IN_QUEUE" };
      const voDesc = voiceoverClips?.length ? `${voiceoverClips.length} VO clips` : (voiceoverUrl ? "voiceover" : "");
      const audioDesc = [voDesc, musicUrl ? "music(-28 LUFS)" : "", soundBedUrl ? "sound-bed(-35 LUFS)" : ""].filter(Boolean).join(" + ");
      console.log(`[ASSEMBLY] Compose-final submitted: ${requestId} (video + ${audioDesc}, ${(totalDurationMs/1000).toFixed(1)}s)`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Compose-final failed, using video without audio:`, err);
      state.phase = "done";
    }
    return true;
  }

  // Poll mix-final compose job
  if (state.mixFinalJob.status !== "COMPLETED" && state.mixFinalJob.status !== "FAILED") {
    try {
      const statusResult = await checkFalQueueStatus("fal-ai/ffmpeg-api", state.mixFinalJob.requestId);

      if (statusResult.status === "COMPLETED") {
        try {
          const data = await getFalQueueResult("fal-ai/ffmpeg-api", state.mixFinalJob.requestId);
          // compose returns video_url at top level
          const videoUrl = (data?.video_url as string) ||
                          (data?.video as { url: string })?.url ||
                          "";
          state.mixFinalJob.status = "COMPLETED";
          state.mixFinalJob.videoUrl = videoUrl || state.concatJob?.videoUrl;
          console.log(`[ASSEMBLY] Compose-final completed: ${state.mixFinalJob.videoUrl}`);
        } catch (resultErr) {
          console.warn(`[ASSEMBLY] Compose-final result retrieval failed, using concat video:`, resultErr);
          state.mixFinalJob.status = "FAILED";
          state.mixFinalJob.videoUrl = state.concatJob?.videoUrl;
        }
      } else if (statusResult.status === "FAILED") {
        state.mixFinalJob.status = "FAILED";
        state.mixFinalJob.videoUrl = state.concatJob?.videoUrl;
        console.warn(`[ASSEMBLY] Compose-final failed, using video without audio overlay`);
      } else {
        return false; // Still in progress
      }
    } catch (pollErr) {
      console.warn(`[ASSEMBLY] Compose-final status check failed, using concat video:`, pollErr);
      state.mixFinalJob.status = "FAILED";
      state.mixFinalJob.videoUrl = state.concatJob?.videoUrl;
    }
  }

  // Skip normalize phase — loudnorm strips the video stream (returns audio-only),
  // causing black video output. Audio levels are already correct:
  // - Music normalized to -28 LUFS in compose_audio phase
  // - Voiceover at natural TTS level (~-14 LUFS)
  // - Compose mixes them properly

  // Generate word-level subtitles from voiceover clips (if available)
  if (state.voiceoverClips?.length && !state.subtitleData) {
    try {
      const subtitles = await generateWordLevelSubtitles(
        state.voiceoverClips.map((c) => ({ ...c, sceneNumber: c.sceneNumber || 0 }))
      );
      if (subtitles.length > 0) {
        state.subtitleData = subtitles;
        console.log(`[ASSEMBLY] Word-level subtitles generated: ${subtitles.length} entries`);
      }
    } catch (err) {
      console.warn(`[ASSEMBLY] Subtitle generation failed (non-critical):`, err);
    }
  }

  // Trim if compose output is longer than the actual concat video
  // (compose extends to the longest audio track, e.g. 30s music).
  // We want exactly concat length — all video clips, nothing more.
  if (state.concatDurationMs && state.concatDurationMs > 0) {
    state.phase = "trim_final";
    await updateProduction(productionId, { progress: 94 });
    console.log(`[ASSEMBLY] Mix-final done → trim_final (trim to ${(state.concatDurationMs / 1000).toFixed(1)}s — all clips preserved)`);
  } else if (production.captions && production.voiceover) {
    // No trim needed but captions requested — go straight to burn
    state.phase = "burn_captions";
    await updateProduction(productionId, { progress: 96 });
    console.log(`[ASSEMBLY] Mix-final done → burn_captions (no trim, captions enabled)`);
  } else {
    state.phase = "done";
    await updateProduction(productionId, { progress: 98 });
    console.log(`[ASSEMBLY] Mix-final done → done (no trim needed)`);
  }
  return true;
}

// ---- PHASE 5.5: TRIM FINAL — Trim output to voiceover duration ----

async function pollTrimFinalPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // Trim to concat video duration — this cuts music padding while keeping ALL video clips.
  // Voiceover plays naturally; if shorter than video, remaining clips have music/ambient only.
  const targetSec = (state.concatDurationMs || 0) / 1000;

  const videoUrl = state.mixFinalJob?.videoUrl || state.concatJob?.videoUrl;

  if (!videoUrl || targetSec <= 1) {
    state.phase = "done";
    return true;
  }

  // Submit trim job if not yet started
  if (!state.trimFinalJob) {
    try {
      const { requestId } = await submitTrimVideoJob(videoUrl, targetSec);
      state.trimFinalJob = { requestId, status: "IN_QUEUE" };
      console.log(`[ASSEMBLY] Trim submitted: ${requestId} (target: ${targetSec.toFixed(1)}s)`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Trim submit failed, using untrimmed video:`, err);
      state.phase = "done";
    }
    return true;
  }

  // Poll trim job
  if (state.trimFinalJob.status !== "COMPLETED" && state.trimFinalJob.status !== "FAILED") {
    try {
      const result = await checkFalQueueStatus(
        "fal-ai/workflow-utilities/trim-video",
        state.trimFinalJob.requestId
      );

      if (result.status === "COMPLETED") {
        const data = await getFalQueueResult(
          "fal-ai/workflow-utilities/trim-video",
          state.trimFinalJob.requestId
        );
        const trimmedUrl = (data?.video as { url: string })?.url ||
                           (data?.video_url as string) || "";
        state.trimFinalJob.status = "COMPLETED";
        state.trimFinalJob.videoUrl = trimmedUrl || videoUrl;
        const trimmedDuration = (data?.trimmed_duration as number) || targetSec;
        console.log(`[ASSEMBLY] Trim completed: ${trimmedDuration.toFixed(1)}s → ${state.trimFinalJob.videoUrl?.slice(0, 60)}...`);
      } else if (result.status === "FAILED") {
        state.trimFinalJob.status = "FAILED";
        state.trimFinalJob.videoUrl = videoUrl; // Use untrimmed as fallback
        console.warn(`[ASSEMBLY] Trim failed, using untrimmed video`);
      } else {
        return false; // Still in progress
      }
    } catch (err) {
      console.warn(`[ASSEMBLY] Trim poll error, using untrimmed:`, err);
      state.trimFinalJob.status = "FAILED";
      state.trimFinalJob.videoUrl = videoUrl;
    }
  }

  // If captions are enabled and we have voiceover (audio to transcribe), burn captions
  if (production.captions && production.voiceover) {
    state.phase = "burn_captions";
    await updateProduction(productionId, { progress: 96 });
    console.log(`[ASSEMBLY] Trim done → burn_captions (captions enabled)`);
  } else {
    state.phase = "done";
    await updateProduction(productionId, { progress: 98 });
    console.log(`[ASSEMBLY] Trim done → done`);
  }
  return true;
}

// ---- PHASE 6: BURN CAPTIONS — Burn styled subtitles into the final video ----

async function pollBurnCaptionsPhase(
  productionId: string,
  state: AssemblyState
): Promise<boolean> {
  // Get the best available video URL (priority: trim > mix_final > concat)
  const videoUrl = state.trimFinalJob?.videoUrl || state.mixFinalJob?.videoUrl || state.concatJob?.videoUrl;

  if (!videoUrl) {
    console.warn(`[ASSEMBLY] No video URL for caption burn, skipping`);
    state.phase = "done";
    return true;
  }

  // Submit burn job if not yet started
  if (!state.burnCaptionsJob) {
    try {
      const result = await fal.queue.submit("fal-ai/workflow-utilities/auto-subtitle", {
        input: {
          video_url: videoUrl,
          // Cinematic style — elegant, professional look for Brain Studio productions
          font: "Montserrat/Montserrat-ExtraBold.ttf",
          font_size: 80,
          font_color: "white",
          stroke_color: "black",
          stroke_width: 4,
          highlight_color: "yellow",
          caption_position: "bottom",
          bounce: false,
        } as Record<string, unknown> & { video_url: string },
      });

      state.burnCaptionsJob = { requestId: result.request_id, status: "IN_QUEUE" };
      console.log(`[ASSEMBLY] Caption burn submitted: ${result.request_id}`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Caption burn submit failed, skipping:`, err);
      state.phase = "done";
    }
    return true;
  }

  // Poll burn job
  if (state.burnCaptionsJob.status !== "COMPLETED" && state.burnCaptionsJob.status !== "FAILED") {
    try {
      const result = await checkFalQueueStatus(
        "fal-ai/workflow-utilities/auto-subtitle",
        state.burnCaptionsJob.requestId
      );

      if (result.status === "COMPLETED") {
        const data = await getFalQueueResult(
          "fal-ai/workflow-utilities/auto-subtitle",
          state.burnCaptionsJob.requestId
        );
        const burnedUrl = (data?.video as { url: string })?.url || "";
        state.burnCaptionsJob.status = "COMPLETED";
        state.burnCaptionsJob.videoUrl = burnedUrl || videoUrl;
        console.log(`[ASSEMBLY] Caption burn completed: ${state.burnCaptionsJob.videoUrl?.slice(0, 60)}...`);
      } else if (result.status === "FAILED") {
        state.burnCaptionsJob.status = "FAILED";
        state.burnCaptionsJob.videoUrl = videoUrl; // Fall back to original
        console.warn(`[ASSEMBLY] Caption burn failed, using video without captions`);
      } else {
        return false; // Still in progress
      }
    } catch (err) {
      console.warn(`[ASSEMBLY] Caption burn poll error, skipping:`, err);
      state.burnCaptionsJob.status = "FAILED";
      state.burnCaptionsJob.videoUrl = videoUrl;
    }
  }

  state.phase = "done";
  await updateProduction(productionId, { progress: 98 });
  console.log(`[ASSEMBLY] Caption burn done → done`);
  return true;
}

// NOTE: pollNormalizePhase has been REMOVED.
// The loudnorm endpoint strips video streams (sends audio_url, gets audio-only back),
// causing black video output. Audio levels are already correct from compose_audio + compose.
// Any in-flight productions stuck in "normalize" phase are handled by the switch fallback.

// ---- FINALIZE — Write output + create gallery record ----

async function finalizeAssembly(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<void> {
  // Determine final video source URL — priority: burn_captions > trim > mix_final > concat > first scene
  const sourceUrl = state.burnCaptionsJob?.videoUrl || state.trimFinalJob?.videoUrl || state.mixFinalJob?.videoUrl || state.concatJob?.videoUrl || state.processedSceneUrls[0];

  if (!sourceUrl) {
    await failAssembly(productionId, "Assembly produced no output video");
    return;
  }

  // Build scene URL map
  const freshScenes = await getProductionScenes(productionId);
  const completedScenes = freshScenes
    .filter((s) => s.status === "completed" && s.outputVideoUrl)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  const sceneUrlMap: Record<string, string> = {};
  completedScenes.forEach((s, i) => {
    sceneUrlMap[`scene_${s.sceneNumber}`] = state.processedSceneUrls[i] || s.outputVideoUrl!;
  });

  // --- PERSIST FINAL VIDEO TO R2 (FAL URLs expire) ---
  const videoId = randomUUID();
  const vKey = videoStorageKey(production.userId, videoId);
  let videoApiUrl = `/api/videos/${videoId}`;
  let fileSize = 0;

  try {
    console.log(`[ASSEMBLY] Downloading final video from FAL to R2: ${sourceUrl.slice(0, 80)}...`);
    const videoRes = await fetch(sourceUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download final video: ${videoRes.status}`);
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fileSize = videoBuffer.length;
    await uploadVideo(vKey, videoBuffer);
    await verifyR2Upload(vKey);
    console.log(`[ASSEMBLY] Final video persisted to R2: ${vKey} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  } catch (storageErr) {
    console.error(`[ASSEMBLY] R2 upload failed, falling back to FAL URL:`, storageErr);
    // Fall back to source URL — not ideal but better than losing the video entirely
    videoApiUrl = sourceUrl;
  }

  sceneUrlMap["final"] = videoApiUrl;

  // --- EXTRACT THUMBNAIL ---
  let finalThumbnail = "";
  try {
    if (videoApiUrl.startsWith("/api/videos/")) {
      // Video is in R2 — use the R2 key for thumbnail extraction
      finalThumbnail = await extractAndUploadThumbnail(vKey, production.userId, videoId);
    } else {
      // Fallback to URL-based extraction
      finalThumbnail = await extractThumbnailFromUrl(sourceUrl, production.userId, videoId);
    }
  } catch {
    console.warn(`[ASSEMBLY] Thumbnail extraction failed, using empty`);
  }

  // --- ALWAYS SAVE TO GALLERY ---
  const plan = production.plan;
  // Use concat duration (all clips combined) — this is the actual video length
  let totalDuration: number;
  if (state.concatDurationMs && state.concatDurationMs > 0) {
    totalDuration = Math.ceil(state.concatDurationMs / 1000);
  } else {
    totalDuration = completedScenes.reduce((sum, s) => {
      const sceneDef = plan?.scenes?.find(
        (sd: { sceneNumber: number; duration?: number }) => sd.sceneNumber === s.sceneNumber
      );
      return sum + (sceneDef?.duration || 8);
    }, 0);
  }

  // Determine best model ID from scenes
  const sceneModels = completedScenes.map(s => s.modelId).filter(Boolean);
  const primaryModel = (sceneModels[0] || "wan-2.2") as ModelId;

  let galleryVideoId = videoId;
  let retries = 0;
  const MAX_GALLERY_RETRIES = 2;

  while (retries <= MAX_GALLERY_RETRIES) {
    try {
      await createVideo({
        id: galleryVideoId,
        userId: production.userId,
        jobId: null, // Brain productions don't have generation_jobs
        title: production.concept || "Brain Studio Production",
        url: videoApiUrl,
        thumbnailUrl: finalThumbnail,
        modelId: primaryModel,
        prompt: production.concept || "",
        resolution: "720p",
        duration: totalDuration,
        fps: 24,
        fileSize,
        aspectRatio: (production.aspectRatio || "landscape") as AspectRatio,
      });
      console.log(`[ASSEMBLY] ✅ Video saved to Gallery: ${galleryVideoId}`);
      break;
    } catch (videoErr) {
      retries++;
      if (retries > MAX_GALLERY_RETRIES) {
        console.error(`[ASSEMBLY] ❌ CRITICAL: Failed to save video to Gallery after ${MAX_GALLERY_RETRIES + 1} attempts:`, videoErr);
      } else {
        // Retry with a fresh UUID in case of ID collision
        galleryVideoId = randomUUID();
        console.warn(`[ASSEMBLY] Gallery save attempt ${retries} failed, retrying with new ID ${galleryVideoId}:`, videoErr);
      }
    }
  }

  // --- STORE SUBTITLE DATA (if generated) ---
  if (state.subtitleData && state.subtitleData.length > 0) {
    try {
      // Convert Whisper subtitle entries (start/end in seconds) to the format
      // the UI expects (startTime/endTime as numbers in seconds).
      // The UI parser handles both number and SRT-string formats.
      const normalizedEntries = state.subtitleData.map((entry) => ({
        startTime: entry.start,
        endTime: entry.end,
        text: entry.text,
      }));

      const srtContent = state.subtitleData.map((entry, i) => {
        const startTime = formatSrtTimestamp(entry.start);
        const endTime = formatSrtTimestamp(entry.end);
        return `${i + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`;
      }).join("\n");

      await updateProduction(productionId, {
        captions_url: JSON.stringify({
          srtContent,
          captionCount: normalizedEntries.length,
          entries: normalizedEntries,
          source: "whisper-word-level",
        }),
      });
      console.log(`[ASSEMBLY] ✅ Word-level subtitles saved: ${normalizedEntries.length} entries`);
    } catch (subtitleErr) {
      console.warn(`[ASSEMBLY] Failed to save subtitle data:`, subtitleErr);
    }
  }

  // --- MARK PRODUCTION COMPLETE ---
  await updateProduction(productionId, {
    status: "completed",
    output_video_urls: JSON.stringify(sceneUrlMap),
    thumbnail_url: finalThumbnail || undefined,
    progress: 100,
    completed_at: new Date().toISOString(),
  });

  console.log(`[ASSEMBLY] 🎬 Production ${productionId} COMPLETE — Gallery: ${galleryVideoId}, Thumbnail: ${finalThumbnail ? "yes" : "no"}`);
}

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

// ---- LEGACY COMPAT (keep old function signature, redirect to new) ----

/**
 * @deprecated Use startAssembly() + pollAssembly() instead
 */
export async function triggerBrainAssembly(
  productionId: string,
  _scenes?: Array<{ id: string; sceneNumber: number; status: string; outputVideoUrl?: string }>
): Promise<void> {
  // Redirect to new async assembly
  await startAssembly(productionId);
}
