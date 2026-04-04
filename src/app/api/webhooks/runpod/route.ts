import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, uploadThumbnail, videoStorageKey, thumbnailStorageKey } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (if configured)
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secret = req.headers.get("x-webhook-secret");
      if (secret !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { id: runpodJobId, status, output, error: jobError, executionTime } = body;

    // Find our job by RunPod job ID
    // In production, use an index lookup
    const { createSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = createSupabaseAdmin();
    const { data: job } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("runpod_job_id", runpodJobId)
      .single();

    if (!job) {
      console.error("Job not found for RunPod ID:", runpodJobId);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (status === "COMPLETED" && output) {
      // Download video from RunPod temporary URL and upload to R2
      let finalVideoUrl = output.video_url;
      let finalThumbnailUrl = output.thumbnail_url;

      try {
        if (output.video_url) {
          const videoRes = await fetch(output.video_url);
          const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
          const vKey = videoStorageKey(job.user_id, job.id);
          finalVideoUrl = await uploadVideo(vKey, videoBuffer);
        }

        if (output.thumbnail_url) {
          const thumbRes = await fetch(output.thumbnail_url);
          const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
          const tKey = thumbnailStorageKey(job.user_id, job.id);
          finalThumbnailUrl = await uploadThumbnail(tKey, thumbBuffer);
        }
      } catch (storageErr) {
        console.error("Storage upload error:", storageErr);
        // Fall back to RunPod URLs
      }

      await updateJobStatus(job.id, {
        status: "completed",
        progress: 100,
        outputVideoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbnailUrl,
        gpuTime: executionTime,
        completedAt: new Date().toISOString(),
      });

      // Create video record
      await createVideo({
        userId: job.user_id,
        jobId: job.id,
        title: job.prompt.slice(0, 100),
        url: finalVideoUrl,
        thumbnailUrl: finalThumbnailUrl || "",
        modelId: job.model_id,
        prompt: job.prompt,
        resolution: job.resolution,
        duration: job.duration,
        fps: job.fps,
        fileSize: 0,
      });
    } else if (status === "FAILED") {
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: jobError || "Generation failed on GPU",
        completedAt: new Date().toISOString(),
      });

      // Refund credits on failure
      await refundCredits(
        job.user_id,
        job.credits_cost,
        job.id,
        "Generation failed — automatic refund"
      );
    } else if (status === "IN_PROGRESS") {
      await updateJobStatus(job.id, {
        status: "processing",
        startedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("RunPod webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
