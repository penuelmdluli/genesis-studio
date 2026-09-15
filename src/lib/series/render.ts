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
import { styleSpec, type VisualStyle } from "@/lib/series/style";

// The video model now comes from the series style (src/lib/series/style.ts):
// drama films on Seedance 1.5 Pro, action and cartoon on Seedance 2.5.

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

/**
 * Natural sound for a finished shot. Measured 2026-09-14 on the marketing
 * films: $0.05 a shot, and it is the difference between a clip that feels
 * alive and one that feels dead. Speech and music are excluded here — the
 * voices are ours and the score is laid in at assembly.
 */
const FOLEY_MODEL = "wavespeed-ai/hunyuan-video-foley";

export async function submitFoley(clipUrl: string, action: string): Promise<string> {
  const prediction = await submitWsModel(FOLEY_MODEL, {
    video: clipUrl,
    prompt: `${action}`.slice(0, 300) + ". Realistic sound effects and ambience only, no music, no speech, no singing.",
    seed: -1,
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

const NEGATIVE_LIGHT = "no text, no watermark, no split screen, no printed words, letters or logos on clothing";

export interface RenderContext {
  language: SeriesLanguage;
  /** Locked, reused verbatim in every shot of every episode. */
  characterDescription: string | null;
  characterName: string | null;
  aspectRatio: "9:16" | "16:9";
  /** The look of the series, from its genre. Drama when absent. */
  style?: VisualStyle;
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
    styleSpec(ctx.style).look,
    // An action or cartoon set piece is allowed its crowd, its villain and its
    // cheering village; only a speaking frame must hold one person.
    (shot.kind === "action" && styleSpec(ctx.style).blockbuster ? NEGATIVE_LIGHT : NEGATIVE) + ".",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

/** Motion direction. Every shot moves now, speaking ones included. */
export function buildShotMotionPrompt(shot: Shot, style?: VisualStyle): string {
  const motion =
    shot.kind === "dialogue"
      ? MOTION_BY_EMOTION[shot.emotion] || MOTION_BY_EMOTION.calm
      : MOTION_BY_SHOT[shot.shotSize] || MOTION_BY_EMOTION[shot.emotion] || MOTION_BY_EMOTION.calm;

  const speaking =
    shot.kind === "dialogue"
      ? "The character is talking to someone off camera, mouth moving, expressive. "
      : "";

  return `${shot.action}. ${speaking}${motion}. ${styleSpec(style).motion}`.slice(
    0,
    600
  );
}

/**
 * English dialogue is spoken by the video model itself.
 *
 * Tested side by side on 2026-09-15 (same still, same line): the model's own
 * voice delivered the line with real intonation and kept the face, while our
 * synthesised voice plus lip sync read flat and let the face drift. So a
 * speaking shot in any English locale is filmed WITH its audio and needs no
 * voice or lip-sync pass. Other languages keep the voice + lip-sync chain —
 * the models only speak the big languages well, and isiZulu is the point.
 */
export function speaksNatively(shot: Shot, language: string | null | undefined): boolean {
  if (shot.kind !== "dialogue" || !shot.dialogue.trim()) return false;
  const locale = localeOrDefault(language);
  return locale.id.startsWith("en-") && locale.provider !== "omnivoice";
}

const ACCENT: Record<string, string> = {
  "en-ZA": "a South African English accent",
  "en-NG": "a Nigerian English accent",
  "en-KE": "a Kenyan English accent",
  "en-TZ": "a Tanzanian English accent",
  "en-GB": "a British accent",
  "en-US": "an American accent",
  "en-AU": "an Australian accent",
  "en-IE": "an Irish accent",
  "en-IN": "an Indian English accent",
};

const SAY_BY_EMOTION: Record<string, string> = {
  calm: "calmly",
  angry: "angrily, voice raised",
  afraid: "fearfully, voice shaking",
  joyful: "happily, smiling",
  grieving: "quietly, voice breaking",
  tense: "in a low, guarded voice",
  shocked: "in disbelief",
};

/** Motion prompt for a shot whose line is spoken by the video model. */
export function buildNativeDialoguePrompt(shot: Shot, style: VisualStyle | undefined, language: string | null | undefined): string {
  const motion = MOTION_BY_EMOTION[shot.emotion] || MOTION_BY_EMOTION.calm;
  const who = shot.gender === "male" ? "man" : "woman";
  const accent = ACCENT[localeOrDefault(language).id] || "a natural English accent";
  const line = shot.dialogue.replace(/["“”]/g, "'").replace(/\s+/g, " ").trim().slice(0, 220);
  const say = SAY_BY_EMOTION[shot.emotion] || SAY_BY_EMOTION.calm;
  // The line goes first so it survives the length cap; the look closes it.
  return (
    `The ${who} on screen says ${say}, in ${accent}: "${line}" ` +
    `Only this ${who} speaks, clear dialogue, lips matching every word, natural room sound, no music, no other voices. ` +
    `${shot.action}. ${motion}. ${styleSpec(style).motion}`
  ).slice(0, 900);
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
        `${description}. ${styleSpec(ctx.style).portrait} ${NEGATIVE}.`,
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
  character?: { pitch: string; rate: string; volume?: string }
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
    volume: character?.volume,
  });
  const buf = Buffer.from(audio);
  if (buf.length === 0) throw new Error("No audio was produced for this line");

  const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
  const key = audioStorageKey(userId, `series-${tag}`);
  await uploadAudio(key, buf);
  return r2PublicUrl(key);
}

/**
 * How hard a line is delivered. A warning shouted across a burning street
 * cannot be read in the same voice as a line across a kitchen table, so the
 * loud emotions lift pace, pitch and volume on top of the character's own
 * fixed voice. The shift is added to the cast offsets, so the character is
 * still recognisably themselves, just under pressure.
 */
const DELIVERY: Record<string, { pitch: number; rate: number; volume: number }> = {
  angry: { pitch: 6, rate: 8, volume: 35 },
  shocked: { pitch: 10, rate: 10, volume: 30 },
  afraid: { pitch: 8, rate: 12, volume: 20 },
  tense: { pitch: 2, rate: 6, volume: 15 },
  joyful: { pitch: 6, rate: 5, volume: 15 },
};

function shift(value: string | undefined, by: number, unit: string): string {
  const n = parseFloat(String(value || "0").replace(unit, "")) || 0;
  const total = Math.round(n + by);
  return `${total >= 0 ? "+" : ""}${total}${unit}`;
}

export function deliver(
  cast: { pitch: string; rate: string },
  emotion: string
): { pitch: string; rate: string; volume: string } {
  const d = DELIVERY[emotion] || { pitch: 0, rate: 0, volume: 0 };
  return {
    pitch: shift(cast.pitch, d.pitch, "Hz"),
    rate: shift(cast.rate, d.rate, "%"),
    volume: `+${d.volume}%`,
  };
}

export interface SubmittedShot {
  imageUrl: string;
  audioUrl: string | null;
  providerRef: string;
  /** The clip carries its own spoken line (English dialogue). */
  nativeAudio: boolean;
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
  const native = speaksNatively(shot, ctx.language);
  if (native) {
    // Spoken by the video model while it films — see speaksNatively.
  } else if (shot.kind === "dialogue" && shot.dialogue.trim() && seriesId && localeOrDefault(ctx.language).provider === "omnivoice") {
    // Languages with no named voice are spoken by cloning the character's own
    // sample, made during casting — see src/lib/series/omnivoice.ts.
    audioUrl = await speakOmnivoice(seriesId, shot.speaker, shot.dialogue, userId, tag);
  } else if (shot.kind === "dialogue" && shot.dialogue.trim()) {
    const gender = shot.gender === "female" || shot.gender === "male" ? shot.gender : guessGender(shot.speaker);
    const cast = seriesId
      ? await voiceForCharacter(seriesId, shot.speaker, gender, ctx.language)
      : { voice: voiceForSpeaker(shot.speaker, ctx, gender), ...voiceCharacter(shot.speaker) };
    audioUrl = await synthesiseLine(shot.dialogue, cast.voice, userId, tag, deliver(cast, shot.emotion));
  }

  // 3. Film it. EVERY shot is filmed, speaking ones included — that is the
  //    difference between a scene and a slideshow. Speech is matched onto the
  //    moving footage afterwards, in the polling stage.
  const spec = styleSpec(ctx.style);
  const motionPrompt = native ? buildNativeDialoguePrompt(shot, ctx.style, ctx.language) : buildShotMotionPrompt(shot, ctx.style);
  const prediction = await submitWsModel(
    spec.videoModel,
    spec.blockbuster
      ? {
          // Seedance 2.5 takes a narrower schema: no aspect ratio (the still
          // sets the shape), no seed. Audio is generated only when the model
          // speaks the line itself; otherwise our voices, sound effects and
          // score are laid in afterwards.
          image: imageUrl,
          prompt: motionPrompt,
          duration: 5,
          resolution: "720p",
          generate_audio: native,
        }
      : { image: imageUrl, prompt: motionPrompt, duration: 5, generate_audio: native }
  );

  return { imageUrl, audioUrl, providerRef: prediction.id, nativeAudio: native };
}
