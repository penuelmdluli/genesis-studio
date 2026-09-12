// ============================================
// SERIES STUDIO — the writer
// ============================================
// One video is a post. A series is a reason to come back — same people, same
// language, a story that carries on. This module is what makes episode 7
// follow from episode 6 instead of starting the world over.
//
// Two things make that work:
//
//   1. `story_so_far` — a running recap the writer reads before every new
//      episode, and rewrites after. It is the memory of the series. Without
//      it, each episode is a stranger.
//   2. A locked character description — the exact same wording goes to the
//      image model every episode, so the lead's face does not drift.
//
// Dialogue is written in the creator's own language (isiZulu, Afrikaans,
// South African English). Visual direction stays in English because that is
// what the video models were trained to read — the creator never sees it.

import { envString } from "@/lib/env";
import { localeOrDefault } from "@/lib/series/locales";

/** Any locale id from the catalogue of languages we can actually speak. */
export type SeriesLanguage = string;

/**
 * How to write in this language. The three South African ones are spelled
 * out because getting them wrong is obvious to the people who speak them —
 * textbook isiZulu in a township drama reads as a school play. Everything
 * else gets a good generic instruction built from its own name.
 */
function languageInstruction(id: string): string {
  switch (id) {
    case "zu-ZA":
      return "Write ALL spoken dialogue in natural, conversational isiZulu as spoken in Gauteng and KwaZulu-Natal today, not textbook isiZulu. Code-switching into English for a word or two is normal and welcome, exactly how people actually speak.";
    case "af-ZA":
      return "Write ALL spoken dialogue in natural, conversational South African Afrikaans as spoken today, including the everyday code-switching into English that a real person would use.";
    case "en-ZA":
      return "Write ALL spoken dialogue in South African English, using the rhythm, slang and expressions people actually use here.";
    default: {
      const label = localeOrDefault(id).label.replace(/ — .*$/, "");
      const place = localeOrDefault(id).label.includes(" — ")
        ? ` as it is actually spoken in ${localeOrDefault(id).label.split(" — ")[1]}`
        : "";
      return `Write ALL spoken dialogue in natural, conversational ${label}${place}. Use the way people really talk, not formal written language.`;
    }
  }
}

/** A single shot. Either somebody speaks, or something happens. */
export interface Shot {
  /** Which character is on screen. */
  speaker: string;
  /** The line, in the series language. Empty for a pure action shot. */
  dialogue: string;
  /**
   * The same line in English. A drama in isiZulu with English subtitles
   * reaches the whole country instead of one language group, so the
   * translation is written at the same time as the line, by the same writer
   * who knows what it means — not guessed later by a machine.
   */
  subtitle: string;
  /** English visual direction for the video model. Never shown to the creator. */
  action: string;
  /**
   * The speaker's gender, decided by the writer who invented them.
   *
   * This used to be guessed from a hash of the name, which is how a woman
   * called Nomsa ended up speaking in a man's voice. The writer knows; ask
   * the writer.
   */
  gender: "female" | "male";
  /** Drives both the performance and the camera. */
  emotion: "calm" | "angry" | "afraid" | "joyful" | "grieving" | "tense" | "shocked";
  /** Action shots get cinematic motion; dialogue shots get lip sync. */
  kind: "dialogue" | "action";
}

export interface EpisodeDraft {
  title: string;
  synopsis: string;
  shots: Shot[];
  /** Replaces the series recap once the episode is made. */
  storySoFar: string;
  /** The hook that makes them watch the next one. */
  cliffhanger: string;
}

export interface SeriesContext {
  title: string;
  language: SeriesLanguage;
  genre: string | null;
  logline: string | null;
  characterName: string | null;
  characterDescription: string | null;
  storySoFar: string | null;
  episodeNumber: number;
}

const EMOTIONS = ["calm", "angry", "afraid", "joyful", "grieving", "tense", "shocked"] as const;

function stripFence(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return t;
}

/**
 * Last resort when the writer omits a gender. Names common in South African
 * drama, so the usual cast is right rather than coin-flipped; anything
 * unknown falls to male, which the voice-differentiation step then varies.
 */
const FEMALE_NAMES = new Set([
  "nomsa", "thandi", "thando", "zinhle", "lerato", "naledi", "busi", "busisiwe",
  "nosipho", "ayanda", "khanyi", "lindiwe", "nokuthula", "precious", "gugu",
  "mama", "sisi", "nomvula", "palesa", "refilwe", "dineo", "bongi", "zodwa",
  "andile", "portia", "mercy", "grace", "sarah", "maria", "anna", "adri",
]);

export function guessGender(speaker: string): "female" | "male" {
  const first = speaker.toLowerCase().trim().split(/[\s,(]/)[0];
  return FEMALE_NAMES.has(first) ? "female" : "male";
}

/** Does this look like it is already English? */
function looksEnglish(language: string): boolean {
  return language === "en" || language.startsWith("en-");
}

/**
 * Subtitles are always English. The writer is asked for them inline, but a
 * model that skips a field or echoes the original line would leave a viewer
 * reading isiZulu under isiZulu — which defeats the entire point of having
 * subtitles. Anything missing is translated in one extra call rather than
 * left to chance.
 */
async function ensureEnglishSubtitles(
  shots: Shot[],
  language: string,
  apiKey: string
): Promise<void> {
  const english = looksEnglish(language);

  const needing = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => {
      if (shot.kind !== "dialogue" || !shot.dialogue) return false;
      if (!shot.subtitle) return true;
      // An "English" subtitle identical to a non-English line is the model
      // having echoed rather than translated.
      return !english && shot.subtitle === shot.dialogue;
    });

  if (needing.length === 0) return;

  // For an English-language series the line is its own subtitle.
  if (english) {
    for (const { shot } of needing) shot.subtitle = shot.dialogue;
    return;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `Translate each line into natural English subtitles. Translate the meaning, not the words — an English viewer should feel what a speaker of the original feels. Keep each translation short enough to read on screen.

Respond with ONLY a JSON array of strings, in the same order, no markdown:
${JSON.stringify(needing.map(({ shot }) => shot.dialogue))}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`translation failed (${res.status})`);
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const translations = JSON.parse(stripFence(json.content?.[0]?.text || "[]")) as string[];

    needing.forEach(({ shot }, i) => {
      const line = String(translations[i] || "").trim();
      if (line) shot.subtitle = line.slice(0, 300);
    });
  } catch (err) {
    // An episode with some subtitles missing is still worth having; the
    // creator can read the script and fill them in. Losing the whole episode
    // over a translation call would be the worse trade.
    console.error("[SERIES] subtitle translation failed:", err);
  }
}

/**
 * Writes the next episode. Reads the recap, writes the scenes, and hands back
 * a rewritten recap so the following episode has somewhere to stand.
 */
export async function writeEpisode(ctx: SeriesContext, shotCount = 6): Promise<EpisodeDraft> {
  const key = envString("ANTHROPIC_API_KEY");
  if (!key) throw new Error("The writer is not configured");

  const lang = languageInstruction(ctx.language);
  const first = ctx.episodeNumber <= 1;

  const continuity = first
    ? `This is EPISODE 1. Open the world, introduce ${ctx.characterName || "the lead"}, and end on a hook that demands episode 2.`
    : `This is EPISODE ${ctx.episodeNumber}. Here is everything that has happened so far:

--- STORY SO FAR ---
${ctx.storySoFar || "(nothing recorded)"}
--- END ---

Continue DIRECTLY from that. Do not reset, do not re-introduce characters the audience already knows, do not repeat earlier scenes. Pay off at least one thread that was left open, and open a new one.`;

  const prompt = `You are the head writer of a South African drama series. You write the kind of episodic drama people actually finish and share: real stakes, real families, money, loyalty, betrayal. Not an advert, not a lesson.

SERIES: ${ctx.title}
GENRE: ${ctx.genre || "drama"}
${ctx.logline ? `PREMISE: ${ctx.logline}` : ""}
LEAD CHARACTER: ${ctx.characterName || "the lead"}${ctx.characterDescription ? ` — ${ctx.characterDescription}` : ""}

${continuity}

LANGUAGE: ${lang}
Visual direction ("action") stays in ENGLISH. It is read by a camera system, never by the audience.

Write exactly ${shotCount} shots. This is a drama, so most shots are people SPEAKING to each other, cut the way a real scene is shot — one speaker per shot, alternating. Mark those "dialogue". Use "action" shots (no speech) for arrivals, reveals, and the beats between lines, and make those genuinely physical: someone arrives, something is taken, someone walks out.

Rules that matter:
- A dialogue line is ONE person speaking, 4 to 18 words. Real speech, not a speech.
- Alternate speakers where two people are talking.
- "action" is a single clear visual sentence: who is in frame, what they do, where. Always name the character.
- For a DIALOGUE shot, "action" must describe ONLY the speaker and what their body is doing — never two people in the same frame. Dialogue is filmed one person at a time, and a second face on screen makes it impossible to tell who is talking.
- Give every character ONE name and use that exact name every single time, in this episode and all later ones. Never "The Man" in one shot and "Jabulani" in the next — that is the same person and must read as the same person.
- Put real physical action in the shots: people arrive, grab, walk out, slam things, turn away. A scene of talking heads is not a drama.
- Every dialogue shot MUST carry "gender" for the speaker. Keep it the same every time that character speaks, in this episode and in every later one.
- Every dialogue shot MUST also carry "subtitle": that same line in natural English. Translate the meaning, not the words — an English viewer should feel what a speaker of the language feels. If the series language is already English, repeat the line.
- End on a cliffhanger.

Respond with ONLY this JSON, no markdown:
{
  "title": "episode title",
  "synopsis": "two sentences, English, for the creator",
  "shots": [
    { "kind": "dialogue", "speaker": "character name", "gender": "female" or "male", "dialogue": "the line in the series language, empty for action shots", "subtitle": "the same line translated into natural English, empty for action shots", "action": "English visual direction", "emotion": "calm" }
  ],
  "cliffhanger": "one line, English, what is left hanging",
  "storySoFar": "a rewritten recap covering everything from episode 1 through this one, under 250 words, English. This is the only memory the next episode gets, so carry forward every name, relationship and unresolved thread."
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Writer unavailable (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text || "";

  let draft: EpisodeDraft;
  try {
    draft = JSON.parse(stripFence(text)) as EpisodeDraft;
  } catch {
    throw new Error("The writer returned something unreadable — please try again");
  }

  if (!Array.isArray(draft.shots) || draft.shots.length === 0) {
    throw new Error("The writer returned no scenes — please try again");
  }

  // Trust nothing about the shape. A wrong `kind` would silently route a
  // speaking shot away from lip sync, which is the one thing this sells.
  draft.shots = draft.shots.slice(0, 12).map((s) => {
    const dialogue = String(s.dialogue || "").slice(0, 300).trim();
    return {
      speaker: String(s.speaker || ctx.characterName || "Lead").slice(0, 60),
      gender: s.gender === "female" ? "female" : s.gender === "male" ? "male" : guessGender(String(s.speaker || "")),
      dialogue,
      // Left empty when missing rather than filled with the original line.
      // Subtitles exist to carry the story to people who do not speak the
      // language, so isiZulu under isiZulu is not a fallback, it is a
      // failure. Anything missing here is translated below.
      subtitle: String(s.subtitle || "").slice(0, 300).trim(),
      action: String(s.action || "").slice(0, 400),
      emotion: EMOTIONS.includes(s.emotion as never) ? s.emotion : "calm",
      kind: dialogue ? ("dialogue" as const) : ("action" as const),
    };
  });

  await ensureEnglishSubtitles(draft.shots, ctx.language, key);

  draft.title = String(draft.title || `Episode ${ctx.episodeNumber}`).slice(0, 120);
  draft.synopsis = String(draft.synopsis || "").slice(0, 600);
  draft.cliffhanger = String(draft.cliffhanger || "").slice(0, 300);
  draft.storySoFar = String(draft.storySoFar || ctx.storySoFar || "").slice(0, 4000);

  return draft;
}
