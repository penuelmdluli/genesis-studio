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

    // Poll FAL scenes that are still processing (FAL uses polling, not webhooks)
    if (production.status === "generating") {
      const supabase = createSupabaseAdmin();
      for (const scene of scenes) {
        if (scene.status !== "processing" || !scene.runpodJobId) continue;

        // Check if this is a FAL scene
        const { data: sceneRow } = await supabase
          .from("production_scenes")
          .select("provider, model_id")
          .eq("id", scene.id)
          .single();

        if (sceneRow?.provider !== "fal") continue;

        const modelId = sceneRow.model_id as ModelId;
        try {
          const falStatus = await getFalJobStatus(modelId, scene.runpodJobId);

          if (falStatus.status === "COMPLETED") {
            const result = await getFalJobResult(modelId, scene.runpodJobId);
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

      // Check if all scenes are now done — trigger assembly for FAL-only productions
      const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
      const anyCompleted = scenes.some((s) => s.status === "completed");
      if (allDone && anyCompleted && production.status === "generating") {
        await updateProduction(productionId, { status: "assembling", progress: 70 });
        production.status = "assembling" as typeof production.status;

        // Import and call assembly directly
        const { triggerBrainAssembly } = await import("@/lib/genesis-brain/assembly");
        triggerBrainAssembly(productionId, scenes).catch((err: unknown) => {
          console.error(`[BRAIN STATUS] Assembly trigger failed:`, err);
        });
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
      progress = 70 + Math.round((production.progress - 70) || 0);
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
