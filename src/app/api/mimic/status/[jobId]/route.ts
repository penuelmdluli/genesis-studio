import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, createVideo } from "@/lib/db";
import { getKlingMotionStatus, getKlingMotionResult } from "@/lib/providers/fal-kling-i2v";
import { persistExternalVideo } from "@/lib/storage";
import { extractAndUploadThumbnail, extractThumbnailFromUrl } from "@/lib/thumbnails";
import { createSupabaseAdmin } from "@/lib/supabase";
import { recordSpend } from "@/lib/spend-tracker";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { jobId } = await params;
    const supabase = createSupabaseAdmin();

    const { data: job, error: jobError } = await supabase
      .from("mimic_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Already terminal — return cached result
    if (job.status === "completed") {
      return NextResponse.json({
        status: "completed",
        outputVideoUrl: job.output_video_url,
        costUsd: job.cost_usd,
      });
    }

    if (job.status === "failed") {
      return NextResponse.json({
        status: "failed",
        error: job.error_message,
      });
    }

    // Still scraping — not submitted to FAL yet
    if (job.status === "scraping" || job.status === "pending") {
      return NextResponse.json({ status: job.status });
    }

    // Poll FAL for status
    if (!job.fal_request_id) {
      return NextResponse.json({ status: job.status });
    }

    const { status: falStatus, queuePosition } = await getKlingMotionStatus(job.fal_request_id);

    if (falStatus === "IN_QUEUE") {
      return NextResponse.json({ status: "in_queue", queuePosition });
    }

    if (falStatus === "IN_PROGRESS") {
      return NextResponse.json({ status: "processing" });
    }

    if (falStatus === "FAILED") {
      await supabase.from("mimic_jobs").update({
        status: "failed",
        error_message: "Video generation failed",
      }).eq("id", job.id);

      return NextResponse.json({ status: "failed", error: "Video generation failed" });
    }

    if (falStatus === "COMPLETED") {
      const result = await getKlingMotionResult(job.fal_request_id);

      // Persist to R2
      const r2Key = `mimic-outputs/${user.id}/${job.id}.mp4`;
      let outputUrl = `/api/videos/${job.id}`;
      let r2PersistOk = true;
      try {
        await persistExternalVideo(result.videoUrl, r2Key);
      } catch (e) {
        console.error(`[Mimic] R2 persist failed for ${job.id}, using FAL CDN:`, e);
        outputUrl = result.videoUrl;
        r2PersistOk = false;
      }

      // Extract thumbnail for Gallery display
      let thumbnailUrl = "";
      try {
        if (r2PersistOk) {
          thumbnailUrl = await extractAndUploadThumbnail(r2Key, user.id, job.id);
        } else {
          thumbnailUrl = await extractThumbnailFromUrl(result.videoUrl, user.id, job.id);
        }
      } catch (thumbErr) {
        console.error(`[Mimic] Thumbnail extraction failed for ${job.id}:`, thumbErr);
        // Use character image as fallback poster
        thumbnailUrl = job.character_image_url || "";
      }

      // Insert into Gallery — id matches mimic_jobs.id so /api/videos/{jobId} resolves
      let galleryVideoId: string | null = null;
      if (r2PersistOk) {
        try {
          const video = await createVideo({
            id: job.id,
            userId: user.id,
            jobId: null,
            title: job.prompt || "Mimic Studio generation",
            url: `/api/videos/${job.id}`,
            thumbnailUrl,
            modelId: "mimic-motion" as any,
            prompt: job.prompt || "Mimic Studio",
            resolution: "720p",
            duration: job.duration_sec || 10,
            fps: 24,
            fileSize: result.fileSizeBytes || 0,
            aspectRatio: job.aspect_ratio === "16:9" ? "landscape" : job.aspect_ratio === "1:1" ? "square" : "portrait",
          });
          galleryVideoId = video.id;
        } catch (e) {
          console.error(`[Mimic] Gallery insert failed for ${job.id}:`, e);
        }
      }

      await supabase.from("mimic_jobs").update({
        status: "completed",
        output_video_url: outputUrl,
        gallery_video_id: galleryVideoId,
        cost_usd: result.costUsd,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      recordSpend("fal-kling-i2v-mimic", result.costUsd).catch(() => {});

      return NextResponse.json({
        status: "completed",
        outputVideoUrl: outputUrl,
        costUsd: result.costUsd,
      });
    }

    return NextResponse.json({ status: job.status });
  } catch (error) {
    console.error("[Mimic] Status check error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
