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
import { localeOrDefault } from "@/lib/series/locales";

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

  // Position among the same-gender characters already cast decides which
  // variant is still free.
  const sameGender = cast.filter((c) => c.gender === gender).length;
  const variant = VARIANTS[Math.min(sameGender, VARIANTS.length - 1)];
  const assigned: CastVoice = { voice: base, pitch: variant.pitch, rate: variant.rate };

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
  const seen = new Set<string>();
  for (const shot of shots) {
    if (shot.kind !== "dialogue" || !shot.dialogue?.trim()) continue;
    const key = characterKey(shot.speaker);
    if (seen.has(key)) continue;
    seen.add(key);
    const gender = shot.gender === "female" || shot.gender === "male" ? shot.gender : fallbackGender(shot.speaker);
    await voiceForCharacter(seriesId, shot.speaker, gender, language);
  }
}
