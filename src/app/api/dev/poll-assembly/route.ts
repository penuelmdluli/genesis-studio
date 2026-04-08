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
import { getRunPodJobStatus } from "@/lib/runpod";
import { ModelId } from "@/types";

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

        const scenes = await getProductionScenes(pid);

        // If generating: check if all scenes are done
        if (production.status === "generating") {
          // Poll RunPod for any processing scenes
          for (const scene of scenes) {
            if (scene.status !== "processing" || !scene.runpodJobId) continue;
            try {
              const rpStatus = await getRunPodJobStatus(scene.modelId as ModelId, scene.runpodJobId);
              const rpVideoUrl = rpStatus.output?.result || rpStatus.output?.video_url;
              if (rpStatus.status === "COMPLETED" && rpVideoUrl) {
                await supabase.from("production_scenes").update({
                  status: "completed",
                  output_video_url: rpVideoUrl,
                  progress: 100,
                }).eq("id", scene.id);
                scene.status = "completed" as typeof scene.status;
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
          const phase = (refreshed?.assemblyState as Record<string, unknown>)?.phase as string || "unknown";
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
