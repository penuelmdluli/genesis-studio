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
  updateProductionScene,
} from "@/lib/genesis-brain/orchestrator";
import { getFalJobStatus, getFalJobResult } from "@/lib/fal";
import { AI_MODELS } from "@/lib/constants";
import { BrainInput, ModelId } from "@/types";

/**
 * POST /api/brain/test-run
 *
 * TEMPORARY test endpoint for Brain Studio pipeline.
 * Starts a production and returns immediately with the production ID.
 * Use GET /api/brain/status?id=xxx to poll for completion.
 *
 * Requires x-test-secret header (last 10 chars of SUPABASE_SERVICE_ROLE_KEY).
 * Remove after debugging.
 */
export async function POST(req: NextRequest) {
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
    // Step 1: Get owner user
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

    // Step 2: Create test concept
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

    // Step 3: Plan with Claude
    log("Planning with Claude...");
    const planStart = Date.now();
    let plan = await planProduction(input);
    plan = consistencyEngine.applyAll(plan);
    log(`Plan complete in ${Date.now() - planStart}ms — ${plan.scenes.length} scenes`);

    for (const scene of plan.scenes) {
      log(`  Scene ${scene.sceneNumber}: ${scene.modelId} ${scene.duration}s — "${scene.prompt.slice(0, 50)}..."`);
    }

    const totalCredits = calculateBrainCredits(plan, input);
    log(`Total credits: ${totalCredits}`);

    // Step 4: Create production
    const production = await createProduction(ownerUser.id, input, plan, totalCredits);
    log(`Production created: ${production.id}`);

    await updateProduction(production.id, {
      status: "planned",
      plan: JSON.stringify(plan),
      total_credits: totalCredits,
    });

    // Step 5: Execute (submit scenes to FAL/RunPod) — fire-and-forget
    log("Submitting scenes...");
    await executeProduction(production.id, ownerUser.id, ownerClerkId, plan, input);
    log("Scenes submitted successfully");

    return NextResponse.json({
      status: "started",
      productionId: production.id,
      logs,
      pollUrl: `/api/brain/test-run?id=${production.id}`,
    });
  } catch (error) {
    log(`FATAL ERROR: ${error instanceof Error ? error.stack || error.message : error}`);
    return NextResponse.json({ error: "Test failed", logs }, { status: 500 });
  }
}

/**
 * GET /api/brain/test-run?id=xxx
 *
 * Poll production status without Clerk auth.
 * Also polls FAL/RunPod and triggers assembly (same logic as status endpoint).
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-test-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productionId = req.nextUrl.searchParams.get("id");
  if (!productionId) {
    return NextResponse.json({ error: "id parameter required" }, { status: 400 });
  }

  try {
    const production = await getProduction(productionId);
    if (!production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }

    const scenes = await getProductionScenes(productionId);
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    // Poll processing scenes
    if (production.status === "generating") {
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
              await updateProductionScene(scene.id, {
                status: "completed",
                output_video_url: result.videoUrl,
                progress: 100,
              });
              scene.status = "completed" as typeof scene.status;
              log(`Scene ${scene.sceneNumber}: COMPLETED (FAL)`);
            } else if (falStatus.status === "FAILED") {
              await updateProductionScene(scene.id, {
                status: "failed",
                error_message: falStatus.error || "FAL generation failed",
              });
              scene.status = "failed" as typeof scene.status;
              log(`Scene ${scene.sceneNumber}: FAILED — ${falStatus.error}`);
            } else {
              log(`Scene ${scene.sceneNumber}: ${falStatus.status} (FAL)`);
            }
          } catch (err) {
            log(`Scene ${scene.sceneNumber}: FAL poll error — ${err instanceof Error ? err.message : err}`);
          }
        } else {
          try {
            const { getRunPodJobStatus } = await import("@/lib/runpod");
            const rpStatus = await getRunPodJobStatus(sceneModelId, scene.runpodJobId);
            // Hub endpoints return video URL as 'result', others as 'video_url'
            const rpVideoUrl = rpStatus.output?.result || rpStatus.output?.video_url;
            if (rpStatus.status === "COMPLETED" && rpVideoUrl) {
              await updateProductionScene(scene.id, {
                status: "completed",
                output_video_url: rpVideoUrl,
                progress: 100,
              });
              scene.status = "completed" as typeof scene.status;
              log(`Scene ${scene.sceneNumber}: COMPLETED (RunPod)`);
            } else if (rpStatus.status === "FAILED") {
              await updateProductionScene(scene.id, {
                status: "failed",
                error_message: rpStatus.error || "RunPod generation failed",
              });
              scene.status = "failed" as typeof scene.status;
              log(`Scene ${scene.sceneNumber}: FAILED — ${rpStatus.error}`);
            } else {
              log(`Scene ${scene.sceneNumber}: ${rpStatus.status} (RunPod)`);
            }
          } catch (err) {
            log(`Scene ${scene.sceneNumber}: RunPod poll error — ${err instanceof Error ? err.message : err}`);
          }
        }
      }

      // Check if all scenes done — trigger assembly
      const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
      const anyCompleted = scenes.some((s) => s.status === "completed");
      if (allDone && anyCompleted) {
        log("All scenes done — triggering assembly");
        await updateProduction(productionId, { status: "assembling", progress: 70 });
        const { triggerBrainAssembly } = await import("@/lib/genesis-brain/assembly");
        await triggerBrainAssembly(productionId, scenes);
        log("Assembly triggered");
        production.status = "assembling" as typeof production.status;
      } else if (allDone && !anyCompleted) {
        log("All scenes failed");
        await updateProduction(productionId, { status: "failed", error_message: "All scenes failed" });
        production.status = "failed" as typeof production.status;
      }
    }

    const completedScenes = scenes.filter((s) => s.status === "completed").length;
    const failedScenes = scenes.filter((s) => s.status === "failed").length;

    return NextResponse.json({
      id: production.id,
      status: production.status,
      progress: production.progress,
      scenes: scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        status: s.status,
        modelId: s.modelId,
        duration: s.duration,
        outputVideoUrl: s.outputVideoUrl,
        errorMessage: s.errorMessage,
      })),
      completedScenes,
      failedScenes,
      totalScenes: scenes.length,
      outputVideoUrls: production.outputVideoUrls,
      thumbnailUrl: production.thumbnailUrl,
      errorMessage: production.errorMessage,
      logs,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Poll failed",
      detail: error instanceof Error ? error.message : error,
    }, { status: 500 });
  }
}
