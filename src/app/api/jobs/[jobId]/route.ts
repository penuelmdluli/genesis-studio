import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, getJob, updateJobStatus, createVideo } from "@/lib/db";
import { getRunPodJobStatus } from "@/lib/runpod";
import { refundCredits } from "@/lib/credits";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { ModelId, GenerationType } from "@/types";
import { createSupabaseAdmin } from "@/lib/supabase";

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
          job.runpod_job_id,
          job.type as GenerationType
        );

        if (runpodStatus.status === "COMPLETED" && runpodStatus.output) {
          // Guard: check if video was already created for this job
          // (webhook may have already processed this completion)
          const supabase = createSupabaseAdmin();
          const { data: existingVideo } = await supabase
            .from("videos")
            .select("id, url")
            .eq("job_id", job.id)
            .maybeSingle();

          if (existingVideo) {
            // Video already exists (webhook beat us) — just return the result
            const videoApiUrl = existingVideo.url.startsWith("/api/videos/")
              ? existingVideo.url
              : `/api/videos/${existingVideo.id}`;

            return NextResponse.json({
              id: job.id,
              status: "completed",
              progress: 100,
              outputVideoUrl: videoApiUrl,
              modelId: job.model_id,
              prompt: job.prompt,
              resolution: job.resolution,
              duration: job.duration,
              creditsCost: job.credits_cost,
              createdAt: job.created_at,
              completedAt: job.completed_at || new Date().toISOString(),
            });
          }

          const output = runpodStatus.output as Record<string, string>;
          const vKey = videoStorageKey(job.user_id, job.id);

          // Upload video to R2
          try {

            // Handle base64 video data
            if (output.video && !output.video.startsWith("http")) {
              const videoBuffer = Buffer.from(output.video, "base64");
              await uploadVideo(vKey, videoBuffer);
            }
            // Handle URL-based video
            else if (output.video_url || (output.video && output.video.startsWith("http"))) {
              const videoUrl = output.video_url || output.video;
              const videoRes = await fetch(videoUrl);
              if (!videoRes.ok) {
                throw new Error(`Failed to download video: ${videoRes.status}`);
              }
              const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
              await uploadVideo(vKey, videoBuffer);
            } else {
              throw new Error("No video data in RunPod output");
            }
          } catch (storageErr) {
            console.error("Storage upload error:", storageErr);
            // Mark failed and refund — do NOT create a broken video record
            await updateJobStatus(job.id, {
              status: "failed",
              errorMessage: `Video upload failed: ${storageErr instanceof Error ? storageErr.message : "Unknown error"}`,
              completedAt: new Date().toISOString(),
            });
            await refundCredits(
              job.user_id,
              job.credits_cost,
              job.id,
              "Video upload failed — automatic refund"
            );
            return NextResponse.json({
              id: job.id,
              status: "failed",
              errorMessage: "Video upload failed. Credits have been refunded.",
              creditsCost: job.credits_cost,
              createdAt: job.created_at,
            });
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
            return NextResponse.json({
              id: job.id,
              status: "failed",
              errorMessage: "Video verification failed. Credits have been refunded.",
              creditsCost: job.credits_cost,
              createdAt: job.created_at,
            });
          }

          // Create video record with correct API URL (same pattern as webhook)
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
            gpuTime: runpodStatus.executionTime,
            completedAt: new Date().toISOString(),
          });

          return NextResponse.json({
            id: job.id,
            status: "completed",
            progress: 100,
            outputVideoUrl: videoApiUrl,
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

      // Timeout check — if job has been running for more than 30 minutes, fail it
      // (includes queue wait time + cold start + GPU processing)
      const jobAge = (Date.now() - new Date(job.created_at).getTime()) / 1000;
      if (jobAge > 1800 && (job.status === "queued" || job.status === "processing")) {
        await updateJobStatus(job.id, {
          status: "failed",
          errorMessage: "Generation timed out after 30 minutes. Credits have been refunded.",
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
          errorMessage: "Generation timed out after 30 minutes. Credits have been refunded.",
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
