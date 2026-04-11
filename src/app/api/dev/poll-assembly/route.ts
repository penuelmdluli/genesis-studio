/**
 * Dev Poll Assembly — Trigger assembly for dev productions
 *
 * POST /api/dev/poll-assembly
 * Body: { productionId: string } or {} for all assembling productions
 * Auth: CRON_SECRET
 *
 * This does what the brain/status endpoint does but with CRON_SECRET auth.
 * Checks scene completion, starts assembly, and polls assembly phases.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import {
  getProduction,
  getProductionScenes,
  updateProduction,
} from "@/lib/genesis-brain/orchestrator";
import { startAssembly, pollAssembly } from "@/lib/genesis-brain/assembly";
import { resubmitStuckScenes } from "@/lib/genesis-brain/orchestrator";
import { getRunPodJobStatus } from "@/lib/runpod";
import { uploadVideo, getSignedDownloadUrl } from "@/lib/storage";
import { ModelId } from "@/types";

/**
 * Resolve RunPod job output into a fetchable video URL.
 *
 * RunPod's Hub templates return the video in one of three shapes:
 *   - output.result        — an HTTPS URL to a rendered video
 *   - output.video_url     — an HTTPS URL (older templates)
 *   - output.video         — a base64-encoded MP4 (wan-2.2 and most Hub jobs)
 *
 * The dev pollers historically only handled the first two, so base64
 * completions were silently ignored and scenes stayed "processing" forever
 * even though the job was COMPLETED on RunPod's side. This helper mirrors
 * the production webhook logic (src/app/api/webhooks/runpod/route.ts):
 * if the output is base64, decode it, upload to R2, and return an internal
 * API URL; if it's already a URL, return it as-is.
 */
async function resolveRunPodVideo(
  output: Record<string, unknown> | null | undefined,
  sceneId: string,
): Promise<string | null> {
  if (!output) return null;

  const videoField = output.video as string | undefined;
  const resultField = output.result as string | undefined;
  const urlField = output.video_url as string | undefined;

  // Case 1 — URL already (output.result or output.video_url, or output.video is a URL)
  if (resultField && typeof resultField === "string") return resultField;
  if (urlField && typeof urlField === "string") return urlField;
  if (videoField && typeof videoField === "string" && videoField.startsWith("http")) {
    return videoField;
  }

  // Case 2 — base64-encoded MP4 in output.video. Upload to R2 and return a
  // signed download URL so the downstream assembly pipeline (which fetches
  // scene URLs via fetch() for MMAudio + ffmpeg concat) can read it. We use
  // a 12-hour signed URL because the full assembly → audio → concat → post
  // flow can span multiple scheduler cycles.
  if (videoField && typeof videoField === "string" && videoField.length > 0) {
    try {
      const buffer = Buffer.from(videoField, "base64");
      if (buffer.length < 5000) {
        console.warn(
          `[DEV POLL] Scene ${sceneId}: base64 video decoded to only ${buffer.length} bytes — treating as invalid`,
        );
        return null;
      }
      const r2Key = `dev/scenes/${sceneId}.mp4`;
      await uploadVideo(r2Key, buffer);
      const signedUrl = await getSignedDownloadUrl(r2Key, 12 * 60 * 60);
      console.log(
        `[DEV POLL] Scene ${sceneId}: uploaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB to ${r2Key}`,
      );
      return signedUrl;
    } catch (err) {
      console.error(
        `[DEV POLL] Scene ${sceneId}: failed to decode/upload base64 video:`,
        err,
      );
      return null;
    }
  }

  return null;
}

export const maxDuration = 120;

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { productionId } = body as { productionId?: string };

    const supabase = createSupabaseAdmin();

    // Find productions to poll
    let productionIds: string[] = [];
    if (productionId) {
      productionIds = [productionId];
    } else {
      const { data } = await supabase
        .from("productions")
        .select("id")
        .in("status", ["generating", "assembling"])
        .order("created_at", { ascending: true })
        .limit(10);
      productionIds = (data || []).map((p: { id: string }) => p.id);
    }

    if (productionIds.length === 0) {
      return NextResponse.json({ message: "No productions to poll", results: [] });
    }

    const results: Array<{ id: string; status: string; phase?: string; progress?: number; error?: string }> = [];

    for (const pid of productionIds) {
      try {
        const production = await getProduction(pid);
        if (!production) {
          results.push({ id: pid, status: "not_found" });
          continue;
        }

        let scenes = await getProductionScenes(pid);

        // If generating: check if all scenes are done
        if (production.status === "generating") {
          // Recovery: resubmit any scenes that were left in 'queued' with no
          // runpodJobId (Vercel after() died before submission completed).
          // Without this, the dev pipeline can't self-heal and productions
          // sit at 0% forever waiting for a webhook that will never come.
          const stuckQueued = scenes.filter(
            (s) => s.status === "queued" && !s.runpodJobId,
          );
          if (stuckQueued.length > 0) {
            try {
              const resubmitted = await resubmitStuckScenes(pid);
              if (resubmitted > 0) {
                console.log(
                  `[DEV POLL] Resubmitted ${resubmitted} stuck scenes for ${pid}`,
                );
                scenes = await getProductionScenes(pid);
              }
            } catch (resubmitErr) {
              console.warn(`[DEV POLL] resubmitStuckScenes error for ${pid}:`, resubmitErr);
            }
          }

          // Poll RunPod for any processing scenes
          for (const scene of scenes) {
            if (scene.status !== "processing" || !scene.runpodJobId) continue;
            try {
              const rpStatus = await getRunPodJobStatus(scene.modelId as ModelId, scene.runpodJobId);
              if (rpStatus.status === "COMPLETED") {
                // RunPod returns video in three possible shapes (URL or base64);
                // resolveRunPodVideo handles all of them and uploads base64 to R2.
                const rpVideoUrl = await resolveRunPodVideo(
                  rpStatus.output as Record<string, unknown> | null | undefined,
                  scene.id,
                );
                if (rpVideoUrl) {
                  await supabase.from("production_scenes").update({
                    status: "completed",
                    output_video_url: rpVideoUrl,
                    progress: 100,
                  }).eq("id", scene.id);
                  scene.status = "completed" as typeof scene.status;
                } else {
                  console.warn(
                    `[DEV POLL] Scene ${scene.id} RunPod COMPLETED but no usable video output`,
                  );
                  await supabase.from("production_scenes").update({
                    status: "failed",
                    error_message: "RunPod completed but output had no video data",
                  }).eq("id", scene.id);
                  scene.status = "failed" as typeof scene.status;
                }
              } else if (rpStatus.status === "FAILED") {
                await supabase.from("production_scenes").update({
                  status: "failed",
                  error_message: rpStatus.error || "RunPod failed",
                }).eq("id", scene.id);
                scene.status = "failed" as typeof scene.status;
              }
            } catch (e) {
              console.warn(`[DEV POLL] RunPod poll error for scene ${scene.id}:`, e);
            }
          }

          // Check if all done
          const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
          const anyCompleted = scenes.some((s) => s.status === "completed");

          if (allDone && anyCompleted) {
            console.log(`[DEV POLL] All scenes done for ${pid} — starting assembly`);
            await updateProduction(pid, { status: "assembling", progress: 70 });
            await startAssembly(pid);
            results.push({ id: pid, status: "assembling", phase: "started" });
          } else if (allDone && !anyCompleted) {
            await updateProduction(pid, { status: "failed", error_message: "All scenes failed" });
            results.push({ id: pid, status: "failed", error: "All scenes failed" });
          } else {
            const completed = scenes.filter((s) => s.status === "completed").length;
            results.push({ id: pid, status: "generating", progress: Math.round((completed / scenes.length) * 100) });
          }
        }
        // If assembling: poll assembly phases
        else if (production.status === "assembling") {
          await pollAssembly(pid);
          const refreshed = await getProduction(pid);
          const phase = (refreshed?.assemblyState as unknown as Record<string, unknown>)?.phase as string || "unknown";
          results.push({
            id: pid,
            status: refreshed?.status || "assembling",
            phase,
            progress: refreshed?.progress,
          });
        }
        // Already completed or failed
        else {
          results.push({ id: pid, status: production.status, progress: production.progress });
        }
      } catch (err) {
        console.error(`[DEV POLL] Error polling ${pid}:`, err);
        results.push({ id: pid, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[DEV POLL] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
