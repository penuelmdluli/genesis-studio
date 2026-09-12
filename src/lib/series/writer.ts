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

export type SeriesLanguage = "zu-ZA" | "af-ZA" | "en-ZA" | "en";

export const SERIES_LANGUAGES: Array<{ id: SeriesLanguage; label: string; native: string }> = [
  { id: "zu-ZA", label: "isiZulu", native: "isiZulu" },
  { id: "af-ZA", label: "Afrikaans", native: "Afrikaans" },
  { id: "en-ZA", label: "South African English", native: "SA English" },
  { id: "en", label: "English", native: "English" },
];

/** Default voices per language, from the TTS voices we already ship. */
export const LANGUAGE_VOICES: Record<SeriesLanguage, { female: string; male: string }> = {
  "zu-ZA": { female: "voice-thando", male: "voice-themba" },
  "af-ZA": { female: "voice-adri", male: "voice-willem" },
  "en-ZA": { female: "voice-naledi", male: "voice-thabo" },
  en: { female: "voice-aria", male: "voice-james" },
};

const LANGUAGE_INSTRUCTION: Record<SeriesLanguage, string> = {
  "zu-ZA":
    "Write ALL spoken dialogue in natural, conversational isiZulu as spoken in Gauteng and KwaZulu-Natal today, not textbook isiZulu. Code-switching into English for a word or two is normal and welcome, exactly how people actually speak.",
  "af-ZA":
    "Write ALL spoken dialogue in natural, conversational South African Afrikaans as spoken today, including the everyday code-switching into English that a real person would use.",
  "en-ZA":
    "Write ALL spoken dialogue in South African English, using the rhythm, slang and expressions people actually use here.",
  en: "Write ALL spoken dialogue in natural conversational English.",
};

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
 * Writes the next episode. Reads the recap, writes the scenes, and hands back
 * a rewritten recap so the following episode has somewhere to stand.
 */
export async function writeEpisode(ctx: SeriesContext, shotCount = 6): Promise<EpisodeDraft> {
  const key = envString("ANTHROPIC_API_KEY");
  if (!key) throw new Error("The writer is not configured");

  const lang = LANGUAGE_INSTRUCTION[ctx.language] || LANGUAGE_INSTRUCTION.en;
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

Write exactly ${shotCount} shots. This is a drama, so most shots are people SPEAKING to each other, cut the way a real scene is shot. Mark those "dialogue". Use "action" shots (no speech) for arrivals, reveals, and the beats between lines.

Rules that matter:
- A dialogue line is ONE person speaking, 4 to 18 words. Real speech, not a speech.
- Alternate speakers where two people are talking.
- "action" is a single clear visual sentence: who is in frame, what they do, where. Always name the character.
- Every dialogue shot MUST also carry "subtitle": that same line in natural English. Translate the meaning, not the words — an English viewer should feel what a speaker of the language feels. If the series language is already English, repeat the line.
- End on a cliffhanger.

Respond with ONLY this JSON, no markdown:
{
  "title": "episode title",
  "synopsis": "two sentences, English, for the creator",
  "shots": [
    { "kind": "dialogue", "speaker": "character name", "dialogue": "the line in the series language, empty for action shots", "subtitle": "the same line translated into natural English, empty for action shots", "action": "English visual direction", "emotion": "calm" }
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
      dialogue,
      // Falling back to the original line is better than an empty subtitle:
      // a viewer reading isiZulu under isiZulu loses nothing, a viewer
      // reading nothing loses the scene.
      subtitle: String(s.subtitle || dialogue).slice(0, 300).trim(),
      action: String(s.action || "").slice(0, 400),
      emotion: EMOTIONS.includes(s.emotion as never) ? s.emotion : "calm",
      kind: dialogue ? ("dialogue" as const) : ("action" as const),
    };
  });

  draft.title = String(draft.title || `Episode ${ctx.episodeNumber}`).slice(0, 120);
  draft.synopsis = String(draft.synopsis || "").slice(0, 600);
  draft.cliffhanger = String(draft.cliffhanger || "").slice(0, 300);
  draft.storySoFar = String(draft.storySoFar || ctx.storySoFar || "").slice(0, 4000);

  return draft;
}
