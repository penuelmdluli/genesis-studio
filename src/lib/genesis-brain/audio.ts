// ============================================
// GENESIS BRAIN — Cinematic Audio Engine
// 4-Layer Audio: Native Video, MMAudio V2,
// Sound Effects, Voiceover/TTS
// + Scene Assembly via FAL FFmpeg
// ============================================

import { VoiceoverTiming, SoundDesign } from "@/types";
import { BUILT_IN_AUDIO_TRACKS } from "@/lib/constants";
import { fal } from "@fal-ai/client";

// Configure FAL client (may already be configured elsewhere, but safe to call again)
fal.config({ credentials: process.env.FAL_KEY || "" });

const KOKORO_ENDPOINTS: Record<string, string> = {
  "en-US": "fal-ai/kokoro/american-english",
  "en-GB": "fal-ai/kokoro/british-english",
  "fr-FR": "fal-ai/kokoro/french",
  "es-ES": "fal-ai/kokoro/spanish",
  "it-IT": "fal-ai/kokoro/italian",
  "pt-BR": "fal-ai/kokoro/brazilian-portuguese",
  "ja-JP": "fal-ai/kokoro/japanese",
  "zh-CN": "fal-ai/kokoro/mandarin-chinese",
  "hi-IN": "fal-ai/kokoro/hindi",
  "ko-KR": "fal-ai/kokoro/korean",
};

const KOKORO_VOICES: Record<string, string> = {
  "en-US-GuyNeural": "am_adam",
  "en-US-JennyNeural": "af_heart",
  "en-US-AriaNeural": "af_bella",
  "en-US-DavisNeural": "am_michael",
  "en-GB-RyanNeural": "bf_emma",
  "en-GB-SoniaNeural": "bf_isabella",
  "es-ES-AlvaroNeural": "em_alex",
  "es-ES-ElviraNeural": "ef_dora",
  "fr-FR-HenriNeural": "fm_antoine",
  "fr-FR-DeniseNeural": "ff_sonia",
  "it-IT-DiegoNeural": "im_nicola",
  "pt-BR-AntonioNeural": "pm_alex",
  "ja-JP-KeitaNeural": "jm_takumi",
  "ko-KR-InJoonNeural": "km_yongmin",
  "zh-CN-YunxiNeural": "cm_chao",
  "hi-IN-MadhurNeural": "hm_arjun",
  "zu-ZA-ThandoNeural": "af_heart", // Fallback to English
  "zu-ZA-ThembaNeural": "am_adam",
  "af-ZA-WillemNeural": "am_adam",
  "af-ZA-AdriNeural": "af_heart",
  "ar-SA-HamedNeural": "am_adam",
};

export interface AudioResult {
  type: "voiceover" | "music" | "captions" | "mmaudio" | "sfx";
  url: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface CaptionEntry {
  index: number;
  startTime: string; // SRT format: HH:MM:SS,mmm
  endTime: string;
  text: string;
}

// ---- VOICEOVER GENERATION ----

/**
 * Generate voiceover using FAL Kokoro TTS — high-quality, multi-language
 * Falls back to custom TTS endpoint if configured, then silent placeholder
 */
export async function generateVoiceover(
  script: string,
  language: string = "en-US",
  voice?: string,
  timings?: VoiceoverTiming[]
): Promise<AudioResult> {
  if (!script || script.trim().length === 0) {
    throw new Error("Voiceover script cannot be empty");
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn("[BRAIN AUDIO] FAL_KEY not set — skipping voiceover");
    return { type: "voiceover", url: "", duration: estimateVoiceoverDuration(script), metadata: { skipped: true } };
  }

  // Resolve Kokoro endpoint and voice
  const voiceId = voice || getDefaultVoice(language);
  const kokoroEndpoint = KOKORO_ENDPOINTS[language] || KOKORO_ENDPOINTS["en-US"];
  const kokoroVoice = KOKORO_VOICES[voiceId] || "af_heart";

  try {
    console.log(`[BRAIN AUDIO] Generating voiceover via Kokoro TTS: ${kokoroEndpoint} voice=${kokoroVoice}`);

    const result = await fal.subscribe(kokoroEndpoint, {
      input: {
        prompt: script,
        voice: kokoroVoice,
        speed: 1,
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const audioFile = data?.audio as { url: string } | undefined;

    if (audioFile?.url) {
      console.log(`[BRAIN AUDIO] Voiceover generated: ${audioFile.url}`);
      return {
        type: "voiceover",
        url: audioFile.url,
        duration: (data?.duration as number) || estimateVoiceoverDuration(script),
        metadata: {
          voice: kokoroVoice,
          language,
          model: kokoroEndpoint,
        },
      };
    }

    console.warn("[BRAIN AUDIO] Kokoro TTS returned no audio URL");
  } catch (err) {
    console.error("[BRAIN AUDIO] Kokoro TTS failed:", err);
  }

  // Fallback: try custom TTS endpoint if configured
  const ttsEndpoint = process.env.TTS_ENDPOINT_URL;
  if (ttsEndpoint) {
    try {
      const response = await fetch(ttsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          voice: voiceId,
          language,
          rate: "+0%",
          pitch: "+0Hz",
          output_format: "mp3",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          type: "voiceover",
          url: data.audio_url,
          duration: data.duration || estimateVoiceoverDuration(script),
          metadata: { voice: voiceId, language, source: "custom-tts" },
        };
      }
    } catch (err) {
      console.warn("[BRAIN AUDIO] Custom TTS endpoint also failed:", err);
    }
  }

  // Final fallback — no voiceover available
  return {
    type: "voiceover",
    url: "",
    duration: estimateVoiceoverDuration(script),
    metadata: { skipped: true, reason: "All TTS engines failed" },
  };
}

/**
 * Generate voiceover clips per-scene, each timed to its scene.
 * Returns an array of clips with URLs and scene timing info.
 * This ensures narration is spread across the entire video, not front-loaded.
 */
export async function generatePerSceneVoiceover(
  scenes: Array<{ sceneNumber: number; duration: number; voiceoverLine?: string }>,
  language: string = "en-US",
  voice?: string
): Promise<{
  clips: Array<{ url: string; startMs: number; durationMs: number; sceneNumber: number; actualAudioDurationMs: number }>;
  fullUrl: string;
  fullDuration: number;
  sceneAudioDurations: Record<number, number>;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { clips: [], fullUrl: "", fullDuration: 0, sceneAudioDurations: {} };
  }

  const voiceId = voice || getDefaultVoice(language);
  const kokoroEndpoint = KOKORO_ENDPOINTS[language] || KOKORO_ENDPOINTS["en-US"];
  const kokoroVoice = KOKORO_VOICES[voiceId] || "af_heart";

  // Calculate cumulative offsets
  let offsetMs = 0;
  const sceneOffsets = scenes.map((s) => {
    const start = offsetMs;
    offsetMs += s.duration * 1000;
    return start;
  });

  // Track actual TTS audio durations per scene (for alignment)
  const sceneAudioDurations: Record<number, number> = {};

  // Generate TTS for each scene's voiceoverLine in parallel
  const clipPromises = scenes.map(async (scene, i) => {
    if (!scene.voiceoverLine || !scene.voiceoverLine.trim()) {
      return null;
    }

    try {
      const result = await fal.subscribe(kokoroEndpoint, {
        input: {
          prompt: scene.voiceoverLine,
          voice: kokoroVoice,
          speed: 0.9, // Slightly slower for cinematic pacing
        },
        logs: false,
      });

      const data = result.data as Record<string, unknown>;
      const audioFile = data?.audio as { url: string } | undefined;
      const reportedDuration = data?.duration as number | undefined;

      if (audioFile?.url) {
        // Get the actual audio duration (prefer reported, fall back to metadata check)
        let actualDurationMs = reportedDuration ? reportedDuration * 1000 : 0;
        if (!actualDurationMs) {
          const metaDur = await getMediaDuration(audioFile.url);
          actualDurationMs = metaDur > 0 ? metaDur * 1000 : scene.duration * 1000;
        }

        // Store actual audio duration for this scene
        sceneAudioDurations[scene.sceneNumber] = actualDurationMs;

        console.log(`[BRAIN AUDIO] Scene ${scene.sceneNumber} TTS: ${(actualDurationMs / 1000).toFixed(1)}s actual vs ${scene.duration}s planned`);

        return {
          url: audioFile.url,
          startMs: sceneOffsets[i],
          durationMs: scene.duration * 1000,
          sceneNumber: scene.sceneNumber,
          actualAudioDurationMs: actualDurationMs,
        };
      }
    } catch (err) {
      console.warn(`[BRAIN AUDIO] Per-scene TTS failed for scene ${scene.sceneNumber}:`, err);
    }
    return null;
  });

  const results = await Promise.all(clipPromises);
  const clips = results
    .filter((c): c is NonNullable<typeof c> => c !== null);

  console.log(`[BRAIN AUDIO] Per-scene voiceover: ${clips.length}/${scenes.length} clips generated`);

  // Also generate the full script as one clip for fallback
  const fullScript = scenes
    .map((s) => s.voiceoverLine)
    .filter(Boolean)
    .join(". ");

  let fullUrl = "";
  let fullDuration = 0;
  if (fullScript) {
    try {
      const fullResult = await fal.subscribe(kokoroEndpoint, {
        input: { prompt: fullScript, voice: kokoroVoice, speed: 0.9 },
        logs: false,
      });
      const fullData = fullResult.data as Record<string, unknown>;
      const fullAudio = fullData?.audio as { url: string } | undefined;
      if (fullAudio?.url) {
        fullUrl = fullAudio.url;
        fullDuration = (fullData?.duration as number) || estimateVoiceoverDuration(fullScript);
      }
    } catch {
      console.warn("[BRAIN AUDIO] Full voiceover fallback failed");
    }
  }

  return { clips, fullUrl, fullDuration, sceneAudioDurations };
}

/**
 * Estimate voiceover duration based on word count
 * Average speaking rate: ~150 words per minute
 */
function estimateVoiceoverDuration(script: string): number {
  const words = script.trim().split(/\s+/).length;
  return Math.ceil((words / 150) * 60);
}

/**
 * Get default voice for a language
 */
function getDefaultVoice(language: string): string {
  const voiceMap: Record<string, string> = {
    "en-US": "en-US-GuyNeural",
    "en-GB": "en-GB-RyanNeural",
    "es-ES": "es-ES-AlvaroNeural",
    "fr-FR": "fr-FR-HenriNeural",
    "de-DE": "de-DE-ConradNeural",
    "it-IT": "it-IT-DiegoNeural",
    "pt-BR": "pt-BR-AntonioNeural",
    "ja-JP": "ja-JP-KeitaNeural",
    "ko-KR": "ko-KR-InJoonNeural",
    "zh-CN": "zh-CN-YunxiNeural",
    "hi-IN": "hi-IN-MadhurNeural",
    "ar-SA": "ar-SA-HamedNeural",
    "zu-ZA": "zu-ZA-ThandoNeural",
    "af-ZA": "af-ZA-WillemNeural",
  };
  return voiceMap[language] || "en-US-GuyNeural";
}

// ---- MUSIC SELECTION / GENERATION ----

const FAL_STABLE_AUDIO = "fal-ai/stable-audio";

/**
 * Build a music generation prompt from mood, tempo, and genre
 */
function buildMusicPrompt(mood: string, tempo: "slow" | "medium" | "fast", genre?: string): string {
  const tempoDesc = { slow: "slow, gentle", medium: "moderate tempo", fast: "upbeat, energetic" };
  const parts = [
    genre || "cinematic",
    `${tempoDesc[tempo]} background music`,
    mood ? `${mood} mood` : "",
    "instrumental, no vocals, royalty-free, high quality production",
  ].filter(Boolean);
  return parts.join(", ");
}

/**
 * Generate or select background music.
 * Strategy: Use FAL.AI stable-audio for AI-generated music (best quality).
 * Falls back to built-in tracks if FAL is unavailable.
 */
export async function selectMusic(
  mood: string,
  tempo: "slow" | "medium" | "fast",
  duration: number,
  genre?: string
): Promise<AudioResult> {
  // --- Primary: AI-generated music via FAL stable-audio ---
  const falKey = process.env.FAL_KEY;
  if (falKey) {
    try {
      const prompt = buildMusicPrompt(mood, tempo, genre);
      console.log(`[BRAIN AUDIO] Generating AI music: "${prompt}" (${duration}s)`);

      const result = await fal.subscribe(FAL_STABLE_AUDIO, {
        input: {
          prompt,
          seconds_total: Math.min(duration, 47), // stable-audio max ~47s
          steps: 100,
        },
        logs: false,
      });

      const data = result.data as Record<string, unknown>;
      const audioFile = data?.audio_file as { url: string } | undefined;

      if (audioFile?.url) {
        console.log(`[BRAIN AUDIO] AI music generated: ${audioFile.url}`);
        return {
          type: "music",
          url: audioFile.url,
          duration: Math.min(duration, 47),
          metadata: {
            source: "ai-generated",
            model: FAL_STABLE_AUDIO,
            prompt,
            mood,
            tempo,
            genre: genre || "cinematic",
            needsTrim: false,
            targetDuration: duration,
          },
        };
      }
    } catch (err) {
      console.warn("[BRAIN AUDIO] AI music generation failed, falling back to library:", err);
    }
  }

  // --- Fallback: Match from built-in library ---
  const moodLower = mood.toLowerCase();
  const tempoMap = { slow: [60, 90], medium: [90, 130], fast: [130, 180] };
  const [minBpm, maxBpm] = tempoMap[tempo] || [90, 130];

  let bestTrack = BUILT_IN_AUDIO_TRACKS.find((t) => {
    const genreMatch = !genre || t.genre.toLowerCase().includes(genre.toLowerCase());
    const moodMatch = moodLower.split(" ").some((word) =>
      t.name.toLowerCase().includes(word) || t.genre.toLowerCase().includes(word)
    );
    const bpmMatch = !t.bpm || (t.bpm >= minBpm && t.bpm <= maxBpm);
    return (genreMatch || moodMatch) && bpmMatch;
  });

  if (!bestTrack) {
    bestTrack = BUILT_IN_AUDIO_TRACKS.find((t) =>
      t.genre.toLowerCase().includes(tempo === "slow" ? "ambient" : tempo === "fast" ? "electronic" : "cinematic")
    );
  }

  if (!bestTrack && BUILT_IN_AUDIO_TRACKS.length > 0) {
    bestTrack = BUILT_IN_AUDIO_TRACKS[0];
  }

  if (bestTrack) {
    return {
      type: "music",
      url: bestTrack.url,
      duration: bestTrack.duration,
      metadata: {
        source: "built-in",
        trackName: bestTrack.name,
        genre: bestTrack.genre,
        bpm: bestTrack.bpm,
        needsTrim: bestTrack.duration > duration,
        targetDuration: duration,
      },
    };
  }

  // No tracks available — assembly worker can use its own music library
  return {
    type: "music",
    url: "",
    duration,
    metadata: {
      mood,
      tempo,
      genre: genre || "ambient",
      generateInAssembly: true,
    },
  };
}

// ---- CAPTION GENERATION ----

/**
 * Generate SRT captions from voiceover script and timings
 */
export function generateCaptions(
  script: string,
  timings: VoiceoverTiming[]
): AudioResult {
  if (!script || !timings || timings.length === 0) {
    // Generate timings from script if not provided
    const words = script.trim().split(/\s+/);
    const wordsPerSecond = 2.5;
    const entries: CaptionEntry[] = [];

    let currentTime = 0.5;
    const chunkSize = 8; // words per caption line
    let index = 1;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      const chunkDuration = (Math.min(chunkSize, words.length - i) / wordsPerSecond);
      const startTime = currentTime;
      const endTime = currentTime + chunkDuration;

      entries.push({
        index,
        startTime: formatSrtTime(startTime),
        endTime: formatSrtTime(endTime),
        text: chunk,
      });

      currentTime = endTime + 0.2; // Small gap between captions
      index++;
    }

    const srtContent = entries
      .map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`)
      .join("\n");

    return {
      type: "captions",
      url: "", // SRT content is stored as metadata, uploaded during assembly
      duration: currentTime,
      metadata: {
        srtContent,
        captionCount: entries.length,
        entries,
      },
    };
  }

  // Build SRT from provided timings
  const entries: CaptionEntry[] = timings.map((t, i) => ({
    index: i + 1,
    startTime: formatSrtTime(t.startTime),
    endTime: formatSrtTime(t.endTime),
    text: t.text,
  }));

  const srtContent = entries
    .map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`)
    .join("\n");

  return {
    type: "captions",
    url: "",
    duration: timings[timings.length - 1]?.endTime || 0,
    metadata: {
      srtContent,
      captionCount: entries.length,
      entries,
    },
  };
}

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

// ---- MMAUDIO V2 — Video-to-Audio (for silent models) ----

/**
 * Generate synchronized audio for a silent video using MMAudio V2.
 * MMAudio watches the video and generates matching audio (ambient, foley, effects).
 * Cost: ~$0.001/sec via FAL.AI
 *
 * @param videoUrl - URL to the silent video
 * @param prompt - Audio description (ambient sounds, effects to generate)
 * @param duration - Video duration in seconds
 * @param negativePrompt - Sounds to avoid
 */
export async function generateVideoAudio(
  videoUrl: string,
  prompt: string,
  duration: number,
  negativePrompt?: string
): Promise<AudioResult> {
  if (!videoUrl) {
    throw new Error("Video URL required for MMAudio generation");
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn("[BRAIN AUDIO] FAL_KEY not set — skipping MMAudio");
    return {
      type: "mmaudio",
      url: "",
      duration,
      metadata: { skipped: true, reason: "FAL_KEY not configured" },
    };
  }

  try {
    console.log(`[BRAIN AUDIO] MMAudio V2: generating audio for ${duration}s video`);

    const result = await fal.subscribe("fal-ai/mmaudio-v2", {
      input: {
        video_url: videoUrl,
        prompt: prompt || "natural ambient audio matching the video content",
        negative_prompt: negativePrompt || "silence, static noise, distortion, music",
        num_steps: 25,
        duration: duration,
        cfg_strength: 4.5,
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const audioData = data?.audio as { url: string } | undefined;

    if (!audioData?.url) {
      console.warn("[BRAIN AUDIO] MMAudio returned no audio URL");
      return { type: "mmaudio", url: "", duration, metadata: { error: "no_url" } };
    }

    console.log(`[BRAIN AUDIO] MMAudio V2 complete: ${audioData.url}`);
    return {
      type: "mmaudio",
      url: audioData.url,
      duration,
      metadata: { model: "mmaudio-v2", prompt },
    };
  } catch (err) {
    console.error("[BRAIN AUDIO] MMAudio V2 failed:", err);
    return {
      type: "mmaudio",
      url: "",
      duration,
      metadata: { error: String(err) },
    };
  }
}

/**
 * Build an audio description prompt from a scene's soundDesign for MMAudio.
 * Converts structured sound design into a natural language audio prompt.
 */
export function buildAudioPromptFromSoundDesign(soundDesign?: SoundDesign): string {
  if (!soundDesign) return "natural ambient audio";

  const parts: string[] = [];

  if (soundDesign.ambientDescription) {
    parts.push(soundDesign.ambientDescription);
  }

  if (soundDesign.sfxCues?.length > 0) {
    parts.push(soundDesign.sfxCues.join(", "));
  }

  if (soundDesign.dialogueLines?.length > 0) {
    const dialogueDesc = soundDesign.dialogueLines
      .map((d) => `${d.speaker} saying "${d.line}"`)
      .join(", ");
    parts.push(dialogueDesc);
  }

  return parts.join(". ") || "natural ambient audio";
}

// ---- ASYNC FAL QUEUE — Submit & Poll (avoids Vercel timeout) ----

/**
 * Submit MMAudio V2 job to FAL queue (async, returns immediately)
 */
export async function submitMMAudioJob(
  videoUrl: string,
  prompt: string,
  duration: number,
  negativePrompt?: string
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/mmaudio-v2", {
    input: {
      video_url: videoUrl,
      prompt: prompt || "natural ambient audio matching the video content",
      negative_prompt: negativePrompt || "silence, static noise, distortion, music",
      num_steps: 25,
      duration,
      cfg_strength: 4.5,
    },
  });
  return { requestId: result.request_id };
}

/**
 * Submit merge-audio-video job to FAL queue (async)
 */
export async function submitMergeAudioVideoJob(
  videoUrl: string,
  audioUrl: string
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/ffmpeg-api/merge-audio-video", {
    input: { video_url: videoUrl, audio_url: audioUrl },
  });
  return { requestId: result.request_id };
}

/**
 * Submit merge-videos (concat) job to FAL queue (async)
 */
export async function submitMergeVideosJob(
  videoUrls: string[]
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/ffmpeg-api/merge-videos", {
    input: { video_urls: videoUrls },
  });
  return { requestId: result.request_id };
}

/**
 * Check FAL queue job status (generic — works for any FAL model)
 */
export async function checkFalQueueStatus(
  falModelId: string,
  requestId: string
): Promise<{ status: string; error?: string }> {
  try {
    const status = await fal.queue.status(falModelId, { requestId, logs: false });
    return { status: status.status };
  } catch (err) {
    return { status: "FAILED", error: String(err) };
  }
}

/**
 * Get FAL queue job result (generic)
 */
export async function getFalQueueResult(
  falModelId: string,
  requestId: string
): Promise<Record<string, unknown>> {
  const result = await fal.queue.result(falModelId, { requestId });
  return result.data as Record<string, unknown>;
}

/**
 * Submit a compose job that layers video + voiceover + music into a single output.
 * Uses fal-ai/ffmpeg-api/compose with multiple tracks.
 * This replaces the broken amix approach — compose natively supports
 * layering multiple audio tracks on top of a video.
 *
 * @param videoUrl - Concatenated scene video
 * @param voiceoverUrl - Voiceover audio (full volume)
 * @param musicUrl - Background music (will be at same volume — consider pre-processing with loudnorm)
 * @param durationMs - Total duration in milliseconds
 */
export async function submitComposeVideoJob(
  videoUrl: string,
  voiceoverUrl: string | undefined,
  musicUrl: string | undefined,
  durationMs: number,
  musicDurationMs?: number,
  voiceoverClips?: Array<{ url: string; startMs: number; durationMs: number }>,
  soundDesignClips?: {
    ambient: Array<{ url: string; startMs: number; durationMs: number }>;
    sfx: Array<{ url: string; startMs: number; durationMs: number }>;
    foley: Array<{ url: string; startMs: number; durationMs: number }>;
  }
): Promise<{ requestId: string }> {
  const tracks: Array<{ id: string; type: string; keyframes: Array<{ timestamp: number; duration: number; url: string; volume?: number }> }> = [
    {
      id: "video-main",
      type: "video",
      keyframes: [{ timestamp: 0, duration: durationMs, url: videoUrl }],
    },
  ];

  // ── Volume Mixing Levels ──
  // Voiceover is KING — everything else sits underneath.
  // These are linear amplitude multipliers (0.0–1.0).
  const VOL_VOICEOVER = 1.0;   // Full volume — narrator must always be heard clearly
  const VOL_MUSIC     = 0.18;  // Quiet background bed, subtle emotional support
  const VOL_AMBIENT   = 0.12;  // Very subtle atmosphere — barely noticeable
  const VOL_SFX       = 0.25;  // Noticeable accent hits, but never louder than voice
  const VOL_FOLEY     = 0.15;  // Subtle texture — cloth rustle, footsteps, breathing

  // Per-scene voiceover clips take priority — each placed at its scene's timestamp
  if (voiceoverClips && voiceoverClips.length > 0) {
    tracks.push({
      id: "audio-voiceover",
      type: "audio",
      keyframes: voiceoverClips.map((c) => ({
        timestamp: c.startMs,
        duration: c.durationMs,
        url: c.url,
        volume: VOL_VOICEOVER,
      })),
    });
    console.log(`[AUDIO] Compose with ${voiceoverClips.length} per-scene voiceover clips (vol: ${VOL_VOICEOVER})`);
  } else if (voiceoverUrl) {
    // Fallback: single voiceover track
    tracks.push({
      id: "audio-voiceover",
      type: "audio",
      keyframes: [{ timestamp: 0, duration: durationMs, url: voiceoverUrl, volume: VOL_VOICEOVER }],
    });
  }

  if (musicUrl) {
    // If we know the music duration and it's shorter than the video,
    // tile the music with multiple keyframes so it loops seamlessly
    const musicKFs: Array<{ timestamp: number; duration: number; url: string; volume?: number }> = [];
    if (musicDurationMs && musicDurationMs > 0 && musicDurationMs < durationMs) {
      // Loop music by placing consecutive keyframes
      let offset = 0;
      while (offset < durationMs) {
        const remaining = durationMs - offset;
        const segDuration = Math.min(musicDurationMs, remaining);
        musicKFs.push({ timestamp: offset, duration: segDuration, url: musicUrl, volume: VOL_MUSIC });
        offset += musicDurationMs;
      }
      console.log(`[AUDIO] Music looped: ${musicKFs.length} segments to cover ${durationMs}ms (vol: ${VOL_MUSIC})`);
    } else {
      // Music is long enough or unknown duration — single keyframe
      musicKFs.push({ timestamp: 0, duration: durationMs, url: musicUrl, volume: VOL_MUSIC });
    }

    tracks.push({
      id: "audio-music",
      type: "audio",
      keyframes: musicKFs,
    });
  }

  // Hollywood Sound Design layers — ambient, SFX, foley placed at scene-accurate timestamps
  // Each layer has its own volume level to keep voiceover front and center.
  if (soundDesignClips) {
    if (soundDesignClips.ambient.length > 0) {
      tracks.push({
        id: "audio-ambient",
        type: "audio",
        keyframes: soundDesignClips.ambient.map((c) => ({
          timestamp: c.startMs,
          duration: c.durationMs,
          url: c.url,
          volume: VOL_AMBIENT,
        })),
      });
      console.log(`[AUDIO] Compose with ${soundDesignClips.ambient.length} ambient clips (vol: ${VOL_AMBIENT})`);
    }

    if (soundDesignClips.sfx.length > 0) {
      tracks.push({
        id: "audio-sfx",
        type: "audio",
        keyframes: soundDesignClips.sfx.map((c) => ({
          timestamp: c.startMs,
          duration: c.durationMs,
          url: c.url,
          volume: VOL_SFX,
        })),
      });
      console.log(`[AUDIO] Compose with ${soundDesignClips.sfx.length} SFX clips (vol: ${VOL_SFX})`);
    }

    if (soundDesignClips.foley.length > 0) {
      tracks.push({
        id: "audio-foley",
        type: "audio",
        keyframes: soundDesignClips.foley.map((c) => ({
          timestamp: c.startMs,
          duration: c.durationMs,
          url: c.url,
          volume: VOL_FOLEY,
        })),
      });
      console.log(`[AUDIO] Compose with ${soundDesignClips.foley.length} foley clips (vol: ${VOL_FOLEY})`);
    }
  }

  const result = await fal.queue.submit("fal-ai/ffmpeg-api/compose", {
    input: { tracks },
  });
  return { requestId: result.request_id };
}

/**
 * Speed-adjust a video to match a target duration using compose.
 * If targetDurationMs > actual duration → video plays in slow motion.
 * If targetDurationMs < actual duration → video plays faster.
 * The compose API stretches/compresses the video keyframe to fit the specified duration.
 *
 * @param videoUrl - Source video URL
 * @param targetDurationMs - Desired output duration in milliseconds
 */
/**
 * Trim a video to a specific duration using FAL's trim endpoint.
 * This is the reliable way to control output length — compose API ignores duration.
 */
export async function submitTrimVideoJob(
  videoUrl: string,
  endTimeSec: number
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/workflow-utilities/trim-video", {
    input: {
      video_url: videoUrl,
      start_time: 0,
      end_time: endTimeSec,
    },
  });
  console.log(`[AUDIO] Trim submitted: ${result.request_id} (0 → ${endTimeSec.toFixed(1)}s)`);
  return { requestId: result.request_id };
}

export async function submitSpeedAdjustJob(
  videoUrl: string,
  targetDurationMs: number
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/ffmpeg-api/compose", {
    input: {
      tracks: [{
        id: "speed-adjusted",
        type: "video",
        keyframes: [{
          timestamp: 0,
          duration: targetDurationMs,
          url: videoUrl,
        }],
      }],
    },
  });
  console.log(`[AUDIO] Speed-adjust submitted: ${result.request_id} (target: ${(targetDurationMs / 1000).toFixed(1)}s)`);
  return { requestId: result.request_id };
}

/**
 * Get actual media duration in seconds using FAL metadata endpoint.
 * Returns 0 if metadata cannot be retrieved.
 */
export async function getMediaDuration(mediaUrl: string): Promise<number> {
  try {
    const result = await fal.subscribe("fal-ai/ffmpeg-api/metadata", {
      input: { media_url: mediaUrl },
      logs: false,
    });
    const data = result.data as Record<string, unknown>;
    const media = data?.media as { duration?: number } | undefined;
    return media?.duration || 0;
  } catch (err) {
    console.warn("[AUDIO] Failed to get media duration:", err);
    return 0;
  }
}

/**
 * Reduce audio volume using FAL loudnorm endpoint.
 * Used to lower background music before composing with voiceover.
 *
 * @param audioUrl - Source audio URL
 * @param targetLufs - Target integrated loudness in LUFS (e.g. -24 for quiet background)
 */
export async function submitLoudnormJob(
  audioUrl: string,
  targetLufs: number = -24
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/ffmpeg-api/loudnorm", {
    input: {
      audio_url: audioUrl,
      integrated_loudness: targetLufs,
    },
  });
  return { requestId: result.request_id };
}

// ---- SCENE ASSEMBLY — FAL FFmpeg ----

/**
 * Assemble multiple scene videos into a single production video using FAL FFmpeg.
 * Concatenates videos in order, optionally mixing in voiceover and music tracks.
 *
 * @param sceneVideoUrls - Ordered array of scene video URLs
 * @param audioLayers - Optional audio tracks to mix (voiceover, music, mmaudio)
 * @returns URL to the assembled final video
 */
export async function assembleScenes(
  sceneVideoUrls: string[],
  audioLayers?: {
    voiceoverUrl?: string;
    musicUrl?: string;
    sceneAudioUrls?: Array<{ sceneIndex: number; audioUrl: string }>;
  }
): Promise<{ videoUrl: string; duration: number }> {
  if (sceneVideoUrls.length === 0) {
    throw new Error("No scene videos to assemble");
  }

  // Single scene — no assembly needed unless we need to mix audio
  if (sceneVideoUrls.length === 1 && !audioLayers?.voiceoverUrl && !audioLayers?.musicUrl) {
    return { videoUrl: sceneVideoUrls[0], duration: 0 };
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn("[BRAIN ASSEMBLY] FAL_KEY not set — returning first scene");
    return { videoUrl: sceneVideoUrls[0], duration: 0 };
  }

  try {
    console.log(`[BRAIN ASSEMBLY] Merging ${sceneVideoUrls.length} scenes via FAL merge-videos`);

    // Step 1: Merge all scene videos into one using FAL merge-videos endpoint
    const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: {
        video_urls: sceneVideoUrls,
      },
      logs: false,
    });

    const mergeData = mergeResult.data as Record<string, unknown>;
    const mergedVideo = mergeData?.video as { url: string } | undefined;

    if (!mergedVideo?.url) {
      throw new Error("merge-videos returned no output URL");
    }

    console.log(`[BRAIN ASSEMBLY] Videos merged: ${mergedVideo.url}`);
    let finalUrl = mergedVideo.url;

    // Step 2: Mix in voiceover/music if present
    const audioUrl = audioLayers?.voiceoverUrl || audioLayers?.musicUrl;
    if (audioUrl) {
      try {
        console.log(`[BRAIN ASSEMBLY] Mixing audio layer onto merged video`);
        const mixResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-audio-video", {
          input: {
            video_url: finalUrl,
            audio_url: audioUrl,
          },
          logs: false,
        });

        const mixData = mixResult.data as Record<string, unknown>;
        const mixedVideo = mixData?.video as { url: string } | undefined;

        if (mixedVideo?.url) {
          finalUrl = mixedVideo.url;
          console.log(`[BRAIN ASSEMBLY] Audio mixed: ${finalUrl}`);
        }
      } catch (audioErr) {
        console.warn("[BRAIN ASSEMBLY] Audio mixing failed, using video without audio layer:", audioErr);
      }
    }

    console.log(`[BRAIN ASSEMBLY] Assembly complete: ${finalUrl}`);
    return { videoUrl: finalUrl, duration: 0 };
  } catch (err) {
    console.error("[BRAIN ASSEMBLY] FFmpeg assembly failed:", err);
    // Fallback: return first scene
    return { videoUrl: sceneVideoUrls[0], duration: 0 };
  }
}

/**
 * Merge MMAudio-generated audio onto a silent video using FAL FFmpeg.
 * Used as post-processing for silent models (wan-2.2, ltx-video, etc.)
 */
export async function mergeAudioOntoVideo(
  videoUrl: string,
  audioUrl: string
): Promise<string> {
  if (!videoUrl || !audioUrl) return videoUrl;

  const falKey = process.env.FAL_KEY;
  if (!falKey) return videoUrl;

  try {
    console.log("[BRAIN AUDIO] Merging MMAudio onto silent video");

    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-audio-video", {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const video = data?.video as { url: string } | undefined;

    if (video?.url) {
      console.log("[BRAIN AUDIO] Audio merge complete");
      return video.url;
    }
    return videoUrl;
  } catch (err) {
    console.error("[BRAIN AUDIO] Audio merge failed:", err);
    return videoUrl;
  }
}

// ---- AVAILABLE VOICES ----

export const AVAILABLE_VOICES: Record<string, Array<{ id: string; name: string; gender: string }>> = {
  "en-US": [
    { id: "en-US-GuyNeural", name: "Adam (Natural)", gender: "male" },
    { id: "en-US-JennyNeural", name: "Heart (Warm)", gender: "female" },
    { id: "en-US-AriaNeural", name: "Bella (Expressive)", gender: "female" },
    { id: "en-US-DavisNeural", name: "Michael (Deep)", gender: "male" },
  ],
  "en-GB": [
    { id: "en-GB-RyanNeural", name: "Ryan", gender: "male" },
    { id: "en-GB-SoniaNeural", name: "Sonia", gender: "female" },
  ],
  "es-ES": [
    { id: "es-ES-AlvaroNeural", name: "Alvaro", gender: "male" },
    { id: "es-ES-ElviraNeural", name: "Elvira", gender: "female" },
  ],
  "fr-FR": [
    { id: "fr-FR-HenriNeural", name: "Henri", gender: "male" },
    { id: "fr-FR-DeniseNeural", name: "Denise", gender: "female" },
  ],
  "zu-ZA": [
    { id: "zu-ZA-ThandoNeural", name: "Thando", gender: "female" },
    { id: "zu-ZA-ThembaNeural", name: "Themba", gender: "male" },
  ],
  "af-ZA": [
    { id: "af-ZA-WillemNeural", name: "Willem", gender: "male" },
    { id: "af-ZA-AdriNeural", name: "Adri", gender: "female" },
  ],
};

export const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese (BR)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "zh-CN", name: "Chinese (Mandarin)" },
  { code: "hi-IN", name: "Hindi" },
  { code: "ar-SA", name: "Arabic" },
  { code: "zu-ZA", name: "Zulu" },
  { code: "af-ZA", name: "Afrikaans" },
];

// ---- WHISPER TRANSCRIPTION — Word-level subtitle timing ----

/**
 * Submit a Whisper transcription job for word-level subtitle timing.
 * Returns word-level timestamps that can be used for precisely-timed captions.
 */
export async function submitWhisperJob(
  audioUrl: string
): Promise<{ requestId: string }> {
  const result = await fal.queue.submit("fal-ai/whisper", {
    input: {
      audio_url: audioUrl,
      task: "transcribe",
      chunk_level: "segment",
    },
  });
  return { requestId: result.request_id };
}

/**
 * Transcribe audio synchronously via Whisper for word-level subtitle timing.
 * Returns segments with start/end timestamps and text.
 */
export async function transcribeForSubtitles(
  audioUrl: string
): Promise<Array<{ start: number; end: number; text: string }>> {
  try {
    const result = await fal.subscribe("fal-ai/whisper", {
      input: {
        audio_url: audioUrl,
        task: "transcribe",
        chunk_level: "segment",
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const chunks = data?.chunks as Array<{ timestamp: [number, number]; text: string }> | undefined;

    if (!chunks || chunks.length === 0) {
      console.warn("[AUDIO] Whisper returned no chunks");
      return [];
    }

    const segments = chunks.map((chunk) => ({
      start: chunk.timestamp[0],
      end: chunk.timestamp[1],
      text: chunk.text.trim(),
    }));

    console.log(`[AUDIO] Whisper transcription: ${segments.length} segments`);
    return segments;
  } catch (err) {
    console.warn("[AUDIO] Whisper transcription failed:", err);
    return [];
  }
}

/**
 * Generate word-level subtitles from per-scene voiceover clips.
 * Transcribes each clip and adjusts timestamps to the full video timeline.
 */
export async function generateWordLevelSubtitles(
  clips: Array<{ url: string; startMs: number; durationMs: number; sceneNumber: number }>,
): Promise<Array<{ start: number; end: number; text: string; sceneNumber: number }>> {
  const allSubtitles: Array<{ start: number; end: number; text: string; sceneNumber: number }> = [];

  // Transcribe each clip in parallel
  const transcriptionPromises = clips.map(async (clip) => {
    try {
      const segments = await transcribeForSubtitles(clip.url);
      // Adjust timestamps to global timeline (clip.startMs is in ms, segments use seconds)
      const globalOffsetSec = clip.startMs / 1000;
      return segments.map((seg) => ({
        start: seg.start + globalOffsetSec,
        end: seg.end + globalOffsetSec,
        text: seg.text,
        sceneNumber: clip.sceneNumber,
      }));
    } catch {
      return [];
    }
  });

  const results = await Promise.all(transcriptionPromises);
  for (const segments of results) {
    allSubtitles.push(...segments);
  }

  // Sort by start time
  allSubtitles.sort((a, b) => a.start - b.start);

  console.log(`[AUDIO] Word-level subtitles: ${allSubtitles.length} entries across ${clips.length} scenes`);
  return allSubtitles;
}

// ---- VOICEOVER LOUDNORM — Normalize voiceover clips for consistent volume ----

/**
 * Submit a loudnorm job for a voiceover clip to bring it to dialogue standard.
 * Target: -14 LUFS (broadcast dialogue standard — clearly audible above music at -28 LUFS)
 */
export async function submitVoiceoverLoudnormJob(
  audioUrl: string
): Promise<{ requestId: string }> {
  return submitLoudnormJob(audioUrl, -14);
}

/**
 * Submit a loudnorm job for the final composed video.
 * Normalizes the entire output so there are no sudden volume jumps between scenes.
 * Target: -16 LUFS (broadcast standard for mixed content)
 */
export async function submitFinalNormJob(
  videoUrl: string
): Promise<{ requestId: string }> {
  // Use loudnorm on the video's audio track
  // The loudnorm endpoint accepts audio_url — for videos, it extracts the audio track
  const result = await fal.queue.submit("fal-ai/ffmpeg-api/loudnorm", {
    input: {
      audio_url: videoUrl,
      integrated_loudness: -16,
    },
  });
  return { requestId: result.request_id };
}
