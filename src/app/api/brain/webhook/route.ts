import { NextRequest, NextResponse } from "next/server";
import {
  getProductionScenes,
  updateProductionScene,
  updateProduction,
} from "@/lib/genesis-brain/orchestrator";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * RunPod webhook handler for Brain scene completion.
 * Called by RunPod when a scene generation job finishes.
 *
 * POST /api/brain/webhook
 * Body: { id: string, status: string, output?: { video_url, thumbnail_url }, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (required in production)
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    const providedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && providedSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id: runpodJobId, status, output, error: jobError } = body;

    if (!runpodJobId) {
      return NextResponse.json({ error: "Missing job id" }, { status: 400 });
    }

    console.log(`[BRAIN WEBHOOK] Job ${runpodJobId} status: ${status}`);

    // Find the scene by runpod_job_id
    const supabase = createSupabaseAdmin();
    const { data: sceneRow, error: findError } = await supabase
      .from("production_scenes")
      .select("*")
      .eq("runpod_job_id", runpodJobId)
      .single();

    if (findError || !sceneRow) {
      console.warn(`[BRAIN WEBHOOK] Scene not found for job ${runpodJobId}`);
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const productionId = sceneRow.production_id as string;
    const sceneId = sceneRow.id as string;

    // Update scene based on status
    if (status === "COMPLETED" && output?.video_url) {
      await updateProductionScene(sceneId, {
        status: "completed",
        output_video_url: output.video_url,
        gpu_time: body.executionTime || body.gpu_time || 0,
        progress: 100,
      });
      console.log(`[BRAIN WEBHOOK] Scene ${sceneId} completed`);
    } else if (status === "FAILED") {
      await updateProductionScene(sceneId, {
        status: "failed",
        error_message: jobError || "Generation failed on GPU",
        progress: 0,
      });
      console.log(`[BRAIN WEBHOOK] Scene ${sceneId} failed: ${jobError}`);
    } else if (status === "IN_PROGRESS") {
      await updateProductionScene(sceneId, {
        status: "processing",
        progress: body.progress || 50,
      });
      return NextResponse.json({ received: true });
    } else {
      // Unknown or in-queue status, just ack
      return NextResponse.json({ received: true });
    }

    // Check if all scenes for this production are done
    const allScenes = await getProductionScenes(productionId);
    const totalScenes = allScenes.length;
    const completedScenes = allScenes.filter((s) => s.status === "completed").length;
    const failedScenes = allScenes.filter((s) => s.status === "failed").length;
    const doneScenes = completedScenes + failedScenes;

    // Update production progress
    const sceneProgress = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 60) : 0;
    await updateProduction(productionId, {
      progress: 10 + sceneProgress, // 10% planning + up to 60% for scenes
    });

    // If all scenes are done, trigger assembly or mark as failed
    if (doneScenes >= totalScenes) {
      if (failedScenes === totalScenes) {
        // All scenes failed
        await updateProduction(productionId, {
          status: "failed",
          error_message: `All ${totalScenes} scenes failed to generate`,
          completed_at: new Date().toISOString(),
          progress: 0,
        });
        console.log(`[BRAIN WEBHOOK] Production ${productionId} FAILED — all scenes failed`);
      } else if (completedScenes > 0) {
        // At least some scenes completed — move to assembly
        await updateProduction(productionId, {
          status: "assembling",
          progress: 70,
        });
        console.log(
          `[BRAIN WEBHOOK] Production ${productionId} → assembling (${completedScenes}/${totalScenes} scenes)`
        );

        // Trigger assembly in background
        triggerAssembly(productionId, allScenes).catch((err) => {
          console.error(`[BRAIN WEBHOOK] Assembly failed for ${productionId}:`, err);
        });
      }
    }

    return NextResponse.json({ received: true, sceneId, productionId });
  } catch (error) {
    console.error("[BRAIN WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Trigger video assembly after all scenes are generated.
 * This collects scene video URLs and would invoke FFmpeg for stitching.
 * For now: marks production as completed with scene URLs.
 */
async function triggerAssembly(
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

    // For MVP: use first scene as thumbnail, store all URLs
    const videoUrls: Record<string, string> = {};
    completedScenes.forEach((s) => {
      videoUrls[`scene_${s.sceneNumber}`] = s.outputVideoUrl!;
    });

    // If only one scene, use it directly as the output
    const primaryUrl = completedScenes[0].outputVideoUrl!;

    // TODO: When FFmpeg Docker container is ready, submit assembly job here
    // For now, mark as completed with individual scene URLs
    await updateProduction(productionId, {
      status: "completed",
      output_video_urls: JSON.stringify(videoUrls),
      thumbnail_url: primaryUrl.replace(/\.mp4$/, "_thumb.jpg"),
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[BRAIN ASSEMBLY] Production ${productionId} completed with ${completedScenes.length} scenes`
    );
  } catch (err) {
    console.error(`[BRAIN ASSEMBLY] Error for ${productionId}:`, err);
    await updateProduction(productionId, {
      status: "failed",
      error_message: "Video assembly failed",
      completed_at: new Date().toISOString(),
    });
  }
}
