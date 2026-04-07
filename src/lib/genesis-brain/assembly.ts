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
  checkFalQueueStatus,
  getFalQueueResult,
} from "./audio";
import { createSupabaseAdmin } from "@/lib/supabase";
import { createVideo } from "@/lib/db";
import { AI_MODELS } from "@/lib/constants";
import { ModelId, SoundDesign, AspectRatio, AssemblyState, Production } from "@/types";

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
      await updateProduction(productionId, {
        status: "failed",
        error_message: "No scene videos available for assembly",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    const production = await getProduction(productionId);
    const plan = production?.plan;
    const supabase = createSupabaseAdmin();

    // Build assembly state
    const state: AssemblyState = {
      phase: "mmaudio",
      mmaudioJobs: {},
      mergeJobs: {},
      processedSceneUrls: new Array(completedScenes.length).fill(""),
      sceneOrder: {},
      nativeAudioScenes: [],
    };

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
            sceneDef?.duration || 5
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
    await updateProduction(productionId, {
      status: "failed",
      error_message: `Assembly start failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      completed_at: new Date().toISOString(),
    });
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
      case "concat":
        updated = await pollConcatPhase(productionId, state, production);
        break;
      case "mix_voiceover":
        updated = await pollMixVoiceoverPhase(productionId, state, production);
        break;
      case "mix_music":
        updated = await pollMixMusicPhase(productionId, state, production);
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
    // Don't fail the production on a single poll error — it'll retry next poll
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

    state.phase = needsMerge ? "merge_audio" : "concat";
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

  // All merge jobs done → move to concat
  if (!anyPending && updated) {
    state.phase = "concat";
    await updateProduction(productionId, { progress: 84 });
    console.log(`[ASSEMBLY] Merge phase done → concat`);
  }

  return updated;
}

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
      await updateProduction(productionId, {
        status: "failed",
        error_message: "No valid scene URLs for concatenation",
        completed_at: new Date().toISOString(),
      });
      return false;
    }

    // Single scene — skip concat
    if (validUrls.length === 1) {
      state.concatJob = { requestId: "skip", status: "COMPLETED", videoUrl: validUrls[0] };
      console.log(`[ASSEMBLY] Single scene — skipping concat`);
    } else {
      try {
        const { requestId } = await submitMergeVideosJob(validUrls);
        state.concatJob = { requestId, status: "IN_QUEUE" };
        console.log(`[ASSEMBLY] Concat submitted: ${requestId} (${validUrls.length} scenes)`);
      } catch (err) {
        console.error(`[ASSEMBLY] Concat submit failed:`, err);
        // Fallback: use first scene
        state.concatJob = { requestId: "skip", status: "COMPLETED", videoUrl: validUrls[0] };
      }
    }
    return true;
  }

  // Poll concat job
  if (state.concatJob.status !== "COMPLETED" && state.concatJob.status !== "FAILED") {
    const result = await checkFalQueueStatus("fal-ai/ffmpeg-api/merge-videos", state.concatJob.requestId);

    if (result.status === "COMPLETED") {
      const data = await getFalQueueResult("fal-ai/ffmpeg-api/merge-videos", state.concatJob.requestId);
      const video = data?.video as { url: string } | undefined;
      state.concatJob.status = "COMPLETED";
      state.concatJob.videoUrl = video?.url || state.processedSceneUrls[0];
      console.log(`[ASSEMBLY] Concat completed: ${state.concatJob.videoUrl}`);
    } else if (result.status === "FAILED") {
      state.concatJob.status = "FAILED";
      state.concatJob.videoUrl = state.processedSceneUrls[0]; // fallback
      console.warn(`[ASSEMBLY] Concat failed, using first scene`);
    } else {
      return false; // Still in progress
    }
  }

  // Concat done — check if we need audio mixing (voiceover first, then music)
  if (production.voiceoverUrl && state.concatJob.videoUrl) {
    state.phase = "mix_voiceover";
    await updateProduction(productionId, { progress: 90 });
    console.log(`[ASSEMBLY] Concat done → mix_voiceover`);
  } else if (production.musicUrl && state.concatJob.videoUrl) {
    state.phase = "mix_music";
    await updateProduction(productionId, { progress: 92 });
    console.log(`[ASSEMBLY] Concat done → mix_music`);
  } else {
    state.phase = "done";
    await updateProduction(productionId, { progress: 98 });
    console.log(`[ASSEMBLY] Concat done → done (no audio mix needed)`);
  }

  return true;
}

async function pollMixVoiceoverPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // Submit voiceover mix job if not yet submitted
  if (!state.mixVoiceoverJob) {
    const audioUrl = production.voiceoverUrl;
    const videoUrl = state.concatJob?.videoUrl;
    if (!audioUrl || !videoUrl) {
      state.phase = "done";
      return true;
    }

    try {
      const { requestId } = await submitMergeAudioVideoJob(videoUrl, audioUrl);
      state.mixVoiceoverJob = { requestId, status: "IN_QUEUE" };
      console.log(`[ASSEMBLY] Mix-voiceover submitted: ${requestId}`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Mix-voiceover submit failed, using unmixed video:`, err);
      // If music exists, still try to mix that
      if (production.musicUrl) {
        state.phase = "mix_music";
      } else {
        state.phase = "done";
      }
    }
    return true;
  }

  // Poll voiceover mix job
  if (state.mixVoiceoverJob.status !== "COMPLETED" && state.mixVoiceoverJob.status !== "FAILED") {
    const result = await checkFalQueueStatus("fal-ai/ffmpeg-api/merge-audio-video", state.mixVoiceoverJob.requestId);

    if (result.status === "COMPLETED") {
      const data = await getFalQueueResult("fal-ai/ffmpeg-api/merge-audio-video", state.mixVoiceoverJob.requestId);
      const video = data?.video as { url: string } | undefined;
      state.mixVoiceoverJob.status = "COMPLETED";
      state.mixVoiceoverJob.videoUrl = video?.url || state.concatJob?.videoUrl;
      console.log(`[ASSEMBLY] Mix-voiceover completed: ${state.mixVoiceoverJob.videoUrl}`);
    } else if (result.status === "FAILED") {
      state.mixVoiceoverJob.status = "FAILED";
      state.mixVoiceoverJob.videoUrl = state.concatJob?.videoUrl; // fallback to unmixed
      console.warn(`[ASSEMBLY] Mix-voiceover failed, using unmixed`);
    } else {
      return false; // Still in progress
    }
  }

  // Voiceover done — check if music needs mixing too
  if (production.musicUrl) {
    state.phase = "mix_music";
    await updateProduction(productionId, { progress: 94 });
    console.log(`[ASSEMBLY] Mix-voiceover done → mix_music`);
  } else {
    state.phase = "done";
    await updateProduction(productionId, { progress: 98 });
    console.log(`[ASSEMBLY] Mix-voiceover done → done (no music)`);
  }
  return true;
}

async function pollMixMusicPhase(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<boolean> {
  // Submit music mix job if not yet submitted
  if (!state.mixMusicJob) {
    const audioUrl = production.musicUrl;
    const videoUrl = state.mixVoiceoverJob?.videoUrl || state.concatJob?.videoUrl;
    if (!audioUrl || !videoUrl) {
      state.phase = "done";
      return true;
    }

    try {
      const { requestId } = await submitMergeAudioVideoJob(videoUrl, audioUrl);
      state.mixMusicJob = { requestId, status: "IN_QUEUE" };
      console.log(`[ASSEMBLY] Mix-music submitted: ${requestId}`);
    } catch (err) {
      console.warn(`[ASSEMBLY] Mix-music submit failed, using video without music:`, err);
      state.phase = "done";
    }
    return true;
  }

  // Poll music mix job
  if (state.mixMusicJob.status !== "COMPLETED" && state.mixMusicJob.status !== "FAILED") {
    const result = await checkFalQueueStatus("fal-ai/ffmpeg-api/merge-audio-video", state.mixMusicJob.requestId);

    if (result.status === "COMPLETED") {
      const data = await getFalQueueResult("fal-ai/ffmpeg-api/merge-audio-video", state.mixMusicJob.requestId);
      const video = data?.video as { url: string } | undefined;
      state.mixMusicJob.status = "COMPLETED";
      state.mixMusicJob.videoUrl = video?.url || state.mixVoiceoverJob?.videoUrl || state.concatJob?.videoUrl;
      console.log(`[ASSEMBLY] Mix-music completed: ${state.mixMusicJob.videoUrl}`);
    } else if (result.status === "FAILED") {
      state.mixMusicJob.status = "FAILED";
      state.mixMusicJob.videoUrl = state.mixVoiceoverJob?.videoUrl || state.concatJob?.videoUrl; // fallback
      console.warn(`[ASSEMBLY] Mix-music failed, using video without music`);
    } else {
      return false; // Still in progress
    }
  }

  state.phase = "done";
  await updateProduction(productionId, { progress: 98 });
  return true;
}

// ---- FINALIZE — Write output + create gallery record ----

async function finalizeAssembly(
  productionId: string,
  state: AssemblyState,
  production: Production
): Promise<void> {
  // Determine final video URL
  const finalUrl = state.mixMusicJob?.videoUrl || state.mixVoiceoverJob?.videoUrl || state.concatJob?.videoUrl || state.processedSceneUrls[0];

  if (!finalUrl) {
    await updateProduction(productionId, {
      status: "failed",
      error_message: "Assembly produced no output video",
      completed_at: new Date().toISOString(),
    });
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
  sceneUrlMap["final"] = finalUrl;

  const finalThumbnail = completedScenes[0]?.outputVideoUrl || undefined;

  await updateProduction(productionId, {
    status: "completed",
    output_video_urls: JSON.stringify(sceneUrlMap),
    thumbnail_url: finalThumbnail,
    progress: 100,
    completed_at: new Date().toISOString(),
  });

  // Create Video record for Gallery
  try {
    const plan = production.plan;
    const totalDuration = completedScenes.reduce((sum, s) => {
      const sceneDef = plan?.scenes?.find(
        (sd: { sceneNumber: number; duration?: number }) => sd.sceneNumber === s.sceneNumber
      );
      return sum + (sceneDef?.duration || 5);
    }, 0);

    await createVideo({
      userId: production.userId,
      jobId: `brain-${productionId}`,
      title: production.concept || "Brain Studio Production",
      url: finalUrl,
      thumbnailUrl: finalThumbnail || "",
      modelId: "wan-2.2" as ModelId,
      prompt: production.concept || "",
      resolution: "720p",
      duration: totalDuration,
      fps: 24,
      fileSize: 0,
      aspectRatio: (production.aspectRatio || "landscape") as AspectRatio,
    });
    console.log(`[ASSEMBLY] Video record created for Gallery`);
  } catch (videoErr) {
    console.error(`[ASSEMBLY] Failed to create Video record:`, videoErr);
  }

  console.log(`[ASSEMBLY] Production ${productionId} COMPLETE`);
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
