// ============================================
// SERIES STUDIO — turning a script into a scene
// ============================================
// What separates this from a slideshow is that the characters actually
// speak. Each shot takes one of two paths:
//
//   dialogue → a still of that character, framed for the moment, plus the
//              line spoken in their own language, driven through an
//              audio-driven lip-sync model. The mouth matches the words.
//   action   → the same still driven through a cinematic image-to-video
//              model. Movement, no speech.
//
// Cutting between speaking characters shot by shot is not a compromise, it
// is how a dialogue scene has been shot since sound arrived. The result is a
// scene, not a talking head.
//
// Character consistency comes from one rule: the locked description string
// is injected into EVERY shot prompt, word for word, in every episode. Drift
// happens when wording drifts, so the wording never changes.

import { submitWsModel, runWsModelSync, WS_MODELS } from "@/lib/wavespeed-tools";
import type { Shot, SeriesLanguage } from "@/lib/series/writer";
import { localeOrDefault } from "@/lib/series/locales";
import { synthesiseSpeech } from "@/lib/edge-tts";

/** Cinematic i2v. Funded, and the strongest dramatic motion we have. */
const SCENE_VIDEO_MODEL = "bytedance/seedance-v1.5-pro/image-to-video";

/**
 * Every shot is finished at 1080p.
 *
 * The lip-sync model returns about 352x624 — fine on its own, but next to a
 * cinematic action shot in the same episode it reads as a different
 * production. Uniformity matters more here than any single shot does, and at
 * well under a cent a shot there is no reason to accept the mismatch.
 */
const UPSCALE_MODEL = "bytedance/video-upscaler";

/** Submits the finishing pass. The caller keeps the original either way. */
export async function submitUpscale(clipUrl: string): Promise<string> {
  const prediction = await submitWsModel(UPSCALE_MODEL, {
    video: clipUrl,
    target_resolution: "1080p",
  });
  return prediction.id;
}

/** How each beat is shot. Emotion drives the lens, not just the face. */
const EMOTION_FRAMING: Record<string, string> = {
  calm: "medium shot, soft natural light, steady camera",
  angry: "tight close-up, hard side light, slight handheld tension",
  afraid: "close-up, low key lighting, shallow focus, unsettled framing",
  joyful: "medium shot, warm golden light, gentle push in",
  grieving: "close-up, muted desaturated light, still camera, quiet",
  tense: "tight two-shot framing, high contrast, shallow depth of field",
  shocked: "sudden close-up, sharp focus on the eyes, stark light",
};

export interface RenderContext {
  language: SeriesLanguage;
  /** Locked, reused verbatim in every shot of every episode. */
  characterDescription: string | null;
  characterName: string | null;
  aspectRatio: "9:16" | "16:9";
}

/**
 * The still for one shot. The locked character description leads, so the
 * model resolves the face before it resolves anything else.
 */
export function buildShotImagePrompt(shot: Shot, ctx: RenderContext): string {
  const framing = EMOTION_FRAMING[shot.emotion] || EMOTION_FRAMING.calm;
  const character = ctx.characterDescription
    ? `${ctx.characterDescription}. `
    : "";
  return [
    character,
    shot.action,
    `${framing}.`,
    "Cinematic South African drama, photoreal, film grain, natural skin texture, 35mm.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

/** Motion direction for a shot that carries no dialogue. */
export function buildShotMotionPrompt(shot: Shot): string {
  return `${shot.action}. Cinematic camera movement, dramatic, photoreal, ${
    EMOTION_FRAMING[shot.emotion] || EMOTION_FRAMING.calm
  }.`.slice(0, 600);
}

/** Performance direction for a speaking shot — what the lip-sync model reads. */
export function buildPerformancePrompt(shot: Shot): string {
  const performance: Record<string, string> = {
    calm: "speaking naturally, composed",
    angry: "speaking with controlled fury, jaw tight",
    afraid: "speaking unsteadily, eyes darting",
    joyful: "speaking brightly, smiling between words",
    grieving: "speaking quietly, voice breaking",
    tense: "speaking low and guarded",
    shocked: "speaking in disbelief, breath catching",
  };
  return `A person ${performance[shot.emotion] || performance.calm}. Accurate lip sync, natural head movement and expression.`;
}

/** Pick the voice for a speaker, keeping the same speaker on the same voice. */
export function voiceForSpeaker(speaker: string, ctx: RenderContext): string {
  const locale = localeOrDefault(ctx.language);
  // Stable per name: the same character keeps the same voice for the life of
  // the series, without anyone having to record the choice anywhere.
  let hash = 0;
  for (const ch of speaker.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 2 === 0 ? locale.female : locale.male;
}

/** Speak one line, upload it, hand back a URL the lip-sync model can read. */
export async function synthesiseLine(
  text: string,
  voiceName: string,
  userId: string,
  tag: string
): Promise<string> {
  const audio = await synthesiseSpeech(text, voiceName || "en-ZA-LeahNeural");
  const buf = Buffer.from(audio);
  if (buf.length === 0) throw new Error("No audio was produced for this line");

  const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
  const key = audioStorageKey(userId, `series-${tag}`);
  await uploadAudio(key, buf);
  return r2PublicUrl(key);
}

export interface SubmittedShot {
  imageUrl: string;
  audioUrl: string | null;
  providerRef: string;
}

/**
 * Renders one shot. Returns as soon as the video job is accepted — the clip
 * is polled later like every other hosted job, so a nine-shot episode does
 * not hold a request open for ten minutes.
 */
export async function submitShot(
  shot: Shot,
  ctx: RenderContext,
  userId: string,
  tag: string
): Promise<SubmittedShot> {
  // 1. The still. Same character wording every time.
  const image = await runWsModelSync(WS_MODELS.textToImage, {
    prompt: buildShotImagePrompt(shot, ctx),
    size: ctx.aspectRatio === "9:16" ? "768*1344" : "1344*768",
  });
  const imageUrl = Array.isArray(image?.outputs) ? String(image.outputs[0] || "") : "";
  if (!imageUrl) throw new Error("Could not compose this shot");

  // 2. Speech, when there is any.
  let audioUrl: string | null = null;
  if (shot.kind === "dialogue" && shot.dialogue.trim()) {
    audioUrl = await synthesiseLine(shot.dialogue, voiceForSpeaker(shot.speaker, ctx), userId, tag);
  }

  // 3. Motion. Speaking shots go through lip sync; the rest get cinematic
  //    motion. This branch is the whole difference between a series people
  //    watch and a slideshow they scroll past.
  const prediction = audioUrl
    ? await submitWsModel(WS_MODELS.lipsyncFromImage, {
        image: imageUrl,
        audio: audioUrl,
        prompt: buildPerformancePrompt(shot),
      })
    : await submitWsModel(SCENE_VIDEO_MODEL, {
        image: imageUrl,
        prompt: buildShotMotionPrompt(shot),
        duration: 5,
      });

  return { imageUrl, audioUrl, providerRef: prediction.id };
}
