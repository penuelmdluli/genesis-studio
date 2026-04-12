/**
 * RECOVER-SCENES CRON — Polling-based RunPod status recovery
 *
 * GET /api/cron/recover-scenes
 * Auth: Bearer CRON_SECRET
 *
 * Schedule: every 5 minutes
 *
 * Fixes the "RunPod webhook never fires" problem:
 * 1. Find all production_scenes stuck in "processing" with a runpod_job_id
 *    (older than 3 min so we don't race with the submit flow)
 * 2. Poll RunPod /status for each
 * 3. If COMPLETED with base64 video → download, upload to R2, mark scene completed
 * 4. If FAILED → mark scene failed
 * 5. When all scenes for a production are done → trigger assembly
 *
 * Processes max 20 scenes per run to stay under Vercel's function timeout.
 * Prioritises oldest-stuck first.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const maxDuration = 300; // 5 min — needed for up to 20 scene base64 uploads

const WAN22_ENDPOINT = process.env.RUNPOD_ENDPOINT_WAN22 || "dm5mng5h7034q7";
const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";
const MAX_SCENES_PER_RUN = 20;
const MIN_AGE_MS = 3 * 60 * 1000; // 3 min — avoid racing with fresh submissions

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

interface SceneRow {
  id: string;
  production_id: string;
  scene_number: number;
  status: string;
  runpod_job_id: string | null;
  created_at: string;
}

interface RunPodStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: { video?: string; result?: string; video_url?: string };
  error?: string;
  executionTime?: number;
}

async function pollRunPod(jobId: string): Promise<RunPodStatus | null> {
  try {
    const r = await fetch(
      `https://api.runpod.ai/v2/${WAN22_ENDPOINT}/status/${jobId}`,
      { headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` } }
    );
    if (!r.ok) return null;
    return (await r.json()) as RunPodStatus;
  } catch {
    return null;
  }
}

async function uploadVideoFromBase64(
  productionId: string,
  sceneNumber: number,
  base64: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  const key = `brain-scenes/${productionId.substring(0, 8)}/${sceneNumber}.mp4`;
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: "video/mp4",
    })
  );
  return await getSignedUrl(
    R2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 86400 }
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createSupabaseAdmin();

  // Find stuck processing scenes — with a job_id, older than 3 min
  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();
  const { data: scenes, error } = await supabase
    .from("production_scenes")
    .select("id, production_id, scene_number, status, runpod_job_id, created_at")
    .eq("status", "processing")
    .not("runpod_job_id", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_SCENES_PER_RUN);

  if (error) {
    console.error("[RECOVER-SCENES] Query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sceneList = (scenes || []) as SceneRow[];
  console.log(
    `[RECOVER-SCENES] Checking ${sceneList.length} stuck scenes (max ${MAX_SCENES_PER_RUN})`
  );

  let completed = 0;
  let failed = 0;
  let stillRunning = 0;
  const touchedProductions = new Set<string>();

  // Process in parallel (network I/O bound, safe to fan out)
  await Promise.all(
    sceneList.map(async (s) => {
      const status = await pollRunPod(s.runpod_job_id!);
      if (!status) {
        return;
      }

      if (status.status === "COMPLETED") {
        // Try to extract video: base64 blob OR direct URL
        const base64 = status.output?.video;
        const directUrl =
          status.output?.result || status.output?.video_url || "";

        let finalUrl = "";
        try {
          if (base64 && base64.length > 1000) {
            finalUrl = await uploadVideoFromBase64(
              s.production_id,
              s.scene_number,
              base64
            );
          } else if (directUrl && directUrl.startsWith("http")) {
            finalUrl = directUrl;
          }
        } catch (err) {
          console.error(
            `[RECOVER-SCENES] Scene ${s.scene_number} upload failed:`,
            err instanceof Error ? err.message : err
          );
        }

        if (finalUrl) {
          await supabase
            .from("production_scenes")
            .update({
              status: "completed",
              output_video_url: finalUrl,
              progress: 100,
              gpu_time: status.executionTime || 0,
            })
            .eq("id", s.id);
          completed++;
          touchedProductions.add(s.production_id);
          console.log(
            `[RECOVER-SCENES] Recovered scene ${s.scene_number} of production ${s.production_id.substring(0, 8)}`
          );
        }
      } else if (status.status === "FAILED" || status.status === "CANCELLED") {
        await supabase
          .from("production_scenes")
          .update({
            status: "failed",
            error_message: status.error || "RunPod job failed",
          })
          .eq("id", s.id);
        failed++;
        touchedProductions.add(s.production_id);
      } else {
        // IN_QUEUE or IN_PROGRESS — leave alone
        stillRunning++;
      }
    })
  );

  // For each production whose scenes we touched, check if it's fully done
  // and trigger assembly if so
  const triggered: string[] = [];
  for (const prodId of touchedProductions) {
    const { data: allScenes } = await supabase
      .from("production_scenes")
      .select("status")
      .eq("production_id", prodId);

    const everyScene = allScenes || [];
    const allDone = everyScene.every(
      (s) => s.status === "completed" || s.status === "failed"
    );
    const anyCompleted = everyScene.some((s) => s.status === "completed");

    if (allDone && anyCompleted) {
      // Check if production is still in generating/processing — avoid double-trigger
      const { data: prodRow } = await supabase
        .from("productions")
        .select("status")
        .eq("id", prodId)
        .single();

      if (
        prodRow &&
        (prodRow.status === "generating" || prodRow.status === "planned")
      ) {
        // Move to assembling — startAssembly handles the rest
        await supabase
          .from("productions")
          .update({ status: "assembling", progress: 70 })
          .eq("id", prodId);

        try {
          const { startAssembly } = await import(
            "@/lib/genesis-brain/assembly"
          );
          // Fire and forget — assembly is a state machine
          startAssembly(prodId).catch((err) => {
            console.error(
              `[RECOVER-SCENES] Assembly kickoff failed for ${prodId}:`,
              err
            );
          });
          triggered.push(prodId);
          console.log(
            `[RECOVER-SCENES] Assembly triggered for production ${prodId.substring(0, 8)}`
          );
        } catch (err) {
          console.error(`[RECOVER-SCENES] Could not import startAssembly:`, err);
        }
      }
    } else if (allDone && !anyCompleted) {
      // All scenes failed — mark production as failed
      await supabase
        .from("productions")
        .update({
          status: "failed",
          error_message: "All scenes failed during generation",
          completed_at: new Date().toISOString(),
        })
        .eq("id", prodId);
    }
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    success: true,
    checked: sceneList.length,
    completed,
    failed,
    stillRunning,
    assembliesTriggered: triggered.length,
    triggeredProductionIds: triggered.map((id) => id.substring(0, 8)),
    durationMs,
  };
  console.log(
    `[RECOVER-SCENES] Done in ${durationMs}ms: ${completed} completed, ${failed} failed, ${stillRunning} still running, ${triggered.length} assemblies started`
  );

  return NextResponse.json(summary);
}
