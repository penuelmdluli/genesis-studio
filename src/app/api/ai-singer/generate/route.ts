import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { sendSlackAlert } from "@/lib/alerts";

// ACE-Step for song generation + Kling LipSync for video = AI Singer
export const maxDuration = 300;

const ACE_STEP_MODEL = "fal-ai/ace-step";
const KLING_LIPSYNC_MODEL = "fal-ai/kling-video/lipsync/audio-to-video";

// Genre presets for ACE-Step
const GENRE_TAGS: Record<string, string> = {
  pop: "pop, catchy, upbeat, melodic, polished vocals",
  hiphop: "hip hop, rap, trap, hard bass, rhythmic flow",
  rnb: "r&b, smooth, soulful, sensual, groove",
  afrobeats: "afrobeats, dancehall, tropical, percussion, vibrant",
  gospel: "gospel, spiritual, choir, uplifting, powerful vocals",
  rock: "rock, electric guitar, drums, powerful, raw energy",
  jazz: "jazz, smooth, saxophone, piano, sophisticated",
  electronic: "electronic, synth, dance, EDM, bass drop",
  acoustic: "acoustic, folk, guitar, intimate, warm",
  amapiano: "amapiano, log drum, south african house, piano, bass",
};

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateCheck = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const {
      faceImageUrl,
      lyrics,
      genre,
      songUrl,          // Optional: user's own song (skip ACE-Step)
      songTitle,
      duration,         // 15, 30, or 60 seconds
      aspectRatio,      // 9:16 (portrait) or 16:9 (landscape)
    } = body as {
      faceImageUrl: string;
      lyrics?: string;
      genre?: string;
      songUrl?: string;
      songTitle?: string;
      duration?: number;
      aspectRatio?: string;
    };

    if (!faceImageUrl) {
      return NextResponse.json({ error: "Face image is required" }, { status: 400 });
    }
    if (!lyrics && !songUrl) {
      return NextResponse.json({ error: "Provide lyrics or upload a song" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    const targetDuration = Math.min(duration || 30, 60);
    const ar = aspectRatio === "16:9" ? "16:9" : "9:16";

    // Credit cost: 30 credits base + 1 per second
    const creditsCost = 30 + targetDuration;

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id, creditsCost, "",
        `AI Singer: ${targetDuration}s ${genre || "custom"}`
      );
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      if (!ownerAccount) await refundCredits(user.id, creditsCost, "", "AI Singer not configured — refund");
      return NextResponse.json({ error: "AI Singer is temporarily unavailable. Credits refunded." }, { status: 503 });
    }

    // Create job
    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "ai-singer",
      prompt: songTitle || lyrics?.slice(0, 100) || "AI Singer",
      inputImageUrl: faceImageUrl,
      resolution: "720p",
      duration: targetDuration,
      fps: 30,
      isDraft: false,
      creditsCost,
      aspectRatio: ar === "9:16" ? "portrait" : "landscape",
    });

    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: falKey });

    try {
      // ════════════════════════════════════════════
      // STEP 1: Generate song from lyrics (or use uploaded song)
      // ════════════════════════════════════════════
      let finalSongUrl = songUrl || "";

      if (!songUrl && lyrics) {
        console.log(`[AI-SINGER] Generating song: ${genre}, ${targetDuration}s`);
        await updateJobStatus(job.id, { status: "processing" });

        const genreTags = GENRE_TAGS[genre || "pop"] || GENRE_TAGS.pop;

        const songSubmit = await fal.queue.submit(ACE_STEP_MODEL as string, {
          input: {
            tags: genreTags,
            prompt: genreTags,
            lyrics: lyrics,
            duration: targetDuration,
            num_steps: 40,
            lyric_guidance_scale: 2.5,
            scheduler: "euler",
          },
        });
        const songResult = await fal.queue.result(ACE_STEP_MODEL as string, {
          requestId: songSubmit.request_id,
        });

        const songData = songResult.data as Record<string, unknown>;
        finalSongUrl =
          (songData?.audio_file as { url?: string })?.url ||
          (songData?.audio as { url?: string })?.url ||
          (songData?.audio_url as string) ||
          "";

        if (!finalSongUrl) {
          throw new Error("Song generation failed — no audio URL returned");
        }
        console.log(`[AI-SINGER] Song generated: ${finalSongUrl.slice(0, 80)}...`);
      }

      if (!finalSongUrl) {
        throw new Error("No song URL available");
      }

      // ════════════════════════════════════════════
      // STEP 2: Generate lip-synced video with Kling LipSync
      // ════════════════════════════════════════════
      console.log(`[AI-SINGER] Generating lip-synced video...`);

      // Kling LipSync accepts max 10s per clip. For longer videos,
      // we'll generate the first segment and let the user know.
      const lipSyncDuration = Math.min(targetDuration, 10);

      const videoSubmit = await fal.queue.submit(KLING_LIPSYNC_MODEL as string, {
        input: {
          face_image_url: faceImageUrl,
          audio_url: finalSongUrl,
          aspect_ratio: ar,
        },
      });

      // Poll for completion (lip sync takes 2-12 minutes)
      let videoCompleted = false;
      for (let poll = 0; poll < 72; poll++) { // 72 * 10s = 12 min max
        await new Promise(r => setTimeout(r, 10000));
        const status = await fal.queue.status(KLING_LIPSYNC_MODEL as string, {
          requestId: videoSubmit.request_id,
          logs: false,
        });
        const s = status.status as string;
        if (s === "COMPLETED") { videoCompleted = true; break; }
        if (s === "FAILED" || s === "ERROR") throw new Error("Lip-sync video generation failed");
      }
      if (!videoCompleted) throw new Error("Lip-sync generation timed out");

      const videoResult = await fal.queue.result(KLING_LIPSYNC_MODEL as string, {
        requestId: videoSubmit.request_id,
      });

      const videoData = videoResult.data as Record<string, unknown>;
      let finalVideoUrl =
        (videoData?.video as { url?: string })?.url ||
        (videoData?.video_url as string) ||
        "";

      if (!finalVideoUrl) {
        throw new Error("Lip-sync video generation failed — no video URL returned");
      }
      console.log(`[AI-SINGER] Lip-synced video: ${finalVideoUrl.slice(0, 80)}...`);

      // ════════════════════════════════════════════
      // STEP 3: Persist to R2
      // ════════════════════════════════════════════
      const { persistExternalVideo, videoStorageKey, r2PublicUrl } = await import("@/lib/storage");
      const storageKey = videoStorageKey(user.id, `ai-singer-${Date.now()}`);

      let outputUrl = finalVideoUrl;
      try {
        await persistExternalVideo(finalVideoUrl, storageKey);
        outputUrl = r2PublicUrl(storageKey);
      } catch (persistErr) {
        console.warn("[AI-SINGER] R2 persist failed, using FAL URL:", persistErr);
      }

      // Also persist the song audio
      let songStorageUrl = finalSongUrl;
      if (!songUrl) { // Only persist AI-generated songs
        try {
          const songKey = `ai-singer-songs/${user.id}/${job.id}.mp3`;
          await persistExternalVideo(finalSongUrl, songKey);
          songStorageUrl = r2PublicUrl(songKey);
        } catch { /* non-blocking */ }
      }

      // ════════════════════════════════════════════
      // STEP 4: Save to gallery + update job
      // ════════════════════════════════════════════
      const { createVideo } = await import("@/lib/db");
      try {
        await createVideo({
          id: job.id,
          userId: user.id,
          jobId: job.id,
          title: songTitle || `AI Singer: ${genre || "Custom"}`,
          url: `/api/videos/${job.id}`,
          thumbnailUrl: "",
          modelId: "ai-singer",
          prompt: lyrics?.slice(0, 500) || songTitle || "AI Singer",
          resolution: "720p",
          duration: lipSyncDuration,
          fps: 30,
          fileSize: 0,
          aspectRatio: ar === "9:16" ? "portrait" : "landscape",
          audioUrl: songStorageUrl,
        });
      } catch (dbErr) {
        console.warn("[AI-SINGER] Gallery insert failed:", dbErr);
      }

      await updateJobStatus(job.id, {
        status: "completed",
        outputVideoUrl: outputUrl,
      });

      sendSlackAlert({
        level: "info",
        title: "AI Singer video completed",
        message: `User: ${user.name}\nGenre: ${genre}\nDuration: ${lipSyncDuration}s\nCredits: ${creditsCost}`,
      }).catch(() => {});

      // Auto-publish to explore
      import("@/lib/auto-publish").then(({ autoPublishToExplore }) =>
        autoPublishToExplore({
          jobId: job.id,
          userId: user.id,
          prompt: songTitle || `AI Singer — ${genre}`,
          modelId: "ai-singer",
          videoUrl: outputUrl,
          duration: lipSyncDuration,
          resolution: "720p",
          hasAudio: true,
          type: "standard",
          userPlan: user.plan,
          creatorName: user.name || "Genesis Studio",
        })
      ).catch((e) => console.error("[AI-SINGER] Auto-publish failed:", e));

      return NextResponse.json({
        jobId: job.id,
        videoUrl: outputUrl,
        songUrl: songStorageUrl,
        creditsCost,
        duration: lipSyncDuration,
        genre,
      });

    } catch (pipelineErr) {
      console.error("[AI-SINGER] Pipeline error:", pipelineErr);
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, job.id, "AI Singer failed — automatic refund");
      }
      await updateJobStatus(job.id, { status: "failed", errorMessage: pipelineErr instanceof Error ? pipelineErr.message : "Generation failed" });

      return NextResponse.json(
        { error: `AI Singer generation failed. Credits refunded. ${pipelineErr instanceof Error ? pipelineErr.message : ""}`.trim() },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[AI-SINGER] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
