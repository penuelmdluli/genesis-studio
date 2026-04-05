// ============================================
// GENESIS BRAIN — Cinematic Assembly Pipeline
// MMAudio V2 + FFmpeg Scene Concatenation
// ============================================

import {
  getProduction,
  updateProduction,
} from "./orchestrator";
import {
  generateVideoAudio,
  buildAudioPromptFromSoundDesign,
  mergeAudioOntoVideo,
  assembleScenes,
} from "./audio";
import { createSupabaseAdmin } from "@/lib/supabase";
import { AI_MODELS } from "@/lib/constants";
import { ModelId, SoundDesign } from "@/types";

/**
 * CINEMATIC ASSEMBLY PIPELINE
 *
 * 1. For each completed silent scene → run MMAudio V2 to generate synchronized audio
 * 2. Merge MMAudio onto silent videos via FFmpeg
 * 3. Concatenate all scenes (with audio) into a single video via FAL FFmpeg
 * 4. Mix in voiceover and music tracks
 * 5. Mark production as completed
 */
export async function triggerBrainAssembly(
  productionId: string,
  scenes: Array<{ id: string; sceneNumber: number; status: string; outputVideoUrl?: string }>
): Promise<void> {
  try {
    // Collect completed scene video URLs in order
    const completedScenes = scenes
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

    await updateProduction(productionId, { progress: 72 });

    // Get production data for plan (sound design info) and audio URLs
    const production = await getProduction(productionId);
    const plan = production?.plan;

    // --- Step 1: MMAudio for silent scenes ---
    console.log(`[BRAIN ASSEMBLY] Processing ${completedScenes.length} scenes for audio`);

    const processedSceneUrls: string[] = [];
    const supabase = createSupabaseAdmin();

    for (const scene of completedScenes) {
      // Check if this scene's model has native audio
      const { data: sceneRow } = await supabase
        .from("production_scenes")
        .select("model_id, provider, model_has_audio")
        .eq("id", scene.id)
        .single();

      const modelId = sceneRow?.model_id as ModelId | undefined;
      const model = modelId ? AI_MODELS[modelId] : null;
      const hasNativeAudio = sceneRow?.model_has_audio || model?.hasAudio || false;

      if (hasNativeAudio) {
        // Scene already has audio (Kling, Veo) — use as-is
        processedSceneUrls.push(scene.outputVideoUrl!);
        console.log(`[BRAIN ASSEMBLY] Scene ${scene.sceneNumber}: native audio (${modelId})`);
      } else {
        // Silent scene — generate audio with MMAudio V2
        const sceneDef = plan?.scenes?.find(
          (s: { sceneNumber: number }) => s.sceneNumber === scene.sceneNumber
        );
        const soundDesign = sceneDef?.soundDesign as SoundDesign | undefined;
        const audioPrompt = buildAudioPromptFromSoundDesign(soundDesign);

        console.log(`[BRAIN ASSEMBLY] Scene ${scene.sceneNumber}: generating MMAudio (${modelId})`);

        const audioResult = await generateVideoAudio(
          scene.outputVideoUrl!,
          audioPrompt,
          sceneDef?.duration || 5
        );

        if (audioResult.url) {
          // Merge audio onto the silent video
          const mergedUrl = await mergeAudioOntoVideo(scene.outputVideoUrl!, audioResult.url);
          processedSceneUrls.push(mergedUrl);
          console.log(`[BRAIN ASSEMBLY] Scene ${scene.sceneNumber}: MMAudio merged`);
        } else {
          // MMAudio failed — use silent video
          processedSceneUrls.push(scene.outputVideoUrl!);
          console.warn(`[BRAIN ASSEMBLY] Scene ${scene.sceneNumber}: MMAudio unavailable, using silent`);
        }
      }
    }

    await updateProduction(productionId, { progress: 85 });

    // --- Step 2: Assemble all scenes into final video ---
    console.log(`[BRAIN ASSEMBLY] Concatenating ${processedSceneUrls.length} scenes`);

    const { videoUrl: assembledUrl } = await assembleScenes(processedSceneUrls, {
      voiceoverUrl: production?.voiceoverUrl || undefined,
      musicUrl: production?.musicUrl || undefined,
    });

    await updateProduction(productionId, { progress: 95 });

    // --- Step 3: Store final output ---
    const sceneUrlMap: Record<string, string> = {};
    completedScenes.forEach((s, i) => {
      sceneUrlMap[`scene_${s.sceneNumber}`] = processedSceneUrls[i] || s.outputVideoUrl!;
    });
    sceneUrlMap["final"] = assembledUrl;

    await updateProduction(productionId, {
      status: "completed",
      output_video_urls: JSON.stringify(sceneUrlMap),
      thumbnail_url: completedScenes[0].outputVideoUrl!.replace(/\.mp4$/, "_thumb.jpg"),
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[BRAIN ASSEMBLY] Production ${productionId} COMPLETE — ${completedScenes.length} scenes assembled with audio`
    );
  } catch (err) {
    console.error(`[BRAIN ASSEMBLY] Error for ${productionId}:`, err);
    await updateProduction(productionId, {
      status: "failed",
      error_message: `Video assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      completed_at: new Date().toISOString(),
    });
  }
}
