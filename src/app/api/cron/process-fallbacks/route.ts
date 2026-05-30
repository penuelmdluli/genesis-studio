import { isAutomationPaused } from "@/lib/automation-killswitch";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { submitRunPodJob, buildRunPodInput } from "@/lib/runpod";
import { updateProductionScene } from "@/lib/genesis-brain/orchestrator";
import { sendSlackAlert } from "@/lib/alerts";
import { envString } from "@/lib/env";

/**
 * Cron: Process ComfyUI fallbacks.
 * Picks up failed comfyui_jobs from the last 10 minutes and
 * resubmits them via the legacy RunPod (Wan 2.2) path.
 *
 * GET /api/cron/process-fallbacks
 * Auth: CRON_SECRET
 * Schedule: every 1 minute
 */
export async function GET(req: NextRequest) {
  if (isAutomationPaused()) return NextResponse.json({ paused: true, reason: "AUTOMATION_PAUSED=true" });
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== envString("CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getDb();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Find failed ComfyUI jobs not yet picked up for fallback
  const { data: failedJobs, error } = await supabase
    .from("comfyui_jobs")
    .select("*")
    .eq("status", "failed")
    .eq("provider", "runpod-comfyui")
    .gte("submitted_at", tenMinAgo)
    .order("submitted_at", { ascending: true })
    .limit(10);

  if (error || !failedJobs || failedJobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const job of failedJobs) {
    try {
      // Mark as fallback_pending to prevent re-processing
      await supabase.from("comfyui_jobs").update({
        status: "fallback_pending",
      }).eq("id", job.id);

      // If this is a Brain Studio scene, resubmit via RunPod Wan 2.2
      if (job.scene_id && job.production_id) {
        const { data: scene } = await supabase
          .from("production_scenes")
          .select("*")
          .eq("id", job.scene_id)
          .single();

        if (scene && scene.status !== "completed") {
          const appUrl = envString("APP_URL") || envString("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
          const webhookUrl = `${appUrl}/api/brain/webhook`;

          const runpodInput = buildRunPodInput({
            modelId: "wan-2.2",
            type: "t2v",
            prompt: job.prompt || scene.prompt || "",
            resolution: scene.resolution || "720p",
            duration: scene.duration || 5,
            fps: 24,
            aspectRatio: "landscape",
          });

          const runpodJob = await submitRunPodJob("wan-2.2", runpodInput, webhookUrl);

          await updateProductionScene(job.scene_id, {
            status: "processing",
            runpod_job_id: runpodJob.id,
            progress: 10,
          });

          console.log(
            `[Fallback] Scene ${job.scene_id}: ComfyUI failed → resubmitted as RunPod Wan 2.2 (job ${runpodJob.id})`
          );
        }
      }

      processed++;
    } catch (err) {
      console.error(`[Fallback] Failed to process job ${job.id}:`, err);
    }
  }

  if (processed > 0) {
    sendSlackAlert({
      level: "info",
      title: "ComfyUI fallback processed",
      message: `${processed} failed ComfyUI job(s) resubmitted via RunPod Wan 2.2`,
    }).catch(() => {});
  }

  return NextResponse.json({ processed });
}
