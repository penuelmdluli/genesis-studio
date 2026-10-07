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
import { voiceForCharacter, characterKey } from "@/lib/series/cast";
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
    "medium shot framed from the waist up, subject slightly above centre, shallow depth of field, background falling away, never a full-length standing pose",
  // Two people in one frame while only one face shows: the listener's back
  // and shoulder in the foreground. How a confrontation is filmed, and safe
  // for lip-sync because there is only one mouth to move.
  ots:
    "over-the-shoulder shot: the speaker faces the camera, framed from the chest up; in the near foreground, soft and out of focus, the back of the other person's head and one shoulder fill one side of the frame, their face completely hidden; shallow depth of field",
  // Silent only: both faces visible.
  two:
    "two-shot: both people in the same frame, side-on to the camera and facing each other across the room, framed from the knees up, the space between them part of the drama, shallow depth of field",
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
  two: "the camera drifts slowly between them, both holding still, eyes locked, a breath before someone moves",
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
  "no printed words, letters, badges, insignia or logos on any clothing or uniform, " +
  "no stiff catalogue pose, nobody standing straight facing the camera with arms at their sides";

/** Same rules for a frame that legitimately holds two people. */
const NEGATIVE_PAIR =
  "nobody else in the room besides these two, no crowd, no onlookers, no text, no watermark, no split screen, " +
  "no printed words, letters, badges, insignia or logos on any clothing or uniform, no stiff catalogue pose";

const NEGATIVE_LIGHT = "no text, no watermark, no split screen, no printed words, letters or logos on clothing";

export interface RenderContext {
  language: SeriesLanguage;
  /** Locked, reused verbatim in every shot of every episode. */
  characterDescription: string | null;
  characterName: string | null;
  aspectRatio: "9:16" | "16:9";
  /** The look of the series, from its genre. Drama when absent. */
  style?: VisualStyle;
  /** The episode being filmed: its set picture is shared by every shot. */
  episodeId?: string;
}

/** What a shot's still is built from: who is in it, and where. */
export interface ShotRefs {
  /** A portrait of the speaker (or the lead in an action shot) is attached. */
  person: boolean;
  /** The episode's set picture is attached. */
  set: boolean;
  /** The speaker's locked look, used in words when no portrait exists. */
  look?: string | null;
  /** The episode's location, used in words when no set picture exists. */
  location?: string | null;
  /** A portrait of the second person in frame (ots / two) is attached. */
  listener?: boolean;
  /** The second person's locked look, used in words when no portrait exists. */
  listenerLook?: string | null;
}

/** "first", "second", "third" for the reference image order. */
function nth(i: number): string {
  return ["first", "second", "third", "fourth"][i] || `number ${i + 1}`;
}

/** A frame that holds two people: over-the-shoulder or a silent two-shot. */
function isPairShot(shot: Shot): boolean {
  return (shot.shotSize === "ots" || shot.shotSize === "two") && !!shot.listener;
}

/**
 * The still for one shot. The locked character description leads, so the
 * model resolves the face before it resolves anything else.
 */
export function buildShotImagePrompt(shot: Shot, ctx: RenderContext, refs?: ShotRefs): string {
  const framing = SHOT_FRAMING[shot.shotSize] || SHOT_FRAMING.medium;
  const tone = EMOTION_TONE[shot.emotion] || EMOTION_TONE.calm;

  // An insert has no face in it, so the locked character description would
  // only confuse the model.
  // Kept for the fallback path. When a reference photograph is used the
  // model is looking at the person, so leading with "the same person" beats
  // re-describing them.
  //
  // With refs, the person and the room come from pictures: image 1 is the
  // speaker's own portrait (never the lead's, unless the lead is speaking)
  // and the last image is the episode's set, so every shot of the scene is
  // the same room in the same light.
  let character: string;
  let setting = "";
  const pair = isPairShot(shot);
  if (refs) {
    // Reference images arrive in this order: speaker, listener, set.
    let i = 0;
    const personAt = refs.person ? i++ : -1;
    const listenerAt = pair && refs.listener ? i++ : -1;
    const setAt = refs.set ? i++ : -1;
    character =
      shot.shotSize === "insert"
        ? ""
        : personAt >= 0
          ? `${shot.speaker || "The person"} is the person in the ${nth(personAt)} reference image: keep that exact face, hair, build and clothing. `
          : refs.look
            ? `${shot.speaker}: ${refs.look}. `
            : "";
    if (pair) {
      const who =
        listenerAt >= 0
          ? `${shot.listener} is the person in the ${nth(listenerAt)} reference image (same hair, build and clothing)`
          : `${shot.listener}${refs.listenerLook ? ` (${refs.listenerLook})` : ""}`;
      character +=
        shot.shotSize === "ots"
          ? `${who}, seen strictly FROM BEHIND in the near foreground: only the back of their head and one shoulder, their face never visible. ${shot.speaker} faces the camera and faces ${shot.listener}. `
          : `${who}. Both are in frame, facing each other. `;
    }
    setting =
      setAt >= 0
        ? `The scene takes place in the room shown in the ${nth(setAt)} reference image: the same walls, furniture, windows and light. Same time of day and lighting as every other shot of this scene. `
        : refs.location
          ? `Setting: ${refs.location}. Same time of day and lighting as every other shot of this scene. `
          : "";
  } else {
    character =
      shot.shotSize === "insert" || !ctx.characterDescription
        ? ""
        : `The same person from the reference photograph. ${ctx.characterDescription}. `;
  }

  // A speaking shot holds ONE person. With two people in frame the lip-sync
  // model animates both mouths, so the audience cannot tell who is talking.
  const solo =
    shot.kind === "dialogue" && shot.shotSize !== "insert"
      ? pair
        ? `Only ${shot.speaker}'s face is visible. `
        : `Only ${shot.speaker} is visible, completely alone in frame. `
      : "";

  return [
    character,
    solo,
    setting,
    shot.action,
    `${framing}, ${tone}.`,
    styleSpec(ctx.style).look,
    // An action or cartoon set piece is allowed its crowd, its villain and its
    // cheering village; only a speaking frame must hold one person.
    (shot.kind === "action" && styleSpec(ctx.style).blockbuster ? NEGATIVE_LIGHT : pair ? NEGATIVE_PAIR : NEGATIVE) + ".",
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
    shot.kind !== "dialogue"
      ? ""
      : shot.shotSize === "ots" && shot.listener
        ? `${shot.speaker} is talking to ${shot.listener}, mouth moving, expressive; ${shot.listener}, seen from behind in the foreground, stays silent and nearly still. `
        : "The character is talking to someone off camera, mouth moving, expressive. ";

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
 * The portrait a shot is built from, and the look it stands for.
 *
 * The speaker's own portrait, made once from their locked look in the cast
 * and reused forever. The lead's reference is used only when the lead is the
 * one speaking, or is named in an action shot: handing the lead's photo to
 * every shot is what put Lerato's lines in Sipho's mouth.
 */
export async function portraitForShot(
  seriesId: string,
  shot: Shot,
  ctx: RenderContext
): Promise<{ url: string | null; look: string | null } | null> {
  const speakerKey = shot.speaker ? characterKey(shot.speaker) : null;

  if (shot.kind !== "dialogue") {
    // An action shot: whoever it is about. A silent reaction close-up of
    // Lerato needs Lerato's face, not a fresh stranger; the lead only when
    // the direction is about them.
    const action = (shot.action || "").toLowerCase();
    if (shot.speaker && action.includes(shot.speaker.toLowerCase())) {
      return portraitForName(seriesId, shot.speaker, ctx);
    }
    const aboutLead = !!ctx.characterName && action.includes(ctx.characterName.toLowerCase());
    if (!aboutLead) return null;
    return { url: await ensureCharacterReference(seriesId, ctx), look: ctx.characterDescription };
  }
  if (!speakerKey) return null;
  return portraitForName(seriesId, shot.speaker, ctx);
}

/**
 * One character's portrait by name: the lead's reference for the lead, the
 * cast row's portrait (made once from its locked look) for everyone else.
 * Also used for the second person in an over-the-shoulder or two-shot.
 */
export async function portraitForName(
  seriesId: string,
  name: string,
  ctx: RenderContext
): Promise<{ url: string | null; look: string | null } | null> {
  const leadKey = ctx.characterName ? characterKey(ctx.characterName) : null;
  const speakerKey = name ? characterKey(name) : null;
  if (!speakerKey) return null;
  if (speakerKey === leadKey) {
    return { url: await ensureCharacterReference(seriesId, ctx), look: ctx.characterDescription };
  }
  const shot = { speaker: name };

  const db = getDb();
  const { data: row } = await db
    .from("series_cast")
    .select("look, image_url")
    .eq("series_id", seriesId)
    .eq("character_key", speakerKey)
    .maybeSingle();
  if (row?.image_url) return { url: row.image_url, look: row.look || null };
  if (!row?.look) return { url: null, look: null };

  try {
    const portrait = await runWsModelSync(WS_MODELS.textToImage, {
      prompt: `${row.look}. ${styleSpec(ctx.style).portrait} ${NEGATIVE}.`,
      size: "768*1344",
    });
    const url = Array.isArray(portrait?.outputs) ? String(portrait.outputs[0] || "") : "";
    if (!url) return { url: null, look: row.look };
    // Only the first portrait is kept: a character has ONE face.
    await db
      .from("series_cast")
      .update({ image_url: url })
      .eq("series_id", seriesId)
      .eq("character_key", speakerKey)
      .is("image_url", null);
    const { data: saved } = await db
      .from("series_cast")
      .select("image_url")
      .eq("series_id", seriesId)
      .eq("character_key", speakerKey)
      .maybeSingle();
    return { url: saved?.image_url || url, look: row.look };
  } catch (err) {
    console.error(`[SERIES] could not make a portrait for ${shot.speaker}:`, err);
    return { url: null, look: row.look };
  }
}

/**
 * The episode's set: one picture of the empty location, made once and handed
 * to every shot, so a scene is one room in one light rather than ten rooms.
 * The episode's own location (from the writer) wins; the series default
 * covers older episodes. Nothing to show when neither is known.
 */
export async function ensureSetImage(
  seriesId: string,
  episodeId: string,
  ctx: RenderContext
): Promise<{ url: string | null; location: string | null }> {
  const db = getDb();
  const { data: ep } = await db
    .from("series_episodes")
    .select("location, set_image_url")
    .eq("id", episodeId)
    .maybeSingle();
  if (ep?.set_image_url) return { url: ep.set_image_url, location: ep.location || null };

  let location: string | null = ep?.location || null;
  if (!location) {
    const { data: series } = await db.from("series").select("location").eq("id", seriesId).maybeSingle();
    location = series?.location || null;
  }
  if (!location) return { url: null, location: null };

  try {
    const plate = await runWsModelSync(WS_MODELS.textToImage, {
      prompt:
        `${location}. An empty film set photographed before the actors arrive: no people at all, ` +
        `eye-level, the whole space readable, motivated practical lighting. ${styleSpec(ctx.style).look} ` +
        `no text, no watermark.`,
      size: ctx.aspectRatio === "9:16" ? "768*1344" : "1344*768",
    });
    const url = Array.isArray(plate?.outputs) ? String(plate.outputs[0] || "") : "";
    if (!url) return { url: null, location };
    // Only the first writer wins: two shots racing must share ONE set.
    await db.from("series_episodes").update({ set_image_url: url }).eq("id", episodeId).is("set_image_url", null);
    const { data: saved } = await db.from("series_episodes").select("set_image_url").eq("id", episodeId).maybeSingle();
    return { url: saved?.set_image_url || url, location };
  } catch (err) {
    console.error("[SERIES] could not make the set picture:", err);
    return { url: null, location };
  }
}

/**
 * Makes everything a scene shares BEFORE its shots are filmed in parallel:
 * the set picture, the lead's reference and every speaker's portrait, and
 * locks in the looks and location the writer gave this episode. Without
 * this, ten shots submitted at once would each make their own set and their
 * own version of every face.
 */
export async function prepareEpisodeReferences(
  seriesId: string,
  episodeId: string,
  shots: Shot[],
  ctx: RenderContext,
  written?: { location?: string | null; characters?: Array<{ name: string; look: string }> }
): Promise<void> {
  const db = getDb();
  if (written?.location) {
    await db.from("series_episodes").update({ location: written.location.slice(0, 400) }).eq("id", episodeId).is("location", null);
  }
  // A returning character keeps the look they were first given.
  for (const c of written?.characters || []) {
    if (!c?.name || !c?.look) continue;
    await db
      .from("series_cast")
      .update({ look: c.look.slice(0, 500) })
      .eq("series_id", seriesId)
      .eq("character_key", characterKey(c.name))
      .is("look", null);
  }

  const withEpisode = { ...ctx, episodeId };
  await ensureSetImage(seriesId, episodeId, withEpisode);
  const seen = new Set<string>();
  for (const shot of shots) {
    const key = shot.kind === "dialogue" && shot.speaker ? characterKey(shot.speaker) : "";
    if (key && !seen.has(key)) {
      seen.add(key);
      await portraitForShot(seriesId, shot, withEpisode);
    }
    // The second person in an over-the-shoulder or two-shot needs a face too.
    const other = isPairShot(shot) ? characterKey(shot.listener!) : "";
    if (other && !seen.has(other)) {
      seen.add(other);
      await portraitForName(seriesId, shot.listener!, withEpisode);
    }
  }
}

/**
 * Renders one shot. Returns as soon as the video job is accepted — the clip
 * is polled later like every other hosted job, so a nine-shot episode does
 * not hold a request open for ten minutes.
 */
/**
 * The still for one shot. Built from a portrait of whoever is actually in
 * the shot (the speaker; the lead only when the lead is speaking or named in
 * the action) plus the episode's set picture, so every shot of the scene is
 * the same people in the same room. An insert has no face, only the set.
 *
 * Used by the stills step (the creator approves these before any video is
 * paid for) and by submitShot when a shot has no approved still yet.
 */
export async function makeShotStill(shot: Shot, ctx: RenderContext, seriesId?: string): Promise<string> {
  const person = shot.shotSize === "insert" || !seriesId ? null : await portraitForShot(seriesId, shot, ctx);
  const other = isPairShot(shot) && seriesId ? await portraitForName(seriesId, shot.listener!, ctx) : null;
  const set = seriesId && ctx.episodeId ? await ensureSetImage(seriesId, ctx.episodeId, ctx) : { url: null, location: null };
  const refs: ShotRefs = {
    person: !!person?.url,
    set: !!set.url,
    look: person?.look || null,
    location: set.location,
    listener: !!other?.url,
    listenerLook: other?.look || null,
  };
  const prompt = buildShotImagePrompt(shot, ctx, refs);
  // Order matters: the prompt names them first, second, third in this order.
  const images = [person?.url, other?.url, set.url].filter((u): u is string => !!u);

  let imageUrl = "";
  if (images.length) {
    try {
      const edited = await runWsModelSync(
        REFERENCE_SHOT_MODEL,
        { prompt, images, output_format: "png" },
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
  return imageUrl;
}

export async function submitShot(
  shot: Shot,
  ctx: RenderContext,
  userId: string,
  tag: string,
  seriesId?: string
): Promise<SubmittedShot> {
  // 1. The still: the one the creator approved, or a fresh one.
  const imageUrl = shot.stillUrl || (await makeShotStill(shot, ctx, seriesId));

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
