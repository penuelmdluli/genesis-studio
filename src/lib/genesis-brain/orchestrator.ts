// ============================================
// GENESIS BRAIN — Production Orchestrator
// Coordinates the entire Brain pipeline
// ============================================

import { BrainInput, ScenePlan, Production, ProductionScene, ModelId, AssemblyState, SceneSoundAssets } from "@/types";
import { planProduction, calculateBrainCredits } from "./planner";
import { consistencyEngine } from "./consistency";
import { generateVoiceover, generatePerSceneVoiceover, selectMusic, generateCaptions, buildAudioPromptFromSoundDesign } from "./audio";
import { generateAllSceneSounds } from "./sound-effects";
import { submitRunPodJob, buildRunPodInput, getRunPodJobStatus } from "@/lib/runpod";
import { submitFalJob } from "@/lib/fal";
import { AI_MODELS } from "@/lib/constants";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * Create a new production record in the database
 */
export async function createProduction(
  userId: string,
  input: BrainInput,
  plan?: ScenePlan,
  totalCredits?: number
): Promise<Production> {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("productions")
    .insert({
      user_id: userId,
      status: plan ? "planned" : "planning",
      concept: input.concept,
      style: input.style,
      target_duration: input.targetDuration,
      aspect_ratio: input.aspectRatio,
      plan: plan ? JSON.stringify(plan) : null,
      voiceover: input.voiceover,
      music: input.music,
      captions: input.captions,
      total_credits: totalCredits || 0,
      progress: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create production: ${error.message}`);

  return mapProduction(data);
}

/**
 * Update production status and fields
 */
export async function updateProduction(
  productionId: string,
  updates: Partial<{
    status: string;
    plan: string;
    total_credits: number;
    output_video_urls: string;
    thumbnail_url: string;
    gif_preview_url: string;
    voiceover_url: string;
    music_url: string;
    captions_url: string;
    assembly_state: Record<string, unknown>;
    error_message: string;
    progress: number;
    started_at: string;
    completed_at: string;
  }>
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("productions")
    .update(updates)
    .eq("id", productionId);

  if (error) throw new Error(`Failed to update production: ${error.message}`);
}

/**
 * Get production by ID
 */
export async function getProduction(productionId: string): Promise<Production | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("productions")
    .select("*")
    .eq("id", productionId)
    .single();

  if (error || !data) return null;
  return mapProduction(data);
}

/**
 * Get user's production history
 */
export async function getUserProductions(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Production[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("productions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get productions: ${error.message}`);
  return (data || []).map(mapProduction);
}

/**
 * Create scene records for a production
 */
export async function createProductionScenes(
  productionId: string,
  plan: ScenePlan
): Promise<ProductionScene[]> {
  const supabase = createSupabaseAdmin();
  const records = plan.scenes.map((scene) => ({
    production_id: productionId,
    scene_number: scene.sceneNumber,
    status: "queued",
    prompt: scene.prompt,
    model_id: scene.modelId,
    duration: scene.duration,
    resolution: scene.resolution,
    progress: 0,
  }));

  const { data, error } = await supabase
    .from("production_scenes")
    .insert(records)
    .select();

  if (error) throw new Error(`Failed to create scenes: ${error.message}`);
  return (data || []).map(mapProductionScene);
}

/**
 * Update a scene's status
 */
export async function updateProductionScene(
  sceneId: string,
  updates: Partial<{
    status: string;
    output_video_url: string;
    runpod_job_id: string;
    gpu_time: number;
    error_message: string;
    progress: number;
  }>
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("production_scenes")
    .update(updates)
    .eq("id", sceneId);

  if (error) throw new Error(`Failed to update scene: ${error.message}`);
}

/**
 * Get all scenes for a production
 */
export async function getProductionScenes(productionId: string): Promise<ProductionScene[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("production_scenes")
    .select("*")
    .eq("production_id", productionId)
    .order("scene_number", { ascending: true });

  if (error) throw new Error(`Failed to get scenes: ${error.message}`);
  return (data || []).map(mapProductionScene);
}

/**
 * Execute the full Brain production pipeline
 */
export async function executeProduction(
  productionId: string,
  userId: string,
  clerkId: string,
  plan: ScenePlan,
  input: BrainInput
): Promise<void> {
  try {
    // Step 1: Apply consistency passes + Claude visual harmonization
    const enhancedPlan = await consistencyEngine.applyAllWithHarmonization(plan, input.brandKit);

    // Step 2: Calculate and deduct credits
    const totalCredits = calculateBrainCredits(enhancedPlan, input);
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success } = await deductCredits(
        userId,
        totalCredits,
        productionId,
        `Brain production: "${input.concept.slice(0, 50)}"`
      );
      if (!success) {
        await updateProduction(productionId, {
          status: "failed",
          error_message: "Insufficient credits",
        });
        throw new Error("Insufficient credits for Brain production");
      }
    }

    await updateProduction(productionId, {
      status: "generating",
      total_credits: totalCredits,
      plan: JSON.stringify(enhancedPlan),
      started_at: new Date().toISOString(),
      progress: 10,
    });

    // Step 3: Create scene records
    const scenes = await createProductionScenes(productionId, enhancedPlan);

    // Step 4: Submit all scenes FIRST (fast — just API calls, ~2-3s total)
    // This MUST happen before slow audio generation so scenes start rendering
    // even if the after() callback dies during TTS/music gen.
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/brain/webhook`;

    console.log(`[BRAIN] Submitting ${scenes.length} scenes to generation APIs...`);
    const sceneSubmissions = scenes.map(async (scene, i) => {
      const sceneDef = enhancedPlan.scenes[i];
      if (!sceneDef) return;

      const model = AI_MODELS[sceneDef.modelId];
      const isFalModel = model?.provider === "fal";

      // For audio models, enrich the prompt with sound design cues
      let scenePrompt = sceneDef.prompt;
      if (isFalModel && model?.hasAudio && sceneDef.soundDesign) {
        const audioDesc = buildAudioPromptFromSoundDesign(sceneDef.soundDesign);
        if (audioDesc && !scenePrompt.toLowerCase().includes("sound")) {
          scenePrompt = `${scenePrompt}. Audio: ${audioDesc}`;
        }
      }

      try {
        if (isFalModel) {
          const falResult = await submitFalJob({
            modelId: sceneDef.modelId,
            type: "t2v",
            prompt: scenePrompt,
            negativePrompt: sceneDef.negativePrompt,
            duration: sceneDef.duration,
            aspectRatio: input.aspectRatio,
            enableAudio: model?.hasAudio ?? false,
          });

          await updateProductionScene(scene.id, {
            status: "processing",
            runpod_job_id: falResult.request_id,
            progress: 10,
          });

          const supabase = createSupabaseAdmin();
          await supabase
            .from("production_scenes")
            .update({
              provider: "fal",
              model_has_audio: model?.hasAudio ?? false,
            })
            .eq("id", scene.id);
        } else {
          const runpodInput = buildRunPodInput({
            modelId: sceneDef.modelId,
            type: "t2v",
            prompt: scenePrompt,
            negativePrompt: sceneDef.negativePrompt,
            resolution: sceneDef.resolution,
            duration: sceneDef.duration,
            fps: 24,
            seed: undefined,
            guidanceScale: undefined,
            numInferenceSteps: undefined,
            isDraft: false,
            aspectRatio: input.aspectRatio,
          });

          const job = await submitRunPodJob(sceneDef.modelId, runpodInput, webhookUrl);

          await updateProductionScene(scene.id, {
            status: "processing",
            runpod_job_id: job.id,
            progress: 10,
          });
        }
      } catch (err) {
        await updateProductionScene(scene.id, {
          status: "failed",
          error_message: err instanceof Error ? err.message : "Submission failed",
        });
      }
    });

    // Wait for ALL scene submissions before moving to audio
    await Promise.allSettled(sceneSubmissions);
    console.log(`[BRAIN] All ${scenes.length} scenes submitted. Starting audio generation...`);
    await updateProduction(productionId, { progress: 20 });

    // Step 5: Generate audio assets (slow — TTS, music, SFX)
    // If after() dies here, scenes are already submitted and will complete.
    // Audio can be generated separately or skipped; video still works.
    const audioPromises: Promise<{ type: string; url: string; metadata?: Record<string, unknown> }>[] = [];

    // Extract voiceover script
    let voiceoverScript = enhancedPlan.voiceoverScript || "";
    if (input.voiceover) {
      const planAny = enhancedPlan as unknown as Record<string, unknown>;
      const voBlock = planAny.voiceover as { script?: Array<{ text?: string }> | string; enabled?: boolean } | undefined;
      if (voBlock?.script) {
        let altScript = "";
        if (typeof voBlock.script === "string") {
          altScript = voBlock.script;
        } else if (Array.isArray(voBlock.script)) {
          altScript = voBlock.script.map((s) => (typeof s === "string" ? s : s.text || "")).join(" ");
        }
        if (altScript.length > voiceoverScript.length) voiceoverScript = altScript;
      }
      const sceneLines = enhancedPlan.scenes
        .map((s) => s.voiceoverLine)
        .filter(Boolean)
        .join(" ");
      if (sceneLines.length > voiceoverScript.length) {
        console.log(`[BRAIN] Using per-scene voiceover lines (${sceneLines.split(" ").length} words) over voiceoverScript (${voiceoverScript.split(" ").length} words)`);
        voiceoverScript = sceneLines;
      }
    }

    let perSceneVoiceoverClips: Array<{ url: string; startMs: number; durationMs: number; sceneNumber: number; actualAudioDurationMs: number }> = [];
    let sceneAudioDurations: Record<number, number> = {};

    if (input.voiceover) {
      const scenesWithVO = enhancedPlan.scenes.filter((s) => s.voiceoverLine?.trim());
      if (scenesWithVO.length > 0) {
        console.log(`[BRAIN] Generating per-scene voiceover for ${scenesWithVO.length} scenes...`);
        audioPromises.push(
          generatePerSceneVoiceover(
            enhancedPlan.scenes,
            input.voiceoverLanguage || "en-US",
            input.voiceoverVoice
          ).then((result) => {
            perSceneVoiceoverClips = result.clips;
            sceneAudioDurations = result.sceneAudioDurations;
            return {
              type: "voiceover",
              url: result.fullUrl,
              duration: result.fullDuration,
              metadata: {
                perSceneClips: result.clips.map((c) => ({
                  url: c.url,
                  startMs: c.startMs,
                  durationMs: c.durationMs,
                  sceneNumber: c.sceneNumber,
                })),
                sceneAudioDurations,
              },
            };
          })
        );
      } else if (voiceoverScript) {
        console.log(`[BRAIN] Voiceover script (single): "${voiceoverScript.slice(0, 80)}..."`);
        audioPromises.push(
          generateVoiceover(
            voiceoverScript,
            input.voiceoverLanguage || "en-US",
            input.voiceoverVoice,
            enhancedPlan.voiceoverTimings
          )
        );
      } else {
        console.warn("[BRAIN] Voiceover requested but no script found in plan");
      }
    }

    if (input.music) {
      audioPromises.push(
        selectMusic(
          enhancedPlan.musicMood,
          enhancedPlan.musicTempo,
          enhancedPlan.totalDuration
        )
      );
    }

    // Step 5b: Hollywood Sound Design — generate ambient, SFX, foley for each scene
    let sceneSoundAssets: SceneSoundAssets[] = [];
    if (input.soundEffects) {
      console.log(`[BRAIN] Generating Hollywood Sound Design for ${enhancedPlan.scenes.length} scenes...`);
      try {
        sceneSoundAssets = await generateAllSceneSounds(enhancedPlan.scenes, userId);
        console.log(`[BRAIN] Sound Design complete: ${sceneSoundAssets.length} scenes with sound assets`);
      } catch (sfxErr) {
        console.error(`[BRAIN] Sound Design failed (non-fatal):`, sfxErr);
      }
    }

    // Wait for audio generation
    const audioResults = await Promise.allSettled(audioPromises);
    for (const result of audioResults) {
      if (result.status === "fulfilled") {
        const audio = result.value;
        if (audio.type === "voiceover") {
          if (audio.url) {
            console.log(`[BRAIN] Voiceover generated: ${audio.url.slice(0, 60)}...`);
            await updateProduction(productionId, { voiceover_url: audio.url });
          }
          const clips = audio.metadata?.perSceneClips as Array<{ url: string; startMs: number; durationMs: number }> | undefined;
          const audioDurations = audio.metadata?.sceneAudioDurations as Record<number, number> | undefined;
          if (clips && clips.length > 0) {
            console.log(`[BRAIN] Per-scene voiceover clips: ${clips.length} saved`);
            const defaultTransition = enhancedPlan.scenes[0]?.transitionOut || "crossfade";
            const assemblyPreState: Record<string, unknown> = {
              voiceoverClips: clips,
              sceneAudioDurations: audioDurations || {},
              transitionType: defaultTransition,
            };
            if (sceneSoundAssets.length > 0) {
              assemblyPreState.soundAssets = sceneSoundAssets;
              console.log(`[BRAIN] Sound assets stored: ${sceneSoundAssets.length} scenes`);
            }
            const supabase = createSupabaseAdmin();
            await supabase
              .from("productions")
              .update({ assembly_state: JSON.stringify(assemblyPreState) })
              .eq("id", productionId);
          }
        } else if (audio.type === "music" && audio.url) {
          console.log(`[BRAIN] Music generated: ${audio.url.slice(0, 60)}...`);
          await updateProduction(productionId, { music_url: audio.url });
        } else {
          console.warn(`[BRAIN] Audio result has empty URL: type=${audio.type}`);
        }
      } else {
        console.error(`[BRAIN] Audio generation FAILED:`, result.reason);
      }
    }

    // Generate captions
    if (input.captions && voiceoverScript) {
      const captionResult = generateCaptions(
        voiceoverScript,
        enhancedPlan.voiceoverTimings || []
      );
      await updateProduction(productionId, {
        captions_url: JSON.stringify(captionResult.metadata),
      });
    }

    await updateProduction(productionId, { progress: 30 });

    // Note: Scene completion is handled by the webhook handler
    // which will trigger assembly when all scenes are done

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Production failed";
    console.error(`[BRAIN] Production ${productionId} failed:`, errorMsg);

    await updateProduction(productionId, {
      status: "failed",
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });

    // Refund credits on failure
    try {
      const prod = await getProduction(productionId);
      if (prod && prod.totalCredits > 0) {
        await refundCredits(
          userId,
          prod.totalCredits,
          productionId,
          "Brain production failed — automatic refund"
        );
      }
    } catch {
      // Refund failure logged but not thrown
    }
  }
}

/**
 * Cancel a production and refund credits
 */
export async function cancelProduction(
  productionId: string,
  userId: string
): Promise<void> {
  const production = await getProduction(productionId);
  if (!production) throw new Error("Production not found");
  if (production.userId !== userId) throw new Error("Unauthorized");

  if (production.status === "completed" || production.status === "cancelled") {
    throw new Error("Cannot cancel a " + production.status + " production");
  }

  await updateProduction(productionId, {
    status: "cancelled",
    error_message: "Cancelled by user",
    completed_at: new Date().toISOString(),
  });

  // Refund credits
  if (production.totalCredits > 0) {
    await refundCredits(
      userId,
      production.totalCredits,
      productionId,
      "Brain production cancelled — credits refunded"
    );
  }
}

/**
 * Resubmit scenes that are stuck in "queued" with no job ID.
 * Called by the status polling endpoint when it detects orphaned scenes.
 * This handles the case where Vercel's after() callback dies mid-execution.
 */
export async function resubmitStuckScenes(
  productionId: string
): Promise<number> {
  const production = await getProduction(productionId);
  if (!production || !production.plan) return 0;

  const scenes = await getProductionScenes(productionId);
  const stuckScenes = scenes.filter(
    (s) => s.status === "queued" && !s.runpodJobId
  );

  if (stuckScenes.length === 0) return 0;

  // Check if scenes have been queued for at least 30 seconds
  const now = Date.now();
  const productionStarted = production.startedAt
    ? new Date(production.startedAt).getTime()
    : new Date(production.createdAt).getTime();
  const elapsedSec = (now - productionStarted) / 1000;
  if (elapsedSec < 30) return 0; // Give after() a chance to complete

  console.log(
    `[BRAIN RESUBMIT] ${stuckScenes.length} stuck scenes detected for production ${productionId} (${Math.round(elapsedSec)}s elapsed). Resubmitting...`
  );

  const plan = production.plan;
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/brain/webhook`;

  let submitted = 0;

  for (const scene of stuckScenes) {
    const sceneDef = plan.scenes.find(
      (s) => s.sceneNumber === scene.sceneNumber
    );
    if (!sceneDef) continue;

    const model = AI_MODELS[sceneDef.modelId];
    const isFalModel = model?.provider === "fal";

    // Build prompt (same logic as executeProduction)
    let scenePrompt = sceneDef.prompt;
    if (isFalModel && model?.hasAudio && sceneDef.soundDesign) {
      const audioDesc = buildAudioPromptFromSoundDesign(sceneDef.soundDesign);
      if (audioDesc && !scenePrompt.toLowerCase().includes("sound")) {
        scenePrompt = `${scenePrompt}. Audio: ${audioDesc}`;
      }
    }

    try {
      if (isFalModel) {
        const falResult = await submitFalJob({
          modelId: sceneDef.modelId,
          type: "t2v",
          prompt: scenePrompt,
          negativePrompt: sceneDef.negativePrompt,
          duration: sceneDef.duration,
          aspectRatio: production.aspectRatio,
          enableAudio: model?.hasAudio ?? false,
        });

        await updateProductionScene(scene.id, {
          status: "processing",
          runpod_job_id: falResult.request_id,
          progress: 10,
        });

        const supabase = createSupabaseAdmin();
        await supabase
          .from("production_scenes")
          .update({
            provider: "fal",
            model_has_audio: model?.hasAudio ?? false,
          })
          .eq("id", scene.id);
      } else {
        const runpodInput = buildRunPodInput({
          modelId: sceneDef.modelId,
          type: "t2v",
          prompt: scenePrompt,
          negativePrompt: sceneDef.negativePrompt,
          resolution: sceneDef.resolution,
          duration: sceneDef.duration,
          fps: 24,
          seed: undefined,
          guidanceScale: undefined,
          numInferenceSteps: undefined,
          isDraft: false,
          aspectRatio: production.aspectRatio,
        });

        const job = await submitRunPodJob(sceneDef.modelId, runpodInput, webhookUrl);

        await updateProductionScene(scene.id, {
          status: "processing",
          runpod_job_id: job.id,
          progress: 10,
        });
      }

      submitted++;
      console.log(
        `[BRAIN RESUBMIT] Scene ${scene.sceneNumber} resubmitted (${isFalModel ? "FAL" : "RunPod"})`
      );
    } catch (err) {
      console.error(
        `[BRAIN RESUBMIT] Scene ${scene.sceneNumber} resubmit failed:`,
        err
      );
      await updateProductionScene(scene.id, {
        status: "failed",
        error_message: `Resubmit failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  return submitted;
}

// ---- DB MAPPERS ----

function mapProduction(row: Record<string, unknown>): Production {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as Production["status"],
    concept: row.concept as string,
    style: row.style as Production["style"],
    targetDuration: row.target_duration as number,
    aspectRatio: row.aspect_ratio as Production["aspectRatio"],
    plan: row.plan ? (typeof row.plan === "string" ? JSON.parse(row.plan) : row.plan) : undefined,
    voiceover: row.voiceover as boolean,
    music: row.music as boolean,
    captions: row.captions as boolean,
    totalCredits: row.total_credits as number,
    outputVideoUrls: row.output_video_urls ? JSON.parse(row.output_video_urls as string) : undefined,
    thumbnailUrl: (row.thumbnail_url || undefined) as string | undefined,
    gifPreviewUrl: (row.gif_preview_url || undefined) as string | undefined,
    voiceoverUrl: (row.voiceover_url || undefined) as string | undefined,
    musicUrl: (row.music_url || undefined) as string | undefined,
    captionsUrl: (row.captions_url || undefined) as string | undefined,
    assemblyState: row.assembly_state ? (row.assembly_state as AssemblyState) : undefined,
    errorMessage: (row.error_message || undefined) as string | undefined,
    progress: (row.progress || 0) as number,
    createdAt: row.created_at as string,
    startedAt: (row.started_at || undefined) as string | undefined,
    completedAt: (row.completed_at || undefined) as string | undefined,
  };
}

function mapProductionScene(row: Record<string, unknown>): ProductionScene {
  return {
    id: row.id as string,
    productionId: row.production_id as string,
    sceneNumber: row.scene_number as number,
    status: row.status as ProductionScene["status"],
    prompt: row.prompt as string,
    modelId: row.model_id as ModelId,
    duration: row.duration as number,
    resolution: row.resolution as string,
    outputVideoUrl: (row.output_video_url || undefined) as string | undefined,
    runpodJobId: (row.runpod_job_id || undefined) as string | undefined,
    gpuTime: (row.gpu_time || undefined) as number | undefined,
    errorMessage: (row.error_message || undefined) as string | undefined,
    progress: (row.progress || 0) as number,
    createdAt: row.created_at as string,
  };
}
