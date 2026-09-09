import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits, isOwnerClerkId } from "@/lib/credits";
import { sendSlackAlert } from "@/lib/alerts";
import {
  getAceStepStatus,
  extractAceStepAudio,
  submitSadTalkerJob,
  getSadTalkerStatus,
  extractSadTalkerVideo,
} from "@/lib/runpod-singer";

// Cron: polls AI Singer pipeline jobs on RunPod and advances them.
// Run every 1 minute via Cloudflare Workers cron trigger.
//
// Stage 10 → ACE-Step (song gen) on RunPod
// Stage 50 → SadTalker (lip-sync) on RunPod
// Stage 100 → complete

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  let songCompleted = 0;
  let lipsyncCompleted = 0;
  let failed = 0;

  // ══════════════════════════════════════════════════════════════════
  // PHASE 1: Poll ACE-Step jobs (progress = 10)
  // When done → upload audio to R2 → submit SadTalker → progress = 50
  // ══════════════════════════════════════════════════════════════════
  const { data: songJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, runpod_job_id, input_image_url, aspect_ratio, duration, negative_prompt, prompt, credits_cost")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .eq("progress", 10)
    .order("created_at", { ascending: true })
    .limit(10);

  if (songJobs?.length) {
    for (const job of songJobs) {
      if (!job.runpod_job_id) continue;

      try {
        const status = await getAceStepStatus(job.runpod_job_id);

        if (status.status === "COMPLETED" && status.output) {
          const audio = extractAceStepAudio(status.output);

          // Upload base64 audio to R2
          let songUrl = audio.audioUrl || "";

          if (audio.audioBase64 && !songUrl) {
            try {
              const { uploadVideo, r2PublicUrl } = await import("@/lib/storage");
              const songKey = `ai-singer-songs/${job.user_id}/${job.id}.wav`;
              const audioBuffer = Buffer.from(audio.audioBase64, "base64");
              await uploadVideo(songKey, audioBuffer);
              songUrl = r2PublicUrl(songKey);
            } catch (uploadErr) {
              console.error(`[CRON-SINGER] Audio upload failed for ${job.id}:`, uploadErr);
              throw new Error("Failed to upload generated song");
            }
          }

          if (!songUrl) throw new Error("ACE-Step returned no audio");

          console.log(`[CRON-SINGER] Song ready for ${job.id}: ${songUrl.slice(0, 80)}...`);

          // Store song URL in job
          await db.from("generation_jobs")
            .update({ audio_url: songUrl })
            .eq("id", job.id);

          // Submit SadTalker for lip-sync
          const sadTalkerJobId = await submitSadTalkerJob({
            faceImageUrl: job.input_image_url,
            audioUrl: songUrl,
          });

          await updateJobStatus(job.id, {
            runpodJobId: sadTalkerJobId,
            progress: 50,
          });

          songCompleted++;
          console.log(`[CRON-SINGER] SadTalker submitted for ${job.id}: ${sadTalkerJobId}`);

        } else if (status.status === "FAILED") {
          throw new Error(status.error || "Song generation failed on RunPod");
        }
        // IN_QUEUE / IN_PROGRESS → skip, check next cycle
      } catch (err) {
        console.error(`[CRON-SINGER] Song stage error for ${job.id}:`, err);
        await failJob(db, job, err);
        failed++;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2: Poll SadTalker jobs (progress = 50)
  // When done → upload video to R2 → save gallery → mark completed
  // ══════════════════════════════════════════════════════════════════
  const { data: lipsyncJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, runpod_job_id, input_image_url, aspect_ratio, duration, prompt, credits_cost, audio_url")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .eq("progress", 50)
    .order("created_at", { ascending: true })
    .limit(10);

  if (lipsyncJobs?.length) {
    for (const job of lipsyncJobs) {
      if (!job.runpod_job_id) continue;

      try {
        const status = await getSadTalkerStatus(job.runpod_job_id);

        if (status.status === "COMPLETED" && status.output) {
          const video = extractSadTalkerVideo(status.output);

          // Upload base64 video to R2
          const { uploadVideo, videoStorageKey, r2PublicUrl } = await import("@/lib/storage");
          const storageKey = videoStorageKey(job.user_id, `ai-singer-${Date.now()}`);
          let outputUrl = video.videoUrl || "";

          if (video.videoBase64) {
            try {
              const videoBuffer = Buffer.from(video.videoBase64, "base64");
              await uploadVideo(storageKey, videoBuffer);
              outputUrl = r2PublicUrl(storageKey);
            } catch (uploadErr) {
              console.error(`[CRON-SINGER] Video upload failed for ${job.id}:`, uploadErr);
              throw new Error("Failed to upload lip-sync video");
            }
          } else if (video.videoUrl) {
            try {
              const { persistExternalVideo } = await import("@/lib/storage");
              await persistExternalVideo(video.videoUrl, storageKey);
              outputUrl = r2PublicUrl(storageKey);
            } catch (persistErr) {
              console.warn(`[CRON-SINGER] R2 persist failed for ${job.id}, using direct URL:`, persistErr);
              outputUrl = video.videoUrl;
            }
          }

          if (!outputUrl) throw new Error("SadTalker returned no video");

          console.log(`[CRON-SINGER] Video ready for ${job.id}: ${outputUrl.slice(0, 80)}...`);

          // Save to gallery
          try {
            await createVideo({
              id: job.id,
              userId: job.user_id,
              jobId: job.id,
              title: job.prompt || "AI Singer",
              url: `/api/videos/${job.id}`,
              thumbnailUrl: "",
              modelId: "ai-singer",
              prompt: job.prompt || "AI Singer",
              resolution: "720p",
              duration: job.duration || 30,
              fps: 30,
              fileSize: video.fileSize || 0,
              aspectRatio: job.aspect_ratio || "portrait",
              audioUrl: job.audio_url || undefined,
            });
          } catch (dbErr) {
            console.warn(`[CRON-SINGER] Gallery insert failed for ${job.id}:`, dbErr);
          }

          // Mark completed
          await updateJobStatus(job.id, {
            status: "completed",
            progress: 100,
            outputVideoUrl: outputUrl,
            completedAt: new Date().toISOString(),
          });

          // Slack alert
          sendSlackAlert({
            level: "info",
            title: "AI Singer video completed (RunPod)",
            message: `Job: ${job.id}\nUser: ${job.user_id}\nCredits: ${job.credits_cost}`,
          }).catch(() => {});

          // Email notification
          try {
            const { data: user } = await db.from("users").select("email, name").eq("id", job.user_id).single();
            if (user?.email) {
              const { sendVideoReadyEmail } = await import("@/lib/email");
              await sendVideoReadyEmail(user.email, user.name || "Creator", job.id);
            }
          } catch { /* non-blocking */ }

          // Auto-publish to explore
          import("@/lib/auto-publish").then(({ autoPublishToExplore }) =>
            autoPublishToExplore({
              jobId: job.id,
              userId: job.user_id,
              prompt: job.prompt || "AI Singer",
              modelId: "ai-singer",
              videoUrl: outputUrl,
              duration: job.duration || 30,
              resolution: "720p",
              hasAudio: true,
              type: "standard",
              userPlan: undefined,
              creatorName: "iVideo Studio",
            })
          ).catch((e) => console.error(`[CRON-SINGER] Auto-publish failed for ${job.id}:`, e));

          lipsyncCompleted++;

        } else if (status.status === "FAILED") {
          throw new Error(status.error || "Lip-sync generation failed on RunPod");
        }
        // IN_QUEUE / IN_PROGRESS → skip, check next cycle
      } catch (err) {
        console.error(`[CRON-SINGER] LipSync stage error for ${job.id}:`, err);
        await failJob(db, job, err);
        failed++;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PHASE 3: Timeout stale jobs (older than 20 minutes)
  // ══════════════════════════════════════════════════════════════════
  let timedOut = 0;
  const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const { data: staleJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, credits_cost")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .lt("created_at", cutoff)
    .limit(10);

  if (staleJobs?.length) {
    for (const job of staleJobs) {
      try {
        await updateJobStatus(job.id, {
          status: "failed",
          errorMessage: "Generation timed out. Credits refunded.",
          completedAt: new Date().toISOString(),
        });
        await refundCredits(job.user_id, job.credits_cost, job.id, "AI Singer timed out — auto refund");
        timedOut++;
        console.log(`[CRON-SINGER] Timed out: ${job.id}`);
      } catch { /* non-blocking */ }
    }
  }

  return NextResponse.json({
    songJobs: songJobs?.length || 0,
    songCompleted,
    lipsyncJobs: lipsyncJobs?.length || 0,
    lipsyncCompleted,
    failed,
    timedOut,
  });
}

// ── Helper: fail a job and refund credits ─────────────────────────
async function failJob(
  db: ReturnType<typeof getDb>,
  job: { id: string; user_id: string; credits_cost: number },
  err: unknown
) {
  const msg = err instanceof Error ? err.message : "Generation failed";
  try {
    await updateJobStatus(job.id, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date().toISOString(),
    });
    const { data: user } = await db.from("users").select("clerk_id").eq("id", job.user_id).single();
    if (user?.clerk_id && !isOwnerClerkId(user.clerk_id)) {
      await refundCredits(job.user_id, job.credits_cost, job.id, `AI Singer failed — auto refund: ${msg}`);
    }
  } catch (e) {
    console.error(`[CRON-SINGER] Failed to fail job ${job.id}:`, e);
  }
}
