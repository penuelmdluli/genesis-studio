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
import { voiceForCharacter } from "@/lib/series/cast";
import { speakOmnivoice } from "@/lib/series/omnivoice";
import { getDb } from "@/lib/db-driver";
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

/**
 * Lip sync applied to a MOVING shot, rather than to a still photograph.
 *
 * The old path animated a still: the mouth moved and nothing else, which is
 * why the episodes looked like slideshows. Now every shot is filmed first —
 * real camera movement, real body language — and the speech is matched onto
 * it afterwards. Verified to preserve 1080x1920 and the motion.
 */
const LIPSYNC_VIDEO_MODEL = "sync/lipsync-2";

/**
 * Shots are built FROM a reference photograph of the character, not from a
 * description of them.
 *
 * Describing a face in words and hoping the model draws the same one each
 * time is why characters drifted between shots and why episodes read as
 * fake. Handing the model a picture of the person and asking for a new shot
 * of THEM keeps the face, the clothes and the build while framing, setting
 * and action change freely — which is what finally allowed wide shots with
 * real action instead of endless close-ups.
 */
const REFERENCE_SHOT_MODEL = "google/nano-banana-pro/edit";

/** Submits the speech pass onto an already-moving shot. */
export async function submitLipsync(videoUrl: string, audioUrl: string): Promise<string> {
  const prediction = await submitWsModel(LIPSYNC_VIDEO_MODEL, {
    video: videoUrl,
    audio: audioUrl,
    sync_mode: "loop",
  });
  return prediction.id;
}

/** Submits the finishing pass. The caller keeps the original either way. */
export async function submitUpscale(clipUrl: string): Promise<string> {
  const prediction = await submitWsModel(UPSCALE_MODEL, {
    video: clipUrl,
    target_resolution: "1080p",
  });
  return prediction.id;
}

/**
 * Framing comes from the shot size the writer chose, not from the emotion.
 *
 * The old map put a close-up on nearly every beat, which is the single most
 * common mistake in vertical drama and exactly why the episodes read as flat
 * and fake. Medium carries dialogue, close-up is saved for the line that has
 * to land, wide is rare because 9:16 wastes width on a phone, and an insert
 * carries no face at all.
 */
const SHOT_FRAMING: Record<string, string> = {
  wide:
    "wide establishing shot, full environment visible, characters small in frame, deep focus, the place itself doing the work",
  medium:
    "medium shot framed from the waist up, subject slightly above centre, shallow depth of field, background falling away",
  close:
    "tight close-up on the face, eyes high in frame, very shallow depth of field, background completely soft",
  insert:
    "extreme close-up detail insert with no face in shot, shallow focus on the object and the hands",
};

/** Emotion colours the light and the performance, not the lens. */
const EMOTION_TONE: Record<string, string> = {
  calm: "soft natural light, relaxed posture",
  angry: "hard side light, jaw set, shoulders squared",
  afraid: "low key light, tense posture, eyes searching",
  joyful: "warm golden light, open expression",
  grieving: "muted desaturated light, shoulders low",
  tense: "high contrast light, body rigid, held breath",
  shocked: "stark light, body recoiling, eyes wide",
};

/**
 * Movement direction added to every shot.
 *
 * Without this the models return something close to a photograph, which is
 * exactly the complaint: no action, nothing alive. Naming the camera and the
 * body separately is what gets both to move.
 */
const MOTION_BY_EMOTION: Record<string, string> = {
  calm: "the camera drifts slowly, the character shifts their weight and gestures while talking",
  angry: "the camera pushes in hard, the character leans forward, jabs a finger, shoulders rising",
  afraid: "the camera shakes subtly, the character backs away, glancing over their shoulder",
  joyful: "the camera rises gently, the character laughs, hands moving, head tilting back",
  grieving: "the camera creeps closer, the character's shoulders fall, head lowering, breath catching",
  tense: "the camera circles slowly, the character stands rigid, fists tightening",
  shocked: "the camera snaps closer, the character recoils, eyes widening, a step backwards",
};

/** Movement for a shot with nobody speaking in it. */
const MOTION_BY_SHOT: Record<string, string> = {
  wide: "the camera cranes slowly across the space, traffic and people moving through the background",
  insert: "the camera pushes in on the detail, hands entering frame and moving",
};

/**
 * What must NOT be in the picture.
 *
 * A dialogue frame with a bystander in it gets that bystander's mouth
 * animated too, so the audience cannot tell who is speaking — and stray
 * extras were turning up in shots that should have held one person.
 */
// "no text" alone did not stop the model printing words onto clothing: a
// security guard came out wearing POLICE across her chest in shot after
// shot, which changes who she is. Lettering on garments is named explicitly.
const NEGATIVE =
  "no bystanders, no crowd, no extra people, no onlookers, no text, no watermark, no split screen, " +
  "no printed words, letters, badges, insignia or logos on any clothing or uniform";

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
  const framing = SHOT_FRAMING[shot.shotSize] || SHOT_FRAMING.medium;
  const tone = EMOTION_TONE[shot.emotion] || EMOTION_TONE.calm;

  // An insert has no face in it, so the locked character description would
  // only confuse the model.
  // Kept for the fallback path. When a reference photograph is used the
  // model is looking at the person, so leading with "the same person" beats
  // re-describing them.
  const character =
    shot.shotSize === "insert" || !ctx.characterDescription
      ? ""
      : `The same person from the reference photograph. ${ctx.characterDescription}. `;

  // A speaking shot holds ONE person. With two people in frame the lip-sync
  // model animates both mouths, so the audience cannot tell who is talking.
  const solo =
    shot.kind === "dialogue" && shot.shotSize !== "insert"
      ? `Only ${shot.speaker} is visible, completely alone in frame. `
      : "";

  return [
    character,
    solo,
    shot.action,
    `${framing}, ${tone}.`,
    "Cinematic South African drama, photoreal, film grain, natural skin texture, 35mm.",
    NEGATIVE + ".",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

/** Motion direction. Every shot moves now, speaking ones included. */
export function buildShotMotionPrompt(shot: Shot): string {
  const motion =
    shot.kind === "dialogue"
      ? MOTION_BY_EMOTION[shot.emotion] || MOTION_BY_EMOTION.calm
      : MOTION_BY_SHOT[shot.shotSize] || MOTION_BY_EMOTION[shot.emotion] || MOTION_BY_EMOTION.calm;

  const speaking =
    shot.kind === "dialogue"
      ? "The character is talking to someone off camera, mouth moving, expressive. "
      : "";

  return `${shot.action}. ${speaking}${motion}. Cinematic handheld camera movement, dramatic, photoreal.`.slice(
    0,
    600
  );
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
 * The series' reference photograph, made once and reused for every shot of
 * every episode. Stored on the series so it survives between renders.
 */
export async function ensureCharacterReference(
  seriesId: string,
  ctx: RenderContext
): Promise<string | null> {
  const db = getDb();
  const { data: series } = await db
    .from("series")
    .select("character_image_url, character_description")
    .eq("id", seriesId)
    .maybeSingle();

  if (series?.character_image_url) return series.character_image_url;

  const description = series?.character_description || ctx.characterDescription;
  if (!description) return null;

  try {
    const portrait = await runWsModelSync(WS_MODELS.textToImage, {
      prompt:
        `${description}. Full body portrait standing in a South African township street, ` +
        `neutral expression, facing camera, even daylight. ` +
        `Photoreal, 35mm, natural skin texture. ${NEGATIVE}.`,
      size: "768*1344",
    });
    const url = Array.isArray(portrait?.outputs) ? String(portrait.outputs[0] || "") : "";
    if (!url) return null;

    await db.from("series").update({ character_image_url: url }).eq("id", seriesId);
    return url;
  } catch (err) {
    console.error("[SERIES] could not make a character reference:", err);
    return null;
  }
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
  tag: string,
  seriesId?: string
): Promise<SubmittedShot> {
  // 1. The still, built from a photograph of the character wherever we have
  //    one. An insert has no face in it, so it needs no reference.
  const prompt = buildShotImagePrompt(shot, ctx);
  const reference = shot.shotSize === "insert" || !seriesId ? null : await ensureCharacterReference(seriesId, ctx);

  let imageUrl = "";
  if (reference) {
    try {
      const edited = await runWsModelSync(
        REFERENCE_SHOT_MODEL,
        { prompt, images: [reference], output_format: "png" },
        { timeoutMs: 150_000 }
      );
      imageUrl = Array.isArray(edited?.outputs) ? String(edited.outputs[0] || "") : "";
    } catch (err) {
      // Falling back to a described shot is worse but still a shot.
      console.error("[SERIES] reference shot failed, describing instead:", err);
    }
  }

  if (!imageUrl) {
    const image = await runWsModelSync(WS_MODELS.textToImage, {
      prompt,
      size: ctx.aspectRatio === "9:16" ? "768*1344" : "1344*768",
    });
    imageUrl = Array.isArray(image?.outputs) ? String(image.outputs[0] || "") : "";
  }
  if (!imageUrl) throw new Error("Could not compose this shot");

  // 2. Speech, when there is any. The voice comes from the series cast, so a
  //    character sounds the same in every episode they appear in.
  let audioUrl: string | null = null;
  if (shot.kind === "dialogue" && shot.dialogue.trim() && seriesId && localeOrDefault(ctx.language).provider === "omnivoice") {
    // Languages with no named voice are spoken by cloning the character's own
    // sample, made during casting — see src/lib/series/omnivoice.ts.
    audioUrl = await speakOmnivoice(seriesId, shot.speaker, shot.dialogue, userId, tag);
  } else if (shot.kind === "dialogue" && shot.dialogue.trim()) {
    const gender = shot.gender === "female" || shot.gender === "male" ? shot.gender : guessGender(shot.speaker);
    const cast = seriesId
      ? await voiceForCharacter(seriesId, shot.speaker, gender, ctx.language)
      : { voice: voiceForSpeaker(shot.speaker, ctx, gender), ...voiceCharacter(shot.speaker) };
    audioUrl = await synthesiseLine(shot.dialogue, cast.voice, userId, tag, {
      pitch: cast.pitch,
      rate: cast.rate,
    });
  }

  // 3. Film it. EVERY shot is filmed, speaking ones included — that is the
  //    difference between a scene and a slideshow. Speech is matched onto the
  //    moving footage afterwards, in the polling stage.
  const prediction = await submitWsModel(SCENE_VIDEO_MODEL, {
    image: imageUrl,
    prompt: buildShotMotionPrompt(shot),
    duration: 5,
  });

  return { imageUrl, audioUrl, providerRef: prediction.id };
}
