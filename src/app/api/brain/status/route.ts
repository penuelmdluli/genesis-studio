import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import {
  getProduction,
  getProductionScenes,
  updateProductionScene,
  updateProduction,
} from "@/lib/genesis-brain/orchestrator";
import { getFalJobStatus, getFalJobResult } from "@/lib/fal";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ModelId } from "@/types";
import { AI_MODELS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const productionId = req.nextUrl.searchParams.get("id");
    if (!productionId) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const production = await getProduction(productionId);
    if (!production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }
    if (production.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get scene statuses
    const scenes = await getProductionScenes(productionId);

    // Poll scenes that are still processing
    // FAL models: poll FAL API directly (FAL uses polling, not webhooks)
    // RunPod models: also poll RunPod API as webhook fallback
    if (production.status === "generating") {
      const supabase = createSupabaseAdmin();
      for (const scene of scenes) {
        if (scene.status !== "processing" || !scene.runpodJobId) continue;

        // Detect provider from model config (not DB column which may not exist)
        const { data: sceneRow } = await supabase
          .from("production_scenes")
          .select("model_id")
          .eq("id", scene.id)
          .single();

        const sceneModelId = (sceneRow?.model_id || scene.modelId) as ModelId;
        const modelConfig = AI_MODELS[sceneModelId];
        const isFalScene = modelConfig?.provider === "fal";

        if (!isFalScene) {
          // RunPod model — poll RunPod as webhook fallback
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
              scene.outputVideoUrl = rpVideoUrl;
              console.log(`[BRAIN STATUS] RunPod scene ${scene.id} completed (poll fallback)`);
            } else if (rpStatus.status === "FAILED") {
              await updateProductionScene(scene.id, {
                status: "failed",
                error_message: rpStatus.error || "RunPod generation failed",
              });
              scene.status = "failed" as typeof scene.status;
            } else if (rpStatus.status === "IN_PROGRESS") {
              await updateProductionScene(scene.id, { progress: 50 });
              scene.progress = 50;
            }
          } catch (err) {
            console.warn(`[BRAIN STATUS] RunPod poll error for scene ${scene.id}:`, err);
          }
          continue;
        }

        // FAL model — poll FAL API
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
            scene.outputVideoUrl = result.videoUrl;
          } else if (falStatus.status === "FAILED") {
            await updateProductionScene(scene.id, {
              status: "failed",
              error_message: falStatus.error || "FAL generation failed",
            });
            scene.status = "failed" as typeof scene.status;
          } else if (falStatus.status === "IN_PROGRESS") {
            await updateProductionScene(scene.id, { progress: 50 });
            scene.progress = 50;
          }
        } catch (err) {
          console.warn(`[BRAIN STATUS] FAL poll error for scene ${scene.id}:`, err);
        }
      }

      // Stuck production timeout — if generating for 30+ minutes, mark failed
      const startedAt = production.startedAt ? new Date(production.startedAt).getTime() : 0;
      const elapsedMs = startedAt ? Date.now() - startedAt : 0;
      const STUCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      if (elapsedMs > STUCK_TIMEOUT_MS) {
        const stuckScenes = scenes.filter((s) => s.status === "processing" || s.status === "queued");
        if (stuckScenes.length > 0) {
          console.error(`[BRAIN STATUS] Production ${productionId} stuck for ${Math.round(elapsedMs / 60000)}min — marking failed`);
          for (const s of stuckScenes) {
            await updateProductionScene(s.id, {
              status: "failed",
              error_message: "Generation timed out after 30 minutes",
            });
            s.status = "failed" as typeof s.status;
          }
        }
      }

      // Check if all scenes are now done — kick off async assembly
      const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
      const anyCompleted = scenes.some((s) => s.status === "completed");
      if (allDone && production.status === "generating") {
        if (anyCompleted) {
          // At least some scenes completed — start async assembly
          await updateProduction(productionId, { status: "assembling", progress: 70 });
          production.status = "assembling" as typeof production.status;

          const { startAssembly } = await import("@/lib/genesis-brain/assembly");
          await startAssembly(productionId); // Fast: just submits FAL jobs, returns immediately
        } else {
          // All scenes failed — mark production as failed
          await updateProduction(productionId, {
            status: "failed",
            progress: 0,
            error_message: "All scenes failed to generate",
          });
          production.status = "failed" as typeof production.status;
        }
      }
    }

    // Poll assembly state machine (advances one tick per poll)
    if (production.status === "assembling") {
      const { pollAssembly } = await import("@/lib/genesis-brain/assembly");
      await pollAssembly(productionId);
      // Re-fetch production to get latest status after poll
      const refreshed = await getProduction(productionId);
      if (refreshed) {
        production.status = refreshed.status as typeof production.status;
        production.progress = refreshed.progress;
        production.outputVideoUrls = refreshed.outputVideoUrls;
        production.thumbnailUrl = refreshed.thumbnailUrl;
      }
    }

    // Calculate overall progress
    const totalScenes = scenes.length || 1;
    const completedScenes = scenes.filter((s) => s.status === "completed").length;
    const failedScenes = scenes.filter((s) => s.status === "failed").length;

    let progress = production.progress;
    if (production.status === "generating") {
      // 10% for planning, 60% for scene generation, 30% for assembly
      const sceneProgress = totalScenes > 0 ? (completedScenes / totalScenes) * 60 : 0;
      progress = Math.round(10 + sceneProgress);
    } else if (production.status === "assembling") {
      // Assembly progress is managed by the state machine (72-98)
      progress = production.progress || 72;
    } else if (production.status === "completed") {
      progress = 100;
    }

    return NextResponse.json({
      id: production.id,
      status: production.status,
      progress,
      concept: production.concept,
      style: production.style,
      targetDuration: production.targetDuration,
      totalCredits: production.totalCredits,
      outputVideoUrls: production.outputVideoUrls,
      thumbnailUrl: production.thumbnailUrl,
      gifPreviewUrl: production.gifPreviewUrl,
      voiceoverUrl: production.voiceoverUrl,
      musicUrl: production.musicUrl,
      captionsUrl: production.captionsUrl,
      errorMessage: production.errorMessage,
      plan: production.plan,
      scenes: scenes.map((s) => ({
        id: s.id,
        sceneNumber: s.sceneNumber,
        status: s.status,
        progress: s.progress,
        modelId: s.modelId,
        duration: s.duration,
        outputVideoUrl: s.outputVideoUrl,
        errorMessage: s.errorMessage,
      })),
      completedScenes,
      totalScenes,
      failedScenes,
      createdAt: production.createdAt,
      startedAt: production.startedAt,
      completedAt: production.completedAt,
    });
  } catch (error) {
    console.error("Brain status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
