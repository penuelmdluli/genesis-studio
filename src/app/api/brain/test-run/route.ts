import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { planProduction, calculateBrainCredits } from "@/lib/genesis-brain/planner";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import {
  createProduction,
  updateProduction,
  executeProduction,
  getProduction,
  getProductionScenes,
} from "@/lib/genesis-brain/orchestrator";
import { getFalJobStatus, getFalJobResult } from "@/lib/fal";
import { AI_MODELS } from "@/lib/constants";
import { BrainInput, ModelId } from "@/types";

/**
 * POST /api/brain/test-run
 *
 * TEMPORARY test endpoint for Brain Studio pipeline.
 * Requires TEST_SECRET header to prevent abuse.
 * Remove after debugging.
 */
export async function POST(req: NextRequest) {
  // Simple secret guard
  const secret = req.headers.get("x-test-secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    logs.push(`[${ts}] ${msg}`);
    console.log(`[BRAIN TEST] ${msg}`);
  };

  try {
    // Step 1: Get owner user ID from Supabase
    const supabase = createSupabaseAdmin();
    const ownerClerkId = (process.env.OWNER_CLERK_IDS || "").split(",")[0].trim();
    const { data: ownerUser } = await supabase
      .from("users")
      .select("id, name, plan, credit_balance")
      .eq("clerk_id", ownerClerkId)
      .single();

    if (!ownerUser) {
      return NextResponse.json({ error: "Owner user not found", logs }, { status: 404 });
    }
    log(`User: ${ownerUser.name} (${ownerUser.plan}, ${ownerUser.credit_balance} credits)`);

    // Step 2: Create a simple 15s test concept
    const input: BrainInput = {
      concept: "A cat sleeping peacefully on a sunny windowsill. The sunlight moves across the cat as clouds pass. Simple and calm.",
      targetDuration: 15,
      style: "cinematic",
      aspectRatio: "landscape",
      voiceover: false,
      music: false,
      captions: false,
    };
    log(`Concept: "${input.concept.slice(0, 60)}..."`);
    log(`Duration: ${input.targetDuration}s, Style: ${input.style}`);

    // Step 3: Plan production with Claude
    log("Planning with Claude...");
    const planStart = Date.now();
    let plan = await planProduction(input);
    plan = consistencyEngine.applyAll(plan);
    const planTime = Date.now() - planStart;
    log(`Plan complete in ${planTime}ms — ${plan.scenes.length} scenes`);

    for (const scene of plan.scenes) {
      log(`  Scene ${scene.sceneNumber}: ${scene.modelId} ${scene.duration}s — "${scene.prompt.slice(0, 50)}..."`);
    }

    const totalCredits = calculateBrainCredits(plan, input);
    log(`Total credits: ${totalCredits}`);

    // Step 4: Create production record
    const production = await createProduction(ownerUser.id, input, plan, totalCredits);
    log(`Production created: ${production.id}`);

    // Mark as planned so produce can run
    await updateProduction(production.id, {
      status: "planned",
      plan: JSON.stringify(plan),
      total_credits: totalCredits,
    });

    // Step 5: Execute production (this submits scenes to FAL/RunPod)
    log("Starting production execution...");
    await executeProduction(production.id, ownerUser.id, ownerClerkId, plan, input);
    log("executeProduction() returned — scenes submitted");

    // Step 6: Poll for completion
    log("Polling for scene completion...");
    const MAX_POLLS = 60; // 60 * 5s = 5 minutes max
    let pollCount = 0;
    let finalStatus = "generating";

    while (pollCount < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, 5000)); // 5s between polls
      pollCount++;

      const prod = await getProduction(production.id);
      const scenes = await getProductionScenes(production.id);

      // Check and update scene statuses (replicate status endpoint logic)
      for (const scene of scenes) {
        if (scene.status !== "processing" || !scene.runpodJobId) continue;

        const sceneModelId = scene.modelId as ModelId;
        const modelConfig = AI_MODELS[sceneModelId];
        const isFalScene = modelConfig?.provider === "fal";

        if (isFalScene) {
          try {
            const falStatus = await getFalJobStatus(sceneModelId, scene.runpodJobId);
            if (falStatus.status === "COMPLETED") {
              const result = await getFalJobResult(sceneModelId, scene.runpodJobId);
              const { updateProductionScene } = await import("@/lib/genesis-brain/orchestrator");
              await updateProductionScene(scene.id, {
                status: "completed",
                output_video_url: result.videoUrl,
                progress: 100,
              });
              scene.status = "completed" as typeof scene.status;
              log(`  Scene ${scene.sceneNumber}: COMPLETED (FAL) — ${result.videoUrl.slice(0, 60)}...`);
            } else if (falStatus.status === "FAILED") {
              const { updateProductionScene } = await import("@/lib/genesis-brain/orchestrator");
              await updateProductionScene(scene.id, {
                status: "failed",
                error_message: falStatus.error || "FAL generation failed",
              });
              scene.status = "failed" as typeof scene.status;
              log(`  Scene ${scene.sceneNumber}: FAILED — ${falStatus.error}`);
            } else {
              log(`  Scene ${scene.sceneNumber}: ${falStatus.status} (FAL poll #${pollCount})`);
            }
          } catch (err) {
            log(`  Scene ${scene.sceneNumber}: FAL poll error — ${err instanceof Error ? err.message : err}`);
          }
        } else {
          try {
            const { getRunPodJobStatus } = await import("@/lib/runpod");
            const rpStatus = await getRunPodJobStatus(sceneModelId, scene.runpodJobId);
            if (rpStatus.status === "COMPLETED" && rpStatus.output?.video_url) {
              const { updateProductionScene } = await import("@/lib/genesis-brain/orchestrator");
              await updateProductionScene(scene.id, {
                status: "completed",
                output_video_url: rpStatus.output.video_url,
                progress: 100,
              });
              scene.status = "completed" as typeof scene.status;
              log(`  Scene ${scene.sceneNumber}: COMPLETED (RunPod) — ${rpStatus.output.video_url.slice(0, 60)}...`);
            } else if (rpStatus.status === "FAILED") {
              const { updateProductionScene } = await import("@/lib/genesis-brain/orchestrator");
              await updateProductionScene(scene.id, {
                status: "failed",
                error_message: rpStatus.error || "RunPod generation failed",
              });
              scene.status = "failed" as typeof scene.status;
              log(`  Scene ${scene.sceneNumber}: FAILED — ${rpStatus.error}`);
            } else {
              log(`  Scene ${scene.sceneNumber}: ${rpStatus.status} (RunPod poll #${pollCount})`);
            }
          } catch (err) {
            log(`  Scene ${scene.sceneNumber}: RunPod poll error — ${err instanceof Error ? err.message : err}`);
          }
        }
      }

      // Check completion
      const completedScenes = scenes.filter((s) => s.status === "completed").length;
      const failedScenes = scenes.filter((s) => s.status === "failed").length;
      const totalScenes = scenes.length;
      const progress = Math.round(10 + (completedScenes / totalScenes) * 60);
      log(`  Progress: ${progress}% (${completedScenes}/${totalScenes} complete, ${failedScenes} failed)`);

      // Reload production to check if assembly started
      const refreshedProd = await getProduction(production.id);
      if (refreshedProd?.status === "completed") {
        log(`PRODUCTION COMPLETED!`);
        log(`Output URLs: ${JSON.stringify(refreshedProd.outputVideoUrls)}`);
        log(`Thumbnail: ${refreshedProd.thumbnailUrl}`);
        finalStatus = "completed";
        break;
      } else if (refreshedProd?.status === "failed") {
        log(`PRODUCTION FAILED: ${refreshedProd.errorMessage}`);
        finalStatus = "failed";
        break;
      } else if (refreshedProd?.status === "assembling") {
        log(`Assembly in progress...`);
      }

      // Trigger assembly if all scenes done
      const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
      const anyCompleted = scenes.some((s) => s.status === "completed");
      if (allDone && anyCompleted && refreshedProd?.status === "generating") {
        log(`All scenes done — triggering assembly`);
        await updateProduction(production.id, { status: "assembling", progress: 70 });
        const { triggerBrainAssembly } = await import("@/lib/genesis-brain/assembly");
        await triggerBrainAssembly(production.id, scenes);
        log(`Assembly triggered`);
      } else if (allDone && !anyCompleted) {
        log(`All scenes failed — marking production as failed`);
        await updateProduction(production.id, { status: "failed", error_message: "All scenes failed" });
        finalStatus = "failed";
        break;
      }
    }

    if (pollCount >= MAX_POLLS) {
      log(`TIMEOUT — production did not complete in ${MAX_POLLS * 5}s`);
      finalStatus = "timeout";
    }

    return NextResponse.json({
      status: finalStatus,
      productionId: production.id,
      logs,
    });
  } catch (error) {
    log(`FATAL ERROR: ${error instanceof Error ? error.message : error}`);
    return NextResponse.json({ error: "Test failed", logs }, { status: 500 });
  }
}
