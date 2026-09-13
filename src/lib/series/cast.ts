// ============================================
// SERIES STUDIO — who sounds like whom, permanently
// ============================================
// A character's voice was being derived from a hash of whatever string the
// writer happened to use that episode. So the same person came back as "The
// Man" in one shot and "Jabulani" in the next, hashed differently, and
// changed voice mid-scene. An audience forgives a lot, but not a character
// whose voice keeps changing.
//
// The cast is now decided once per series and written down. The first woman
// gets the language's female voice, the first man gets the male voice, and
// anyone after that gets the same voice with a small, fixed shift so they are
// still distinguishable. Whatever a character is assigned in episode 1 is
// what they sound like in episode 40.

import { randomUUID } from "crypto";
import { getDb } from "@/lib/db-driver";
import { localeById, localeOrDefault } from "@/lib/series/locales";

export interface CastVoice {
  voice: string;
  pitch: string;
  rate: string;
}

/**
 * Deliberately small shifts.
 *
 * Earlier values (±12 to ±18Hz, ±6 to ±9%) were audible as processing rather
 * than as a different person, and they blurred the isiZulu — a neural voice
 * pushed that far stops pronouncing cleanly. These are enough to separate two
 * speakers while leaving the delivery intact.
 */
/**
 * Sibling locales to borrow a voice from, in the order they should be used.
 *
 * Pitch-shifting one voice was not enough: two men separated by 5Hz read as
 * the same man, and that was audible — the only pair that sounded properly
 * distinct was a man against a woman. A different voice is a different
 * person; a shifted one is the same person with a cold.
 *
 * African English first, so a Joburg drama does not suddenly acquire an
 * American, and the rest only once those run out. Languages with a single
 * locale (isiZulu among them) have nothing to borrow and fall back to the
 * pitch variants below.
 */
const SIBLING_LOCALES: Record<string, string[]> = {
  en: ["en-ZA", "en-NG", "en-KE", "en-TZ", "en-GB", "en-IE", "en-AU", "en-US"],
};

function voicePool(language: string, gender: "female" | "male"): string[] {
  const own = localeOrDefault(language);
  const first = gender === "female" ? own.female : own.male;

  const family = language.split("-")[0];
  const siblings = SIBLING_LOCALES[family] || [];

  const pool = [first];
  for (const id of siblings) {
    const loc = localeById(id);
    if (!loc) continue;
    const voice = gender === "female" ? loc.female : loc.male;
    if (voice && !pool.includes(voice)) pool.push(voice);
  }
  return pool;
}

const VARIANTS: Array<{ pitch: string; rate: string }> = [
  { pitch: "+0Hz", rate: "+0%" },
  { pitch: "-5Hz", rate: "-3%" },
  { pitch: "+5Hz", rate: "+3%" },
  { pitch: "-9Hz", rate: "+2%" },
  { pitch: "+9Hz", rate: "-2%" },
];

/**
 * One character, one key. Strips the decorations writers add around a name
 * ("Bhuti Jabulani", "Nomsa (the sister)") so the same person is recognised
 * as the same person.
 */
export function characterKey(speaker: string): string {
  return speaker
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(bhuti|buti|sisi|mama|baba|mnumzane|mr|mrs|ms|uncle|aunt|the)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)[0] || "lead";
}

interface CastRow {
  character_key: string;
  gender: string | null;
  voice: string | null;
  pitch: string | null;
  rate: string | null;
}

/**
 * The voice for this character in this series, assigned on first appearance
 * and reused forever after.
 */
export async function voiceForCharacter(
  seriesId: string,
  speaker: string,
  gender: "female" | "male",
  language: string
): Promise<CastVoice> {
  const db = getDb();
  const key = characterKey(speaker);
  const locale = localeOrDefault(language);
  const base = gender === "female" ? locale.female : locale.male;

  const { data: existing } = await db
    .from("series_cast")
    .select("character_key, gender, voice, pitch, rate")
    .eq("series_id", seriesId)
    .limit(50);

  const cast = (existing || []) as CastRow[];
  const mine = cast.find((c) => c.character_key === key);
  if (mine?.voice) {
    return { voice: mine.voice, pitch: mine.pitch || "+0Hz", rate: mine.rate || "+0%" };
  }

  // Every character in a series gets a voice nobody else in it has.
  //
  // This is checked against the cast as it actually stands rather than
  // inferred from how many characters came before, so it holds even when
  // characters are recast, removed or added out of order. Genuinely
  // different voices are tried first; the gentle pitch variants of the base
  // voice only once every real voice for that gender is taken.
  const taken = new Set(cast.map((c) => `${c.voice}|${c.pitch || "+0Hz"}|${c.rate || "+0%"}`));
  const pool = voicePool(language, gender);

  const candidates: CastVoice[] = [
    ...pool.map((voice) => ({ voice, pitch: "+0Hz", rate: "+0%" })),
    ...VARIANTS.slice(1).map((v) => ({ voice: base, pitch: v.pitch, rate: v.rate })),
  ];

  const free = candidates.find((c) => !taken.has(`${c.voice}|${c.pitch}|${c.rate}`));
  if (!free) {
    // More same-gender speaking parts than distinct voices exist. Say so
    // loudly rather than silently doubling someone up.
    console.error(`[SERIES] no unique voice left for ${speaker} (${gender}, ${language})`);
  }
  const assigned: CastVoice = free || candidates[candidates.length - 1];

  // A duplicate insert means two shots of the same new character were
  // rendered at once; the row that won is the right answer either way.
  const { error } = await db.from("series_cast").insert({
    id: randomUUID(),
    series_id: seriesId,
    character_key: key,
    display_name: speaker.slice(0, 60),
    gender,
    voice: assigned.voice,
    pitch: assigned.pitch,
    rate: assigned.rate,
  });
  if (error) {
    const { data: raced } = await db
      .from("series_cast")
      .select("voice, pitch, rate")
      .eq("series_id", seriesId)
      .eq("character_key", key)
      .maybeSingle();
    if (raced?.voice) {
      return { voice: raced.voice, pitch: raced.pitch || "+0Hz", rate: raced.rate || "+0%" };
    }
  }

  return assigned;
}

/**
 * Casts every speaking part in an episode BEFORE any of them is rendered.
 *
 * Shots are submitted in parallel, and each one used to look up its own
 * voice. Running together they all read an empty cast, all counted zero
 * same-gender characters already cast, and all claimed the first variant — so
 * two different men in one episode could come out sounding identical. The
 * unique index prevents duplicate rows for one character but cannot stop two
 * characters choosing the same voice at the same instant.
 *
 * Assigning them one at a time, in the order they speak, removes the race
 * entirely and costs one pass over the script.
 */
export async function ensureCast(
  seriesId: string,
  shots: Array<{ kind: string; speaker: string; gender?: "female" | "male"; dialogue?: string }>,
  language: string,
  fallbackGender: (speaker: string) => "female" | "male"
): Promise<void> {
  // Cast the biggest parts first.
  //
  // Casting in order of appearance handed the local voice to whoever happened
  // to speak first — in one episode a driver with a single line took the
  // South African voice and the lead's own son was left with a borrowed
  // accent. The pool's best voice should go to the person the audience hears
  // most.
  // A character's gender is decided by a vote across every line they have,
  // not by whichever line happens to come first. A writer that labels one
  // line wrongly would otherwise lock that mistake into the cast for the life
  // of the series.
  const lines = new Map<
    string,
    { speaker: string; female: number; male: number; count: number }
  >();
  for (const shot of shots) {
    if (shot.kind !== "dialogue" || !shot.dialogue?.trim()) continue;
    const key = characterKey(shot.speaker);
    const gender =
      shot.gender === "female" || shot.gender === "male" ? shot.gender : fallbackGender(shot.speaker);
    const entry = lines.get(key) || { speaker: shot.speaker, female: 0, male: 0, count: 0 };
    entry[gender] += 1;
    entry.count += 1;
    lines.set(key, entry);
  }

  const order = [...lines.values()].sort((a, b) => b.count - a.count);
  for (const part of order) {
    const gender: "female" | "male" =
      part.female === part.male ? fallbackGender(part.speaker) : part.female > part.male ? "female" : "male";
    if (part.female > 0 && part.male > 0) {
      console.warn(
        `[SERIES] ${part.speaker} was written as both genders (${part.female}F/${part.male}M); cast as ${gender}`
      );
    }
    await voiceForCharacter(seriesId, part.speaker, gender, language);
  }
}
