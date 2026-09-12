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
import { guessGender } from "@/lib/series/writer";
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

/** A stable number per character name, so choices never drift between episodes. */
function nameHash(speaker: string): number {
  let hash = 0;
  for (const ch of speaker.toLowerCase().trim()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * The voice for a speaker.
 *
 * Gender comes from the writer, who invented the character — it used to come
 * from a hash of the name, which is how a woman called Nomsa spoke in a man's
 * voice.
 */
export function voiceForSpeaker(
  speaker: string,
  ctx: RenderContext,
  gender?: "female" | "male"
): string {
  const locale = localeOrDefault(ctx.language);
  if (gender === "female") return locale.female;
  if (gender === "male") return locale.male;
  // Scripts written before the writer recorded gender carry none, so fall
  // back to the name rather than to a coin flip — the whole point of the fix
  // is that Nomsa does not speak in a man's voice.
  return guessGender(speaker) === "female" ? locale.female : locale.male;
}

/**
 * Most languages give us exactly one female and one male voice, so two men in
 * a scene would otherwise be the same person talking to himself. Each
 * character gets a small, fixed shift in pitch and pace — enough to tell them
 * apart, not enough to sound processed. Derived from the name, so a character
 * sounds the same in episode 9 as in episode 1.
 */
export function voiceCharacter(speaker: string): { pitch: string; rate: string } {
  const hash = nameHash(speaker);
  const pitches = ["+0Hz", "-12Hz", "+10Hz", "-6Hz", "+16Hz", "-18Hz"];
  const rates = ["+0%", "-6%", "+5%", "-3%", "+8%", "-9%"];
  return {
    pitch: pitches[hash % pitches.length],
    rate: rates[(hash >>> 3) % rates.length],
  };
}

/** Speak one line, upload it, hand back a URL the lip-sync model can read. */
export async function synthesiseLine(
  text: string,
  voiceName: string,
  userId: string,
  tag: string,
  character?: { pitch: string; rate: string }
): Promise<string> {
  // The format is deliberately left at the default. Probed on 2026-09-12:
  // of every documented variant the speech service accepts only
  // audio-24khz-48kbitrate and audio-24khz-96kbitrate as mp3 — 48kHz and
  // 160/192kbps all return an empty stream rather than an error. We already
  // use the better of the two, so the ceiling on voice quality is the free
  // neural voice itself, not the encoding.
  const audio = await synthesiseSpeech(text, voiceName || "en-ZA-LeahNeural", {
    pitch: character?.pitch,
    rate: character?.rate,
  });
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
    audioUrl = await synthesiseLine(
      shot.dialogue,
      voiceForSpeaker(shot.speaker, ctx, shot.gender),
      userId,
      tag,
      voiceCharacter(shot.speaker)
    );
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
