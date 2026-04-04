import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, getJob, updateJobStatus, createVideo } from "@/lib/db";
import { getRunPodJobStatus } from "@/lib/runpod";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, videoStorageKey } from "@/lib/storage";
import { ModelId } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await getJob(jobId);
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If job is still queued/processing and has a RunPod job ID, poll RunPod for updates
    if ((job.status === "queued" || job.status === "processing") && job.runpod_job_id) {
      try {
        const runpodStatus = await getRunPodJobStatus(
          job.model_id as ModelId,
          job.runpod_job_id
        );

        if (runpodStatus.status === "COMPLETED" && runpodStatus.output) {
          const output = runpodStatus.output as Record<string, string>;
          let finalVideoUrl = "";

          try {
            const vKey = videoStorageKey(job.user_id, job.id);

            // Handle base64 video data
            if (output.video && !output.video.startsWith("http")) {
              const videoBuffer = Buffer.from(output.video, "base64");
              finalVideoUrl = await uploadVideo(vKey, videoBuffer);
            }
            // Handle URL-based video
            else if (output.video_url || (output.video && output.video.startsWith("http"))) {
              const videoUrl = output.video_url || output.video;
              const videoRes = await fetch(videoUrl);
              const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
              finalVideoUrl = await uploadVideo(vKey, videoBuffer);
            }
          } catch (storageErr) {
            console.error("Storage upload error:", storageErr);
          }

          await updateJobStatus(job.id, {
            status: "completed",
            progress: 100,
            outputVideoUrl: finalVideoUrl,
            gpuTime: runpodStatus.executionTime,
            completedAt: new Date().toISOString(),
          });

          await createVideo({
            userId: job.user_id,
            jobId: job.id,
            title: job.prompt.slice(0, 100),
            url: finalVideoUrl,
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

          return NextResponse.json({
            id: job.id,
            status: "completed",
            progress: 100,
            outputVideoUrl: finalVideoUrl,
            modelId: job.model_id,
            prompt: job.prompt,
            resolution: job.resolution,
            duration: job.duration,
            creditsCost: job.credits_cost,
            createdAt: job.created_at,
            completedAt: new Date().toISOString(),
          });
        } else if (runpodStatus.status === "FAILED") {
          await updateJobStatus(job.id, {
            status: "failed",
            errorMessage: runpodStatus.error || "Generation failed on GPU",
            completedAt: new Date().toISOString(),
          });

          await refundCredits(
            job.user_id,
            job.credits_cost,
            job.id,
            "Generation failed — automatic refund"
          );

          return NextResponse.json({
            id: job.id,
            status: "failed",
            errorMessage: runpodStatus.error || "Generation failed on GPU",
            creditsCost: job.credits_cost,
            createdAt: job.created_at,
          });
        } else if (runpodStatus.status === "IN_PROGRESS") {
          // Estimate progress based on elapsed time vs expected time
          const { AI_MODELS } = await import("@/lib/constants");
          const model = AI_MODELS[job.model_id as keyof typeof AI_MODELS];
          const avgTime = model?.avgGenerationTime || 120;
          const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
          const estimatedProgress = Math.min(Math.round((elapsed / avgTime) * 95), 95); // Cap at 95% until actually done

          await updateJobStatus(job.id, {
            status: "processing",
            progress: estimatedProgress,
          });
          job.status = "processing";
          job.progress = estimatedProgress;
        }
      } catch (pollErr) {
        console.error("RunPod poll error:", pollErr);
      }

      // Timeout check — if job has been running for more than 10 minutes, fail it
      const jobAge = (Date.now() - new Date(job.created_at).getTime()) / 1000;
      if (jobAge > 600 && (job.status === "queued" || job.status === "processing")) {
        await updateJobStatus(job.id, {
          status: "failed",
          errorMessage: "Generation timed out after 10 minutes. Credits have been refunded.",
          completedAt: new Date().toISOString(),
        });
        await refundCredits(
          job.user_id,
          job.credits_cost,
          job.id,
          "Generation timed out — automatic refund"
        );
        return NextResponse.json({
          id: job.id,
          status: "failed",
          errorMessage: "Generation timed out after 10 minutes. Credits have been refunded.",
          creditsCost: job.credits_cost,
          createdAt: job.created_at,
        });
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      outputVideoUrl: job.output_video_url,
      thumbnailUrl: job.thumbnail_url,
      errorMessage: job.error_message,
      modelId: job.model_id,
      prompt: job.prompt,
      resolution: job.resolution,
      duration: job.duration,
      creditsCost: job.credits_cost,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    });
  } catch (error) {
    console.error("Get job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
