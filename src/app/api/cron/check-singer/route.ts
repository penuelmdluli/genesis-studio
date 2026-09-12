import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { updateJobStatus, createVideo } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { sendSlackAlert } from "@/lib/alerts";
import { getWsPrediction, wsStatusOf, submitWsModel, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError } from "@/lib/user-errors";

// Cron: advances AI Singer jobs. Runs every minute.
//
// Stage 10 → song generating   (runpod_job_id = song prediction id)
// Stage 50 → lip-sync running  (runpod_job_id = lip-sync prediction id)
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

  // ── Stage 10: song ready? → persist to R2 → submit lip-sync ──────────
  const { data: songJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, runpod_job_id, input_image_url, aspect_ratio, duration, negative_prompt, prompt, credits_cost")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .eq("progress", 10)
    .order("created_at", { ascending: true })
    .limit(10);

  for (const job of songJobs || []) {
    if (!job.runpod_job_id) continue;
    try {
      const p = await getWsPrediction(job.runpod_job_id);
      const status = wsStatusOf(p);
      if (status === "FAILED") throw new Error(p.error || "Song generation failed");
      if (status !== "COMPLETED") continue;

      const providerAudio = p.outputs?.[0];
      if (!providerAudio) throw new Error("Song generation returned no audio");

      // Provider URLs expire; keep our own copy.
      const { uploadAudio, r2PublicUrl } = await import("@/lib/storage");
      const res = await fetch(providerAudio);
      if (!res.ok) throw new Error(`Could not download song (${res.status})`);
      const songKey = `ai-singer-songs/${job.user_id}/${job.id}.mp3`;
      await uploadAudio(songKey, Buffer.from(await res.arrayBuffer()), res.headers.get("content-type") || "audio/mpeg");
      const songUrl = r2PublicUrl(songKey);

      await db.from("generation_jobs").update({ audio_url: songUrl }).eq("id", job.id);

      const lip = await submitWsModel(WS_MODELS.lipsyncFromImage, {
        image: job.input_image_url,
        audio: songUrl,
        prompt: "A person singing passionately to camera, expressive, natural head movement",
      });
      await updateJobStatus(job.id, { runpodJobId: lip.id, progress: 50 });
      songCompleted++;
      console.log(`[CRON-SINGER] Song ready for ${job.id}; lip-sync submitted ${lip.id}`);
    } catch (err) {
      console.error(`[CRON-SINGER] Song stage error for ${job.id}:`, err);
      await failJob(job, err);
      failed++;
    }
  }

  // ── Stage 50: lip-sync ready? → persist → gallery → complete ─────────
  const { data: lipsyncJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, runpod_job_id, input_image_url, aspect_ratio, duration, prompt, credits_cost, audio_url")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .eq("progress", 50)
    .order("created_at", { ascending: true })
    .limit(10);

  for (const job of lipsyncJobs || []) {
    if (!job.runpod_job_id) continue;
    try {
      const p = await getWsPrediction(job.runpod_job_id);
      const status = wsStatusOf(p);
      if (status === "FAILED") throw new Error(p.error || "Lip-sync failed");
      if (status !== "COMPLETED") continue;

      const providerVideo = p.outputs?.[0];
      if (!providerVideo) throw new Error("Lip-sync returned no video");

      const { uploadVideo, videoStorageKey } = await import("@/lib/storage");
      const res = await fetch(providerVideo);
      if (!res.ok) throw new Error(`Could not download video (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const storageKey = videoStorageKey(job.user_id, job.id);
      await uploadVideo(storageKey, buffer);
      const outputUrl = `/api/videos/${job.id}`;

      let thumbnailUrl = "";
      try {
        const { extractAndUploadThumbnail } = await import("@/lib/thumbnails");
        thumbnailUrl = await extractAndUploadThumbnail(storageKey, job.user_id, job.id);
      } catch {
        // thumbnail is cosmetic
      }

      try {
        await createVideo({
          id: job.id,
          userId: job.user_id,
          jobId: job.id,
          title: job.prompt || "AI Singer",
          url: outputUrl,
          thumbnailUrl,
          modelId: "ai-singer",
          prompt: job.prompt || "AI Singer",
          resolution: "720p",
          duration: job.duration || 30,
          fps: 30,
          fileSize: buffer.length,
          aspectRatio: job.aspect_ratio || "portrait",
          audioUrl: job.audio_url || undefined,
        });
      } catch (dbErr) {
        console.warn(`[CRON-SINGER] Gallery insert failed for ${job.id}:`, dbErr);
      }

      await updateJobStatus(job.id, {
        status: "completed",
        progress: 100,
        outputVideoUrl: outputUrl,
        completedAt: new Date().toISOString(),
      });

      sendSlackAlert({
        level: "info",
        title: "AI Singer video completed",
        message: `Job: ${job.id}\nUser: ${job.user_id}\nCredits: ${job.credits_cost}`,
      }).catch(() => {});

      try {
        const { data: user } = await db.from("users").select("email, name").eq("id", job.user_id).single();
        if (user?.email) {
          const { sendVideoReadyEmail } = await import("@/lib/email");
          await sendVideoReadyEmail(user.email, user.name || "Creator", job.id);
        }
      } catch {
        // non-blocking
      }

      lipsyncCompleted++;
    } catch (err) {
      console.error(`[CRON-SINGER] Lip-sync stage error for ${job.id}:`, err);
      await failJob(job, err);
      failed++;
    }
  }

  // ── Timeout stale jobs (older than 20 minutes) ───────────────────────
  let timedOut = 0;
  const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: staleJobs } = await db
    .from("generation_jobs")
    .select("id, user_id, credits_cost")
    .eq("model_id", "ai-singer")
    .eq("status", "processing")
    .lt("created_at", cutoff)
    .limit(10);

  for (const job of staleJobs || []) {
    try {
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: "This generation took longer than expected and was stopped. Your credits have been returned.",
        completedAt: new Date().toISOString(),
      });
      if (job.credits_cost > 0) {
        await refundCredits(job.user_id, job.credits_cost, job.id, "AI Singer timed out — auto refund");
      }
      timedOut++;
    } catch {
      // non-blocking
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

async function failJob(job: { id: string; user_id: string; credits_cost: number }, err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    await updateJobStatus(job.id, {
      status: "failed",
      errorMessage: toUserFacingProviderError(raw),
      completedAt: new Date().toISOString(),
    });
    // credits_cost is 0 for owner accounts, so this is a no-op for them.
    if (job.credits_cost > 0) {
      await refundCredits(job.user_id, job.credits_cost, job.id, "AI Singer failed — auto refund");
    }
  } catch (e) {
    console.error(`[CRON-SINGER] Failed to fail job ${job.id}:`, e);
  }
}
