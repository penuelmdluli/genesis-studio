import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

/**
 * POST /api/talking-avatar/enhance
 *
 * Post-processing pipeline for avatar videos:
 *  1. Mix background music (FAL compose) — lowers music to -28 LUFS under voice
 *  2. Burn subtitles (FAL auto-subtitle) — TikTok/YouTube/Cinematic style
 *
 * Accepts a completed avatar video URL and returns enhanced version.
 */

// Caption style presets (same as captions/burn)
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
};

// Music mood → FAL stable-audio prompt mapping
const MUSIC_PROMPTS: Record<string, string> = {
  upbeat: "upbeat positive corporate background music, energetic, modern, inspirational, 120 bpm",
  corporate: "professional corporate background music, clean, modern, confident, 100 bpm",
  dramatic: "dramatic cinematic background music, epic, powerful, building tension, 90 bpm",
  chill: "chill lo-fi hip hop background music, relaxed, warm, mellow, 85 bpm",
  energetic: "high energy electronic background music, dynamic, exciting, fast-paced, 140 bpm",
  emotional: "emotional piano background music, touching, heartfelt, warm, 75 bpm",
  trendy: "trendy social media background music, catchy, modern pop beat, viral sound, 115 bpm",
};

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      videoUrl,
      jobId,
      musicMood,
      musicUrl: customMusicUrl,
      subtitleStyle,
      language,
      durationMs,
    } = body as {
      videoUrl: string;
      jobId?: string;
      musicMood?: string;
      musicUrl?: string;
      subtitleStyle?: string;
      language?: string;
      durationMs?: number;
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const wantsMusic = !!(musicMood || customMusicUrl);
    const wantsSubtitles = !!subtitleStyle;

    if (!wantsMusic && !wantsSubtitles) {
      return NextResponse.json({ error: "No enhancements requested" }, { status: 400 });
    }

    // Credit cost: 3 for music mix + 5 for subtitle burn
    const creditCost = (wantsMusic ? 3 : 0) + (wantsSubtitles ? 5 : 0);
    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditCost,
        "",
        `Avatar enhance: ${[wantsMusic && "music", wantsSubtitles && "captions"].filter(Boolean).join("+")}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    try {
      let currentVideoUrl = videoUrl;
      const targetDurationMs = durationMs || 10000;

      // ── Step 1: Mix background music ──
      if (wantsMusic) {
        let musicSource = customMusicUrl;

        // Generate AI music if no custom URL
        if (!musicSource && musicMood) {
          const musicPrompt = MUSIC_PROMPTS[musicMood] || MUSIC_PROMPTS.corporate;
          console.log(`[AVATAR ENHANCE] Generating AI music: ${musicMood}`);

          const musicResult = await fal.subscribe("fal-ai/stable-audio", {
            input: {
              prompt: musicPrompt,
              seconds_total: Math.min(Math.ceil(targetDurationMs / 1000), 47),
            },
            logs: false,
          });

          const musicData = musicResult.data as Record<string, unknown>;
          musicSource =
            (musicData?.audio_file as { url?: string })?.url ||
            (musicData?.audio_url as string) ||
            "";

          if (musicSource) {
            console.log(`[AVATAR ENHANCE] AI music generated: ${musicSource.slice(0, 60)}...`);
          }
        }

        if (musicSource) {
          // Loudnorm music to -28 LUFS (sits below voice)
          let normalizedMusic = musicSource;
          try {
            const normResult = await fal.subscribe("fal-ai/ffmpeg-api/loudnorm", {
              input: { audio_url: musicSource, integrated_loudness: -28 },
              logs: false,
            });
            const normData = normResult.data as Record<string, unknown>;
            normalizedMusic =
              (normData?.audio_url as string) ||
              (normData?.audio as { url?: string })?.url ||
              musicSource;
            console.log("[AVATAR ENHANCE] Music normalized to -28 LUFS");
          } catch (normErr) {
            console.warn("[AVATAR ENHANCE] Loudnorm failed, using raw music:", normErr);
          }

          // Compose video + music together
          const composeResult = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
            input: {
              tracks: [
                {
                  id: "video-main",
                  type: "video",
                  keyframes: [{ timestamp: 0, duration: targetDurationMs, url: currentVideoUrl }],
                },
                {
                  id: "music-bg",
                  type: "audio",
                  keyframes: [{ timestamp: 0, duration: targetDurationMs, url: normalizedMusic }],
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
            console.log(`[AVATAR ENHANCE] Music mixed in: ${composedUrl.slice(0, 60)}...`);
          }
        }
      }

      // ── Step 2: Burn subtitles ──
      if (wantsSubtitles) {
        const preset = CAPTION_STYLES[subtitleStyle || "tiktok"] || CAPTION_STYLES.tiktok;

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
        if (language && language !== "auto" && language !== "en") subtitleInput.language = language;

        console.log(`[AVATAR ENHANCE] Burning subtitles: style=${subtitleStyle}`);

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
          console.log(`[AVATAR ENHANCE] Subtitles burned: ${subtitledUrl.slice(0, 60)}...`);
        }
      }

      // ── Step 3: Persist to R2 ──
      const { persistExternalVideo, videoStorageKey } = await import("@/lib/storage");
      const storageKey = videoStorageKey(user.id, `avatar-enhanced-${Date.now()}`);
      const persistedUrl = await persistExternalVideo(currentVideoUrl, storageKey);

      // Update job if provided
      if (jobId) {
        const { r2PublicUrl } = await import("@/lib/storage");
        await updateJobStatus(jobId, {
          status: "completed",
          outputVideoUrl: persistedUrl || r2PublicUrl(storageKey),
        });
      }

      const { r2PublicUrl } = await import("@/lib/storage");

      return NextResponse.json({
        videoUrl: persistedUrl || r2PublicUrl(storageKey),
        creditsCost: creditCost,
        enhancements: {
          music: wantsMusic,
          subtitles: wantsSubtitles,
        },
      });
    } catch (enhanceError) {
      console.error("[AVATAR ENHANCE] Error:", enhanceError);

      if (!ownerAccount) {
        await refundCredits(user.id, creditCost, "", "Avatar enhance failed — automatic refund");
      }

      return NextResponse.json(
        { error: "Enhancement failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[AVATAR ENHANCE] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
