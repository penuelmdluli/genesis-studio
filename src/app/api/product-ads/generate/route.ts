import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// Full pipeline: Kling I2V per scene + merge + music + voiceover + subtitles
export const maxDuration = 300;

const KLING_I2V_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

const MUSIC_PROMPTS: Record<string, string> = {
  upbeat: "upbeat positive corporate background music, energetic, modern, inspirational, 120 bpm",
  corporate: "professional corporate background music, clean, modern, confident, 100 bpm",
  dramatic: "dramatic cinematic background music, epic, powerful, building tension, 90 bpm",
  chill: "chill lo-fi hip hop background music, relaxed, warm, mellow, 85 bpm",
  energetic: "high energy electronic background music, dynamic, exciting, fast-paced, 140 bpm",
  emotional: "emotional piano background music, touching, heartfelt, warm, 75 bpm",
  trendy: "trendy social media background music, catchy, modern pop beat, viral sound, 115 bpm",
  luxury: "elegant luxury brand background music, sophisticated, minimalist, premium feel, 95 bpm",
  playful: "playful fun background music, lighthearted, bouncy, youthful energy, 125 bpm",
};

const CAPTION_STYLES: Record<string, Record<string, unknown>> = {
  tiktok: {
    font: "Montserrat/Montserrat-ExtraBold.ttf",
    font_size: 90,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 4,
    highlight_color: "yellow",
    caption_position: "center",
    bounce: true,
    bg_color: null,
  },
  youtube: {
    font: "Roboto/Roboto-Bold.ttf",
    font_size: 60,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 2,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: "black",
    bg_opacity: 0.6,
  },
  cinematic: {
    font: "Playfair_Display/PlayfairDisplay-Italic-VariableFont_wght.ttf",
    font_size: 54,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 1,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: null,
  },
  bold: {
    font: "Montserrat/Montserrat-ExtraBold.ttf",
    font_size: 80,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 5,
    highlight_color: "#FF6B00",
    caption_position: "center",
    bounce: true,
    bg_color: null,
  },
  minimal: {
    font: "Roboto/Roboto-Regular.ttf",
    font_size: 48,
    font_color: "white",
    stroke_color: "black",
    stroke_width: 1,
    highlight_color: null,
    caption_position: "bottom",
    bounce: false,
    bg_color: null,
  },
};

interface SceneInput {
  imageIndex: number;
  motionPrompt: string;
  duration: 5 | 10;
  textOverlay: {
    headline: string;
    subtext?: string;
    position: string;
    color?: string;
  };
}

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

    // Rate limiting
    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      productImages,
      scenes,
      aspectRatio,
      musicMood,
      subtitleStyle,
      voiceoverScript,
      voiceId,
      language,
    } = body as {
      productImages: string[];
      scenes: SceneInput[];
      aspectRatio: string;
      musicMood?: string;
      subtitleStyle?: string;
      voiceoverScript?: string;
      voiceId?: string;
      language?: string;
    };

    // Validate required fields
    if (!productImages || productImages.length === 0) {
      return NextResponse.json({ error: "At least one product image is required" }, { status: 400 });
    }
    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "At least one scene is required" }, { status: 400 });
    }
    if (!aspectRatio) {
      return NextResponse.json({ error: "Aspect ratio is required" }, { status: 400 });
    }

    // Plan check: must be creator+, or owner
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedPlans = ["creator", "pro", "studio"];
      if (!allowedPlans.includes(user.plan)) {
        return NextResponse.json(
          { error: "Product Ads Creator requires a Creator or higher plan" },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost
    const sceneCost = scenes.length * 15;
    const musicCost = musicMood ? 3 : 0;
    const voiceoverCost = voiceoverScript ? 5 : 0;
    const captionCost = subtitleStyle ? 5 : 0;
    const creditsCost = sceneCost + musicCost + voiceoverCost + captionCost;

    // Deduct credits
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Product Ad: ${scenes.length} scenes${musicMood ? " +music" : ""}${voiceoverScript ? " +voiceover" : ""}${subtitleStyle ? " +captions" : ""}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // Check FAL key
    if (!process.env.FAL_KEY) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Product Ads service not configured — automatic refund");
      }
      return NextResponse.json(
        { error: "Product Ads service is temporarily unavailable. Credits have been refunded." },
        { status: 503 }
      );
    }

    // Create job record
    const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
    const arMap: Record<string, "landscape" | "portrait" | "square"> = {
      "16:9": "landscape",
      "9:16": "portrait",
      "1:1": "square",
    };

    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "kling-2.6",
      prompt: `Product Ad: ${scenes.length} scenes`,
      inputImageUrl: productImages[0],
      resolution: "720p",
      duration: totalDuration,
      fps: 30,
      isDraft: false,
      creditsCost,
      aspectRatio: arMap[aspectRatio] || "landscape",
    });

    console.log(`[PRODUCT-ADS] Job ${job.id} created: ${scenes.length} scenes, ${totalDuration}s total`);

    try {
      // ── Step 1: Submit all scenes to Kling in parallel ──
      console.log(`[PRODUCT-ADS] Submitting ${scenes.length} Kling I2V jobs...`);

      const sceneSubmissions = await Promise.all(
        scenes.map(async (scene, idx) => {
          const imageUrl = productImages[Math.min(scene.imageIndex, productImages.length - 1)];
          try {
            const result = await fal.queue.submit(KLING_I2V_MODEL, {
              input: {
                prompt: scene.motionPrompt,
                image_url: imageUrl,
                duration: String(scene.duration),
                aspect_ratio: aspectRatio,
              },
            });
            console.log(`[PRODUCT-ADS] Scene ${idx + 1} submitted: ${result.request_id}`);
            return { idx, requestId: result.request_id, error: null };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[PRODUCT-ADS] Scene ${idx + 1} submit failed: ${errMsg}`);
            return { idx, requestId: null, error: errMsg };
          }
        })
      );

      // ── Step 2: Poll all scenes for completion (max 4 min, 10s interval) ──
      console.log("[PRODUCT-ADS] Polling for scene completion...");

      const sceneResults: Array<{ idx: number; videoUrl: string | null }> = sceneSubmissions.map((s) => ({
        idx: s.idx,
        videoUrl: null,
      }));

      const pendingScenes = sceneSubmissions.filter((s) => s.requestId !== null);
      const completedSet = new Set<number>();

      for (let poll = 0; poll < 24; poll++) {
        // All done?
        if (completedSet.size >= pendingScenes.length) break;

        await new Promise((r) => setTimeout(r, 10000));

        for (const scene of pendingScenes) {
          if (completedSet.has(scene.idx)) continue;
          if (!scene.requestId) continue;

          try {
            const status = await fal.queue.status(KLING_I2V_MODEL, {
              requestId: scene.requestId,
              logs: false,
            });
            const statusStr = status.status as string;

            if (statusStr === "COMPLETED") {
              const result = await fal.queue.result(KLING_I2V_MODEL, {
                requestId: scene.requestId,
              });
              const data = result.data as Record<string, unknown>;
              const videoUrl =
                (data?.video_url as string) ||
                (data?.video as { url?: string })?.url ||
                "";
              sceneResults[scene.idx].videoUrl = videoUrl || null;
              completedSet.add(scene.idx);
              console.log(`[PRODUCT-ADS] Scene ${scene.idx + 1} COMPLETED (poll ${poll + 1}/24)`);
            } else if (statusStr === "FAILED" || statusStr === "ERROR") {
              completedSet.add(scene.idx);
              console.error(`[PRODUCT-ADS] Scene ${scene.idx + 1} ${statusStr} (poll ${poll + 1}/24)`);
            }
          } catch (pollErr) {
            console.warn(`[PRODUCT-ADS] Poll error scene ${scene.idx + 1} (attempt ${poll + 1}):`, pollErr);
          }
        }

        console.log(`[PRODUCT-ADS] Poll ${poll + 1}/24: ${completedSet.size}/${pendingScenes.length} scenes done`);
      }

      // Collect successful scene videos in order
      const successfulVideos = sceneResults
        .filter((s) => s.videoUrl)
        .sort((a, b) => a.idx - b.idx)
        .map((s) => s.videoUrl as string);

      if (successfulVideos.length === 0) {
        console.error("[PRODUCT-ADS] All scenes failed — no videos generated");
        if (!ownerAccount) {
          await refundCredits(user.id, creditsCost, "", "Product Ad — all scenes failed — automatic refund");
        }
        await updateJobStatus(job.id, { status: "failed" });
        return NextResponse.json(
          { error: "All scenes failed to generate. Credits refunded." },
          { status: 503 }
        );
      }

      const failedCount = scenes.length - successfulVideos.length;
      if (failedCount > 0) {
        console.warn(`[PRODUCT-ADS] ${failedCount}/${scenes.length} scenes failed, continuing with ${successfulVideos.length} successful`);
        // Partial refund for failed scenes
        if (!ownerAccount && failedCount > 0) {
          const refundAmount = failedCount * 15;
          await refundCredits(user.id, refundAmount, "", `Product Ad — ${failedCount} scene(s) failed — partial refund`);
        }
      }

      // ── Step 3: Concatenate all scene videos ──
      let currentVideoUrl: string;

      if (successfulVideos.length === 1) {
        currentVideoUrl = successfulVideos[0];
        console.log("[PRODUCT-ADS] Single scene — skipping merge");
      } else {
        console.log(`[PRODUCT-ADS] Merging ${successfulVideos.length} scene videos...`);
        const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
          input: { video_urls: successfulVideos },
          logs: false,
        });
        const mergeData = mergeResult.data as Record<string, unknown>;
        currentVideoUrl =
          (mergeData?.video_url as string) ||
          (mergeData?.video as { url?: string })?.url ||
          "";

        if (!currentVideoUrl) {
          console.error("[PRODUCT-ADS] Merge failed — using first scene as fallback");
          currentVideoUrl = successfulVideos[0];
        } else {
          console.log(`[PRODUCT-ADS] Merge complete: ${currentVideoUrl.slice(0, 80)}...`);
        }
      }

      // ── Step 4: Background music ──
      if (musicMood) {
        console.log(`[PRODUCT-ADS] Generating music: ${musicMood}`);
        try {
          const musicPrompt = MUSIC_PROMPTS[musicMood] || MUSIC_PROMPTS.upbeat;
          const musicResult = await fal.subscribe("fal-ai/stable-audio", {
            input: {
              prompt: musicPrompt,
              seconds_total: Math.min(totalDuration + 5, 47),
            },
            logs: false,
          });

          const musicData = musicResult.data as Record<string, unknown>;
          const musicUrl =
            (musicData?.audio_file as { url?: string })?.url ||
            (musicData?.audio_url as string) ||
            "";

          if (musicUrl) {
            // Normalize music volume
            let normalizedMusic = musicUrl;
            try {
              const normResult = await fal.subscribe("fal-ai/ffmpeg-api/loudnorm", {
                input: { audio_url: musicUrl, integrated_loudness: -28 },
                logs: false,
              });
              const normData = normResult.data as Record<string, unknown>;
              normalizedMusic =
                (normData?.audio_url as string) ||
                (normData?.audio as { url?: string })?.url ||
                musicUrl;
              console.log("[PRODUCT-ADS] Music normalized to -28 LUFS");
            } catch (normErr) {
              console.warn("[PRODUCT-ADS] Loudnorm failed, using raw music:", normErr);
            }

            // Mix music with video
            const composeResult = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
              input: {
                tracks: [
                  {
                    id: "video-main",
                    type: "video",
                    keyframes: [{ timestamp: 0, duration: totalDuration * 1000, url: currentVideoUrl }],
                  },
                  {
                    id: "music-bg",
                    type: "audio",
                    keyframes: [{ timestamp: 0, duration: totalDuration * 1000, url: normalizedMusic }],
                  },
                ],
              },
              logs: false,
            });

            const composeData = composeResult.data as Record<string, unknown>;
            const composedUrl =
              (composeData?.video_url as string) ||
              (composeData?.video as { url?: string })?.url ||
              "";

            if (composedUrl) {
              currentVideoUrl = composedUrl;
              console.log(`[PRODUCT-ADS] Music mixed: ${composedUrl.slice(0, 60)}...`);
            }
          }
        } catch (musicErr) {
          console.error("[PRODUCT-ADS] Music generation failed:", musicErr);
          // Non-fatal — continue without music
        }
      }

      // ── Step 5: Voiceover ──
      if (voiceoverScript) {
        console.log("[PRODUCT-ADS] Generating voiceover TTS...");
        try {
          const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
          const tts = new MsEdgeTTS();

          const voiceMap: Record<string, string> = {
            "voice-aria": "en-US-AriaNeural",
            "voice-james": "en-US-GuyNeural",
            "voice-luna": "en-US-JennyNeural",
            "voice-alex": "en-US-DavisNeural",
            "voice-sophia": "en-US-SaraNeural",
            "voice-marcus": "en-US-TonyNeural",
            "voice-naledi": "en-ZA-LeahNeural",
            "voice-thabo": "en-ZA-LukeNeural",
          };
          const ttsVoice = voiceMap[voiceId || ""] || "en-US-AriaNeural";
          await tts.setMetadata(ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

          const { audioStream } = tts.toStream(voiceoverScript);
          const chunks: Buffer[] = [];
          for await (const chunk of audioStream) {
            if (Buffer.isBuffer(chunk)) {
              chunks.push(chunk);
            } else if (chunk instanceof Uint8Array) {
              chunks.push(Buffer.from(chunk));
            } else if (chunk) {
              chunks.push(Buffer.from(chunk as ArrayBuffer));
            }
          }
          const audioBuffer = Buffer.concat(chunks);

          if (audioBuffer.length > 0) {
            // Upload TTS audio to R2
            const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
            const audioKey = audioStorageKey(user.id, `product-ad-vo-${Date.now()}`);
            await uploadAudio(audioKey, audioBuffer);
            const voiceoverUrl = r2PublicUrl(audioKey);

            console.log(`[PRODUCT-ADS] Voiceover generated: ${audioBuffer.length} bytes`);

            // Mix voiceover with video
            const composeResult = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
              input: {
                tracks: [
                  {
                    id: "video-main",
                    type: "video",
                    keyframes: [{ timestamp: 0, duration: totalDuration * 1000, url: currentVideoUrl }],
                  },
                  {
                    id: "voiceover",
                    type: "audio",
                    keyframes: [{ timestamp: 0, duration: totalDuration * 1000, url: voiceoverUrl }],
                  },
                ],
              },
              logs: false,
            });

            const composeData = composeResult.data as Record<string, unknown>;
            const composedUrl =
              (composeData?.video_url as string) ||
              (composeData?.video as { url?: string })?.url ||
              "";

            if (composedUrl) {
              currentVideoUrl = composedUrl;
              console.log(`[PRODUCT-ADS] Voiceover mixed: ${composedUrl.slice(0, 60)}...`);
            }
          }
        } catch (voErr) {
          console.error("[PRODUCT-ADS] Voiceover failed:", voErr);
          // Non-fatal — continue without voiceover
        }
      }

      // ── Step 6: Burn subtitles ──
      if (subtitleStyle) {
        console.log(`[PRODUCT-ADS] Burning subtitles: style=${subtitleStyle}`);
        try {
          const preset = CAPTION_STYLES[subtitleStyle] || CAPTION_STYLES.bold;

          const subtitleInput: Record<string, unknown> = {
            video_url: currentVideoUrl,
            font: preset.font,
            font_size: preset.font_size,
            font_color: preset.font_color,
            stroke_color: preset.stroke_color,
            stroke_width: preset.stroke_width,
            caption_position: preset.caption_position,
          };

          if (preset.highlight_color) subtitleInput.highlight_color = preset.highlight_color;
          if (preset.bounce) subtitleInput.bounce = true;
          if (preset.bg_color) {
            subtitleInput.bg_color = preset.bg_color;
            if (preset.bg_opacity) subtitleInput.bg_opacity = preset.bg_opacity;
          }
          if (language && language !== "auto" && language !== "en") {
            subtitleInput.language = language;
          }

          const subtitleResult = await fal.subscribe(
            "fal-ai/workflow-utilities/auto-subtitle",
            {
              input: subtitleInput as Record<string, unknown> & { video_url: string },
              logs: false,
            }
          );

          const subData = subtitleResult.data as Record<string, unknown>;
          const subtitledUrl =
            (subData?.video_url as string) ||
            (subData?.video as { url?: string })?.url ||
            "";

          if (subtitledUrl) {
            currentVideoUrl = subtitledUrl;
            console.log(`[PRODUCT-ADS] Subtitles burned: ${subtitledUrl.slice(0, 60)}...`);
          }
        } catch (subErr) {
          console.error("[PRODUCT-ADS] Subtitle burn failed:", subErr);
          // Non-fatal — continue without subtitles
        }
      }

      // ── Step 7: Persist to R2 and update job ──
      console.log("[PRODUCT-ADS] Persisting final video to R2...");
      const { persistExternalVideo, videoStorageKey, r2PublicUrl } = await import("@/lib/storage");
      const storageKey = videoStorageKey(user.id, `product-ad-${Date.now()}`);
      const persistedUrl = await persistExternalVideo(currentVideoUrl, storageKey);
      const finalUrl = persistedUrl || r2PublicUrl(storageKey);

      await updateJobStatus(job.id, {
        status: "completed",
        outputVideoUrl: finalUrl,
      });

      console.log(`[PRODUCT-ADS] Job ${job.id} COMPLETE: ${finalUrl.slice(0, 80)}...`);

      return NextResponse.json({
        jobId: job.id,
        videoUrl: finalUrl,
        creditsCost,
        scenesGenerated: successfulVideos.length,
        scenesFailed: failedCount,
        enhancements: {
          music: !!musicMood,
          voiceover: !!voiceoverScript,
          subtitles: !!subtitleStyle,
        },
      });
    } catch (pipelineError) {
      console.error("[PRODUCT-ADS] Pipeline error:", pipelineError);

      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Product Ad pipeline failed — automatic refund");
      }

      await updateJobStatus(job.id, { status: "failed" });

      return NextResponse.json(
        { error: "Video generation failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[PRODUCT-ADS] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
