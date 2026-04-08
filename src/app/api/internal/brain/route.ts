import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { planProduction, calculateBrainCredits } from "@/lib/genesis-brain/planner";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import {
  createProduction,
  updateProduction,
  getProduction,
  getProductionScenes,
  updateProductionScene,
  executeProduction,
  resubmitStuckScenes,
} from "@/lib/genesis-brain/orchestrator";
import { getFalJobStatus, getFalJobResult } from "@/lib/fal";
import { createSupabaseAdmin } from "@/lib/supabase";
import { ModelId, BrainInput } from "@/types";
import { AI_MODELS } from "@/lib/constants";

export const maxDuration = 120;

function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

async function getOwnerUser() {
  const ownerClerkIds = (process.env.OWNER_CLERK_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ownerClerkIds.length === 0) return null;
  return getUserByClerkId(ownerClerkIds[0]);
}

export async function POST(req: NextRequest) {
  try {
    if (!validateCronSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOwnerUser();
    if (!user) {
      return NextResponse.json({ error: "Owner user not found" }, { status: 500 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === "plan") {
      // ── PLAN ──────────────────────────────────────
      const input: BrainInput = {
        concept: body.concept,
        targetDuration: body.targetDuration || 30,
        style: body.style || "cinematic",
        aspectRatio: body.aspectRatio || "portrait",
        voiceover: body.voiceover !== false,
        voiceoverVoice: body.voiceoverVoice || "voice-aria",
        music: body.music !== false,
        captions: body.captions !== false,
        soundEffects: body.soundEffects || false,
      };

      if (!input.concept || input.concept.trim().length < 10) {
        return NextResponse.json({ error: "concept must be at least 10 characters" }, { status: 400 });
      }

      const production = await createProduction(user.id, input);
      let plan = await planProduction(input);
      plan = consistencyEngine.applyAll(plan, undefined);
      const totalCredits = calculateBrainCredits(plan, input);

      await updateProduction(production.id, {
        status: "planned",
        plan: JSON.stringify(plan),
        total_credits: totalCredits,
      });

      return NextResponse.json({
        productionId: production.id,
        plan,
        totalCredits,
        estimatedTime: plan.scenes.length * 60 + 30,
      });
    }

    if (action === "produce") {
      // ── PRODUCE ───────────────────────────────────
      const { productionId } = body;
      if (!productionId) {
        return NextResponse.json({ error: "productionId required" }, { status: 400 });
      }

      const production = await getProduction(productionId);
      if (!production) {
        return NextResponse.json({ error: "Production not found" }, { status: 404 });
      }
      if (production.status !== "planned") {
        return NextResponse.json({ error: `Cannot produce: status is ${production.status}` }, { status: 400 });
      }

      const plan = production.plan;
      if (!plan) {
        return NextResponse.json({ error: "No plan found" }, { status: 400 });
      }

      const ownerClerkId = (process.env.OWNER_CLERK_IDS || "").split(",")[0]?.trim() || "";
      const input = {
        concept: production.concept,
        targetDuration: production.targetDuration,
        style: production.style,
        aspectRatio: production.aspectRatio,
        voiceover: production.voiceover,
        music: production.music,
        captions: production.captions,
        soundEffects: false,
      };

      after(async () => {
        try {
          await executeProduction(productionId, user.id, ownerClerkId, plan, input);
          console.log(`[INTERNAL BRAIN] Production ${productionId} completed`);
        } catch (err) {
          console.error(`[INTERNAL BRAIN] Production ${productionId} failed:`, err);
          await updateProduction(productionId, {
            status: "failed",
            error_message: err instanceof Error ? err.message : "Production failed",
          }).catch(() => {});
        }
      });

      return NextResponse.json({
        productionId,
        status: "generating",
      });
    }

    if (action === "status") {
      // ── STATUS ────────────────────────────────────
      const { productionId } = body;
      if (!productionId) {
        return NextResponse.json({ error: "productionId required" }, { status: 400 });
      }

      const production = await getProduction(productionId);
      if (!production) {
        return NextResponse.json({ error: "Production not found" }, { status: 404 });
      }

      const scenes = await getProductionScenes(productionId);

      // Resubmit stuck scenes
      if (production.status === "generating") {
        const stuckQueued = scenes.filter((s) => s.status === "queued" && !s.runpodJobId);
        if (stuckQueued.length > 0) {
          try {
            await resubmitStuckScenes(productionId);
            const refreshed = await getProductionScenes(productionId);
            scenes.length = 0;
            scenes.push(...refreshed);
          } catch (err) {
            console.error(`[INTERNAL BRAIN] Resubmit error:`, err);
          }
        }
      }

      // Poll FAL/RunPod scenes
      if (production.status === "generating") {
        const supabase = createSupabaseAdmin();
        for (const scene of scenes) {
          if (scene.status !== "processing" || !scene.runpodJobId) continue;

          const { data: sceneRow } = await supabase
            .from("production_scenes")
            .select("model_id")
            .eq("id", scene.id)
            .single();

          const sceneModelId = (sceneRow?.model_id || scene.modelId) as ModelId;
          const modelConfig = AI_MODELS[sceneModelId];
          const isFalScene = modelConfig?.provider === "fal";

          if (!isFalScene) {
            try {
              const { getRunPodJobStatus } = await import("@/lib/runpod");
              const rpStatus = await getRunPodJobStatus(sceneModelId, scene.runpodJobId);
              const rpVideoUrl = rpStatus.output?.result || rpStatus.output?.video_url;
              if (rpStatus.status === "COMPLETED" && rpVideoUrl) {
                await updateProductionScene(scene.id, { status: "completed", output_video_url: rpVideoUrl, progress: 100 });
                scene.status = "completed" as typeof scene.status;
                scene.outputVideoUrl = rpVideoUrl;
              } else if (rpStatus.status === "FAILED") {
                await updateProductionScene(scene.id, { status: "failed", error_message: rpStatus.error || "Failed" });
                scene.status = "failed" as typeof scene.status;
              }
            } catch {}
            continue;
          }

          try {
            const falStatus = await getFalJobStatus(sceneModelId, scene.runpodJobId);
            if (falStatus.status === "COMPLETED") {
              const result = await getFalJobResult(sceneModelId, scene.runpodJobId);
              await updateProductionScene(scene.id, { status: "completed", output_video_url: result.videoUrl, progress: 100 });
              scene.status = "completed" as typeof scene.status;
              scene.outputVideoUrl = result.videoUrl;
            } else if (falStatus.status === "FAILED") {
              await updateProductionScene(scene.id, { status: "failed", error_message: falStatus.error || "Failed" });
              scene.status = "failed" as typeof scene.status;
            }
          } catch {}
        }

        // Check completion
        const allDone = scenes.every((s) => s.status === "completed" || s.status === "failed");
        const anyCompleted = scenes.some((s) => s.status === "completed");
        if (allDone) {
          if (anyCompleted) {
            await updateProduction(productionId, { status: "assembling", progress: 70 });
            production.status = "assembling" as typeof production.status;
            const { startAssembly } = await import("@/lib/genesis-brain/assembly");
            await startAssembly(productionId);
          } else {
            await updateProduction(productionId, { status: "failed", progress: 0, error_message: "All scenes failed" });
            production.status = "failed" as typeof production.status;
          }
        }
      }

      // Poll assembly
      if (production.status === "assembling") {
        // If assembly_state is null, startAssembly failed — retry it
        const supabaseCheck = createSupabaseAdmin();
        const { data: prodRow } = await supabaseCheck
          .from("productions")
          .select("assembly_state")
          .eq("id", productionId)
          .single();

        if (!prodRow?.assembly_state) {
          console.log(`[INTERNAL BRAIN] assembly_state is null — retrying startAssembly`);
          try {
            const { startAssembly } = await import("@/lib/genesis-brain/assembly");
            await startAssembly(productionId);
          } catch (err) {
            console.error(`[INTERNAL BRAIN] startAssembly retry failed:`, err);
          }
        }

        const { pollAssembly } = await import("@/lib/genesis-brain/assembly");
        await pollAssembly(productionId);
        const refreshed = await getProduction(productionId);
        if (refreshed) {
          production.status = refreshed.status as typeof production.status;
          production.progress = refreshed.progress;
          production.outputVideoUrls = refreshed.outputVideoUrls;
        }
      }

      const totalScenes = scenes.length || 1;
      const completedScenes = scenes.filter((s) => s.status === "completed").length;

      let progress = production.progress;
      if (production.status === "generating") {
        progress = Math.round(10 + (completedScenes / totalScenes) * 60);
      } else if (production.status === "completed") {
        progress = 100;
      }

      return NextResponse.json({
        id: production.id,
        status: production.status,
        progress,
        outputVideoUrls: production.outputVideoUrls,
        errorMessage: production.errorMessage,
        completedScenes,
        totalScenes,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use: plan, produce, or status" }, { status: 400 });
  } catch (error) {
    console.error("[INTERNAL BRAIN] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
