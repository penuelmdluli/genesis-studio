/**
 * E2E Test: RunPod ComfyUI Video Generation
 *
 * POST /api/test/comfyui-generation
 * Auth: CRON_SECRET (prevents public GPU abuse)
 *
 * Submits a Wan 2.2 generation via RunPod ComfyUI serverless,
 * polls to completion, persists to R2, returns playable URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { submitRunPodComfyUIJob, isRunPodComfyUIAvailable } from "@/lib/runpod-comfyui";
import { persistExternalVideo } from "@/lib/storage";
import { v4 as uuid } from "uuid";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRunPodComfyUIAvailable()) {
    return NextResponse.json(
      {
        success: false,
        error: "RunPod ComfyUI not configured. Set RUNPOD_COMFYUI_ENDPOINT_ID and COMFYUI_PROVIDER_ENABLED=true",
      },
      { status: 503 }
    );
  }

  const startTime = Date.now();

  try {
    let prompt = "a cute African baby girl with tiny braids and pink bows dancing with pure joy on a vibrant Soweto street at golden hour, crowd of amazed onlookers cheering, cinematic bokeh, 9:16 vertical video, warm golden lighting";
    let negativePrompt = "blurry, low quality, deformed face, watermark, text, ugly, extra limbs, bad anatomy";

    try {
      const body = await req.json();
      if (body.prompt) prompt = body.prompt;
      if (body.negativePrompt) negativePrompt = body.negativePrompt;
    } catch {
      // No body — use defaults
    }

    console.log("[TEST] Submitting to RunPod ComfyUI...");
    const result = await submitRunPodComfyUIJob({
      prompt,
      negativePrompt,
      durationSeconds: 5,
      aspectRatio: "portrait",
    });

    console.log(`[TEST] Got video URL: ${result.videoUrl.slice(0, 80)}...`);
    console.log("[TEST] Persisting to R2...");

    const storageKey = `test/runpod-comfyui/${uuid()}.mp4`;
    const r2Key = await persistExternalVideo(result.videoUrl, storageKey);

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      r2Key,
      videoUrl: `/api/videos/${encodeURIComponent(r2Key)}`,
      jobId: result.jobId,
      costUsd: result.costUsd.toFixed(4),
      executionSec: (result.executionMs / 1000).toFixed(1),
      elapsedSec,
      durationSeconds: result.durationSeconds,
      provider: "runpod-comfyui",
      message: `E2E passed in ${elapsedSec}s (GPU: ${(result.executionMs / 1000).toFixed(1)}s) for $${result.costUsd.toFixed(4)}`,
    });
  } catch (err) {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("[TEST] RunPod ComfyUI E2E failed:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message, elapsedSec, provider: "runpod-comfyui" },
      { status: 500 }
    );
  }
}
