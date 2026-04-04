import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, uploadThumbnail, videoStorageKey, thumbnailStorageKey, verifyR2Upload } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (required in production)
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    const providedSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret && providedSecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      // Guard: check if video was already created for this job (polling may have processed it first)
      const { data: existingVideo } = await supabase
        .from("videos")
        .select("id")
        .eq("job_id", job.id)
        .maybeSingle();

      if (existingVideo) {
        // Already processed — skip to avoid duplicate
        return NextResponse.json({ received: true });
      }

      // Upload video to R2 — if this fails, mark job as failed and refund
      const vKey = videoStorageKey(job.user_id, job.id);
      try {
        // Handle base64 video data (common in RunPod Hub templates)
        if (output.video && !output.video.startsWith("http")) {
          const videoBuffer = Buffer.from(output.video, "base64");
          await uploadVideo(vKey, videoBuffer);
        }
        // Handle URL-based video output
        else if (output.video_url || (output.video && output.video.startsWith("http"))) {
          const videoUrl = output.video_url || output.video;
          const videoRes = await fetch(videoUrl);
          if (!videoRes.ok) {
            throw new Error(`Failed to download video from source: ${videoRes.status}`);
          }
          const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
          await uploadVideo(vKey, videoBuffer);
        } else {
          throw new Error("No video data in RunPod output");
        }
      } catch (storageErr) {
        console.error("Storage upload error:", storageErr);

        // Mark job as failed since we have no usable file
        await updateJobStatus(job.id, {
          status: "failed",
          errorMessage: `Storage upload failed: ${storageErr instanceof Error ? storageErr.message : "Unknown error"}`,
          completedAt: new Date().toISOString(),
        });

        // Refund credits
        await refundCredits(
          job.user_id,
          job.credits_cost,
          job.id,
          "Storage upload failed — automatic refund"
        );

        return NextResponse.json({ received: true });
      }

      // Verify the uploaded file is actually valid before creating video record
      try {
        await verifyR2Upload(vKey);
      } catch (verifyErr) {
        console.error("Video verification failed:", verifyErr);
        await updateJobStatus(job.id, {
          status: "failed",
          errorMessage: `Video verification failed: ${verifyErr instanceof Error ? verifyErr.message : "Unknown error"}`,
          completedAt: new Date().toISOString(),
        });
        await refundCredits(
          job.user_id,
          job.credits_cost,
          job.id,
          "Video verification failed — automatic refund"
        );
        return NextResponse.json({ received: true });
      }

      // Upload succeeded + verified — create video record with correct URL in one shot
      const videoId = randomUUID();
      const videoApiUrl = `/api/videos/${videoId}`;

      await createVideo({
        id: videoId,
        userId: job.user_id,
        jobId: job.id,
        title: job.prompt.slice(0, 100),
        url: videoApiUrl,
        thumbnailUrl: "",
        modelId: job.model_id,
        prompt: job.prompt,
        resolution: job.resolution,
        duration: job.duration,
        fps: job.fps,
        fileSize: 0,
        aspectRatio: job.aspect_ratio,
        audioUrl: job.audio_url,
        audioTrackId: job.audio_track_id,
      });

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
