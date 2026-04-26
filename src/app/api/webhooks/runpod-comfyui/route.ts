import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { persistExternalVideo } from "@/lib/storage";
import { updateProductionScene } from "@/lib/genesis-brain/orchestrator";
import { startAssembly } from "@/lib/genesis-brain/assembly";
import { recordSpend } from "@/lib/spend-tracker";
import { sendSlackAlert } from "@/lib/alerts";
import { envString, envNumber } from "@/lib/env";

const DEFAULT_GPU_RATE = 1.89;

function extractVideoUrl(output: unknown): string | null {
  if (!output) return null;
  const o = output as Record<string, unknown>;

  // Direct URL in message field
  if (typeof o.message === "string" && o.message.startsWith("http")) {
    return o.message;
  }

  // video_url field
  if (typeof o.video_url === "string") return o.video_url;

  // result field (RunPod Hub pattern)
  if (typeof o.result === "string" && o.result.startsWith("http")) return o.result;

  // images array with URL
  if (Array.isArray(o.images)) {
    for (const img of o.images) {
      if (typeof img === "object" && img !== null) {
        const item = img as Record<string, unknown>;
        if (typeof item.url === "string") return item.url;
      }
    }
  }

  return null;
}

/**
 * RunPod ComfyUI webhook callback.
 * Called by RunPod when a ComfyUI job completes or fails.
 *
 * POST /api/webhooks/runpod-comfyui
 * Body: { id, status, output, error, executionTime, delayTime }
 */
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = envString("RUNPOD_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id: runpodJobId, status, output, error: jobError, executionTime } = body;

    if (!runpodJobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    console.log(`[ComfyUI-Webhook] Job ${runpodJobId} status: ${status}`);

    const supabase = createSupabaseAdmin();

    // Look up the job in comfyui_jobs
    const { data: job, error: findError } = await supabase
      .from("comfyui_jobs")
      .select("*")
      .eq("runpod_job_id", runpodJobId)
      .single();

    if (findError || !job) {
      console.warn(`[ComfyUI-Webhook] Job ${runpodJobId} not found in comfyui_jobs`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Already processed (idempotent)
    if (job.status === "completed" || job.status === "fallback_pending") {
      return NextResponse.json({ ok: true, message: "Already processed" });
    }

    if (status === "COMPLETED") {
      const videoUrl = extractVideoUrl(output);
      if (!videoUrl) {
        console.error(`[ComfyUI-Webhook] Job ${runpodJobId} completed but no video URL in output`);
        await supabase.from("comfyui_jobs").update({
          status: "failed",
          error_message: "Completed but no video URL in output",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        return NextResponse.json({ ok: false, error: "No video URL" });
      }

      // Persist to R2
      const storageKey = job.scene_id
        ? `productions/${job.production_id}/scene-comfyui-${job.scene_id}.mp4`
        : `comfyui/${runpodJobId}.mp4`;

      let r2Url: string;
      try {
        r2Url = await persistExternalVideo(videoUrl, storageKey);
      } catch (persistErr) {
        console.error(`[ComfyUI-Webhook] R2 persist failed for ${runpodJobId}:`, persistErr);
        await supabase.from("comfyui_jobs").update({
          status: "failed",
          error_message: `R2 persist failed: ${persistErr instanceof Error ? persistErr.message : "Unknown"}`,
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        return NextResponse.json({ ok: false, error: "R2 persist failed" });
      }

      // Calculate cost
      const gpuRate = envNumber("RUNPOD_COMFYUI_GPU_RATE", DEFAULT_GPU_RATE);
      const execMs = executionTime ?? 0;
      const costUsd = (execMs / 1000 / 3600) * gpuRate;

      // Update comfyui_jobs row
      await supabase.from("comfyui_jobs").update({
        status: "completed",
        r2_url: r2Url,
        cost_usd: costUsd,
        execution_time_ms: execMs,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      // Track spend in Redis for circuit breaker
      recordSpend("runpod-comfyui", costUsd).catch(() => {});

      // If this is a Brain Studio scene, update the production_scene
      if (job.scene_id) {
        try {
          await updateProductionScene(job.scene_id, {
            status: "completed",
            output_video_url: r2Url,
            runpod_job_id: runpodJobId,
            gpu_time: execMs / 1000,
            progress: 100,
          });

          const supabase2 = createSupabaseAdmin();
          await supabase2.from("production_scenes").update({
            provider: "runpod-comfyui",
          }).eq("id", job.scene_id);

          // Check if ALL scenes are done → trigger assembly
          if (job.production_id) {
            const { data: allScenes } = await supabase2
              .from("production_scenes")
              .select("status")
              .eq("production_id", job.production_id);

            const allDone = allScenes?.every(
              (s) => s.status === "completed" || s.status === "failed"
            );

            if (allDone) {
              console.log(`[ComfyUI-Webhook] All scenes done for production ${job.production_id}, starting assembly`);
              startAssembly(job.production_id).catch((err) => {
                console.error(`[ComfyUI-Webhook] Assembly trigger failed:`, err);
              });
            }
          }
        } catch (sceneErr) {
          console.error(`[ComfyUI-Webhook] Scene update failed for ${job.scene_id}:`, sceneErr);
        }
      }

      console.log(`[ComfyUI-Webhook] Job ${runpodJobId} completed: R2=${r2Url}, cost=$${costUsd.toFixed(4)}`);
      return NextResponse.json({ ok: true, r2Url, costUsd });
    }

    if (status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT") {
      const errorMsg = jobError ?? `Job ${status}`;
      await supabase.from("comfyui_jobs").update({
        status: "failed",
        error_message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      console.warn(`[ComfyUI-Webhook] Job ${runpodJobId} failed: ${errorMsg}`);

      sendSlackAlert({
        level: "warning",
        title: "ComfyUI generation failed",
        message: `Job ${runpodJobId} ${status}: ${typeof errorMsg === "string" ? errorMsg.slice(0, 200) : "Unknown error"}`,
      }).catch(() => {});

      return NextResponse.json({ ok: false, error: errorMsg });
    }

    // IN_QUEUE or IN_PROGRESS — acknowledge but don't update
    return NextResponse.json({ ok: true, message: `Status ${status} acknowledged` });
  } catch (err) {
    console.error("[ComfyUI-Webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
