import { NextRequest, NextResponse } from "next/server";
import { updateJobStatus, createVideo } from "@/lib/db";
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
      try {
        const vKey = videoStorageKey(job.user_id, job.id);

        // Handle base64 video data (common in RunPod Hub templates)
        if (output.video && !output.video.startsWith("http")) {
          const videoBuffer = Buffer.from(output.video, "base64");
          await uploadVideo(vKey, videoBuffer);
        }
        // Handle URL-based video output
        else if (output.video_url || (output.video && output.video.startsWith("http"))) {
          const videoUrl = output.video_url || output.video;
          const videoRes = await fetch(videoUrl);
          const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
          await uploadVideo(vKey, videoBuffer);
        }
      } catch (storageErr) {
        console.error("Storage upload error:", storageErr);
      }

      // Create video record first to get the ID
      const video = await createVideo({
        userId: job.user_id,
        jobId: job.id,
        title: job.prompt.slice(0, 100),
        url: "", // will update after we have the video ID
        thumbnailUrl: "",
        modelId: job.model_id,
        prompt: job.prompt,
        resolution: job.resolution,
        duration: job.duration,
        fps: job.fps,
        fileSize: 0,
      });

      // Set URL to our streaming endpoint
      const videoApiUrl = `/api/videos/${video.id}`;
      await supabase
        .from("videos")
        .update({ url: videoApiUrl })
        .eq("id", video.id);

      await updateJobStatus(job.id, {
        status: "completed",
        progress: 100,
        outputVideoUrl: videoApiUrl,
        gpuTime: executionTime,
        completedAt: new Date().toISOString(),
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
