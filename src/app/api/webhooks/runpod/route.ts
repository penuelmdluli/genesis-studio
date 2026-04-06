import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, uploadThumbnail, videoStorageKey, thumbnailStorageKey, verifyR2Upload } from "@/lib/storage";
import { autoPublishToExplore } from "@/lib/auto-publish";
import { sendVideoReadyEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (required in production)
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!webhookSecret || providedSecret !== webhookSecret) {
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
        // Handle URL-based video output (Hub uses output.result, others use output.video_url)
        else if (output.result || output.video_url || (output.video && output.video.startsWith("http"))) {
          const videoUrl = output.result || output.video_url || output.video;
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

      // Auto-publish free-tier videos to Explore feed (fire-and-forget)
      const { data: user } = await supabase
        .from("users")
        .select("plan, name, avatar_url")
        .eq("id", job.user_id)
        .single();

      autoPublishToExplore({
        jobId: job.id,
        userId: job.user_id,
        prompt: job.prompt,
        modelId: job.model_id,
        videoUrl: videoApiUrl,
        thumbnailUrl: "",
        duration: job.duration,
        resolution: job.resolution,
        hasAudio: !!job.audio_url,
        type: job.type === "motion" ? "motion" : "standard",
        userPlan: user?.plan,
        creatorName: user?.name || "Genesis Creator",
        creatorAvatarUrl: user?.avatar_url,
      }).catch((err) =>
        console.error("[WEBHOOK] Auto-publish failed:", err)
      );

      // Send video-ready email (fire-and-forget)
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("email, name")
          .eq("id", job.user_id)
          .single();
        if (userData?.email) {
          sendVideoReadyEmail(userData.email, userData.name || "Creator", videoId).catch((err) =>
            console.error("[WEBHOOK] Video-ready email failed:", err)
          );
        }
      }
    } else if (status === "FAILED") {
      // Auto-retry: attempt with a fallback model before refunding
      const retryCount = job.retry_count || 0;
      const MAX_RETRIES = 1;

      if (retryCount < MAX_RETRIES) {
        // Find a fallback model of the same type
        const { AI_MODELS } = await import("@/lib/constants");
        const currentModel = AI_MODELS[job.model_id as keyof typeof AI_MODELS];
        const fallbackModels = Object.values(AI_MODELS).filter(
          (m) => m.id !== job.model_id && m.types.includes(job.type) && !m.comingSoon && m.provider !== "fal"
        );

        if (fallbackModels.length > 0) {
          const fallback = fallbackModels[0];
          console.log(`[RETRY] Job ${job.id} failed on ${job.model_id}, retrying with ${fallback.id}`);

          try {
            const { submitRunPodJob, buildRunPodInput } = await import("@/lib/runpod");
            const runpodInput = buildRunPodInput({
              modelId: fallback.id,
              type: job.type,
              prompt: job.prompt,
              negativePrompt: job.negative_prompt,
              inputImageUrl: job.input_image_url,
              inputVideoUrl: job.input_video_url,
              resolution: job.resolution,
              duration: job.duration,
              fps: job.fps,
              seed: job.seed ? job.seed + 1 : undefined,
              guidanceScale: job.guidance_scale,
              numInferenceSteps: job.num_inference_steps,
              isDraft: job.is_draft,
              aspectRatio: job.aspect_ratio,
            });

            const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const webhookUrl = `${appUrl}/api/webhooks/runpod`;
            const retryJob = await submitRunPodJob(fallback.id, runpodInput, webhookUrl, job.type);

            await supabase
              .from("generation_jobs")
              .update({
                model_id: fallback.id,
                runpod_job_id: retryJob.id,
                status: "queued",
                retry_count: retryCount + 1,
                error_message: `Retrying with ${fallback.name} (original: ${job.model_id} failed)`,
              })
              .eq("id", job.id);

            return NextResponse.json({ received: true, retried: true });
          } catch (retryErr) {
            console.error("[RETRY] Fallback submission failed:", retryErr);
            // Fall through to refund
          }
        }
      }

      // No retry possible or retry exhausted — refund
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: jobError || "Generation failed on GPU",
        completedAt: new Date().toISOString(),
      });

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
