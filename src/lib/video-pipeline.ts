import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// ─── Exported Presets ────────────────────────────────────────────────────────

export const MUSIC_PROMPTS: Record<string, string> = {
  upbeat:
    "upbeat positive corporate background music, energetic, modern, inspirational, 120 bpm",
  corporate:
    "professional corporate background music, clean, modern, confident, 100 bpm",
  dramatic:
    "dramatic cinematic background music, epic, powerful, building tension, 90 bpm",
  chill:
    "chill lo-fi hip hop background music, relaxed, warm, mellow, 85 bpm",
  energetic:
    "high energy electronic background music, dynamic, exciting, fast-paced, 140 bpm",
  emotional:
    "emotional piano background music, touching, heartfelt, warm, 75 bpm",
  trendy:
    "trendy social media background music, catchy, modern pop beat, viral sound, 115 bpm",
};

export const CAPTION_STYLES: Record<string, Record<string, unknown>> = {
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

// ─── Voice Mapping ───────────────────────────────────────────────────────────

const VOICE_MAP: Record<string, string> = {
  "voice-aria": "en-US-AriaNeural",
  "voice-james": "en-US-GuyNeural",
  "voice-luna": "en-US-JennyNeural",
  "voice-alex": "en-US-DavisNeural",
  "voice-sophia": "en-US-SaraNeural",
  "voice-marcus": "en-US-TonyNeural",
  "voice-naledi": "en-ZA-LeahNeural",
  "voice-thabo": "en-ZA-LukeNeural",
  "voice-sakura": "ja-JP-NanamiNeural",
  "voice-carlos": "es-MX-JorgeNeural",
  "voice-amelie": "fr-FR-DeniseNeural",
  "voice-hans": "de-DE-ConradNeural",
};

// ─── Pipeline Functions ──────────────────────────────────────────────────────

/**
 * Generate AI background music via FAL stable-audio.
 * Returns the audio URL or null on failure.
 */
export async function generateMusic(
  mood: string,
  durationSec: number
): Promise<string | null> {
  try {
    const musicPrompt = MUSIC_PROMPTS[mood] || MUSIC_PROMPTS.corporate;

    const musicResult = await fal.subscribe("fal-ai/stable-audio", {
      input: {
        prompt: musicPrompt,
        seconds_total: Math.min(durationSec + 5, 47),
      },
      logs: false,
    });

    const musicData = musicResult.data as Record<string, unknown>;
    const url =
      (musicData?.audio_file as { url?: string })?.url ||
      (musicData?.audio_url as string) ||
      null;

    return url || null;
  } catch (err) {
    console.error("[video-pipeline] generateMusic failed:", err);
    return null;
  }
}

/**
 * Normalize audio to target LUFS via FAL loudnorm.
 * Returns the normalized audio URL, or the original URL on failure.
 */
export async function normalizeAudio(
  audioUrl: string,
  targetLufs: number = -28
): Promise<string> {
  try {
    const normResult = await fal.subscribe("fal-ai/ffmpeg-api/loudnorm", {
      input: { audio_url: audioUrl, integrated_loudness: targetLufs },
      logs: false,
    });

    const normData = normResult.data as Record<string, unknown>;
    const url =
      (normData?.audio_url as string) ||
      (normData?.audio as { url?: string })?.url ||
      null;

    return url || audioUrl;
  } catch (err) {
    console.warn("[video-pipeline] normalizeAudio failed, returning original:", err);
    return audioUrl;
  }
}

/**
 * Mix an audio track into a video at the specified volume level via FAL compose.
 * Returns the composed video URL.
 */
export async function mixAudioWithVideo(
  videoUrl: string,
  audioUrl: string,
  durationMs: number
): Promise<string> {
  try {
    const composeResult = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
      input: {
        tracks: [
          {
            id: "video-main",
            type: "video",
            keyframes: [{ timestamp: 0, duration: durationMs, url: videoUrl }],
          },
          {
            id: "music-bg",
            type: "audio",
            keyframes: [{ timestamp: 0, duration: durationMs, url: audioUrl }],
          },
        ],
      },
      logs: false,
    });

    const composeData = composeResult.data as Record<string, unknown>;
    const url =
      (composeData?.video_url as string) ||
      (composeData?.video as { url?: string })?.url ||
      null;

    return url || videoUrl;
  } catch (err) {
    console.error("[video-pipeline] mixAudioWithVideo failed:", err);
    return videoUrl;
  }
}

/**
 * Burn auto-subtitles into a video via FAL auto-subtitle.
 * Returns the subtitled video URL or the original on failure.
 */
export async function burnSubtitles(
  videoUrl: string,
  style: string,
  language?: string
): Promise<string> {
  try {
    const preset = CAPTION_STYLES[style] || CAPTION_STYLES.tiktok;

    const subtitleInput: Record<string, unknown> = {
      video_url: videoUrl,
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
    const url =
      (subData?.video_url as string) ||
      (subData?.video as { url?: string })?.url ||
      null;

    return url || videoUrl;
  } catch (err) {
    console.error("[video-pipeline] burnSubtitles failed:", err);
    return videoUrl;
  }
}

/**
 * Concatenate multiple video clips in order via FAL merge-videos.
 * Returns the merged video URL or null on failure.
 */
export async function mergeVideos(videoUrls: string[]): Promise<string | null> {
  if (!videoUrls.length) return null;
  if (videoUrls.length === 1) return videoUrls[0];

  try {
    const concatResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: { video_urls: videoUrls },
      logs: false,
    });

    const concatData = concatResult.data as Record<string, unknown>;
    const url =
      (concatData?.video_url as string) ||
      (concatData?.video as { url?: string })?.url ||
      null;

    return url || null;
  } catch (err) {
    console.error("[video-pipeline] mergeVideos failed:", err);
    return null;
  }
}

/**
 * Generate TTS audio via Edge TTS and upload to R2.
 * Returns the public audio URL or null on failure.
 */
export async function generateTTS(
  text: string,
  voiceId: string
): Promise<string | null> {
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();

    const ttsVoice = VOICE_MAP[voiceId] || "en-US-AriaNeural";
    await tts.setMetadata(ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text);
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
    if (audioBuffer.length === 0) {
      console.warn("[video-pipeline] TTS produced empty audio buffer");
      return null;
    }

    // Upload to R2
    const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
    const audioKey = audioStorageKey("pipeline", `tts-${Date.now()}`);
    await uploadAudio(audioKey, audioBuffer);

    return r2PublicUrl(audioKey);
  } catch (err) {
    console.error("[video-pipeline] generateTTS failed:", err);
    return null;
  }
}

/**
 * Submit a Kling I2V job and poll for completion (max 4 minutes).
 * Returns the generated video URL or null on failure/timeout.
 */
export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  duration: "5" | "10" = "5",
  aspectRatio: string = "16:9"
): Promise<string | null> {
  try {
    const arMap: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
    const ar = arMap[aspectRatio] || "16:9";

    const submitResult = await fal.queue.submit(
      "fal-ai/kling-video/v2.6/pro/image-to-video",
      {
        input: {
          prompt,
          image_url: imageUrl,
          duration,
          aspect_ratio: ar,
        },
      }
    );

    const requestId = submitResult.request_id;

    // Poll for completion: max 24 attempts x 10s = 4 minutes
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 10000));

      try {
        const status = await fal.queue.status(
          "fal-ai/kling-video/v2.6/pro/image-to-video",
          { requestId, logs: false }
        );

        const statusStr = status.status as string;

        if (statusStr === "COMPLETED") {
          const result = await fal.queue.result(
            "fal-ai/kling-video/v2.6/pro/image-to-video",
            { requestId }
          );
          const data = result.data as Record<string, unknown>;
          const videoUrl =
            (data?.video_url as string) ||
            (data?.video as { url?: string })?.url ||
            null;
          return videoUrl || null;
        }

        if (statusStr === "FAILED" || statusStr === "ERROR") {
          console.error(`[video-pipeline] Kling job ${statusStr}`);
          return null;
        }
      } catch (pollErr) {
        console.warn(`[video-pipeline] Poll error (attempt ${i + 1}):`, pollErr);
      }
    }

    console.warn("[video-pipeline] Kling job timed out after 4 minutes");
    return null;
  } catch (err) {
    console.error("[video-pipeline] generateVideoFromImage failed:", err);
    return null;
  }
}
