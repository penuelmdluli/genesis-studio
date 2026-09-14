// ============================================
// SERIES STUDIO — OmniVoice: every South African language, one voice each
// ============================================
// OmniVoice speaks 600+ languages, which is what finally brings isiXhosa,
// Sesotho, Setswana, Sepedi, Xitsonga, siSwati, Tshivenda and isiNdebele into
// Series Studio. It passed a native listen on isiXhosa, Sesotho and isiZulu
// before any of this was switched on.
//
// It has no named voices. Given a description ("female, elderly, low pitch")
// it invents a voice — a different one every call, even for the same
// description. Used naively, a character would change voice on every line.
//
// So each character is anchored to a recording of themselves:
//   1. On first appearance the character is given a description no one else
//      in the series has, and their first line is synthesised from it.
//   2. That recording is kept, and becomes the character's voice sample.
//   3. Every later line — in this episode and every episode after — is
//      spoken by cloning that sample.
// The sample is made during casting, which runs one character at a time
// before any shot is filmed, so two shots racing each other cannot give one
// character two different voices.

import { runWsModelSync } from "@/lib/wavespeed-tools";
import { getDb } from "@/lib/db-driver";
import { characterKey } from "@/lib/series/cast";

const TTS_MODEL = "wavespeed-ai/omnivoice/text-to-speech";
const CLONE_MODEL = "wavespeed-ai/omnivoice/voice-clone";

/**
 * Distinct voices, drawn only from the attributes the model accepts. The lead
 * of each gender takes the first; everyone after takes the next unused one.
 */
const DESCRIPTIONS: Record<"female" | "male", string[]> = {
  female: [
    "female, young adult, moderate pitch",
    "female, middle-aged, low pitch",
    "female, elderly, low pitch",
    "female, teenager, high pitch",
    "female, young adult, high pitch",
    "female, middle-aged, moderate pitch",
    "female, elderly, moderate pitch",
    "female, child, high pitch",
  ],
  male: [
    "male, young adult, moderate pitch",
    "male, middle-aged, low pitch",
    "male, elderly, very low pitch",
    "male, teenager, moderate pitch",
    "male, young adult, low pitch",
    "male, middle-aged, moderate pitch",
    "male, elderly, low pitch",
    "male, child, high pitch",
  ],
};

function firstOutput(result: unknown): string {
  const outputs = (result as { outputs?: unknown[] })?.outputs;
  return Array.isArray(outputs) && outputs[0] ? String(outputs[0]) : "";
}

/** Copies a generated clip into our own storage, because provider links expire. */
async function keep(url: string, userId: string, tag: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not fetch the generated voice (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error("the generated voice was empty");
  const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
  const key = audioStorageKey(userId, `omni-${tag}`);
  await uploadAudio(key, buf);
  return r2PublicUrl(key);
}

interface OmniCastRow {
  character_key: string;
  gender: string | null;
  voice_description: string | null;
  voice_ref_url: string | null;
  voice_ref_text: string | null;
}

/**
 * Casts one character for an OmniVoice language: a unique description, and a
 * voice sample made from one of their lines. Safe to call repeatedly.
 */
export async function ensureOmnivoiceCharacter(
  seriesId: string,
  speaker: string,
  gender: "female" | "male",
  sampleLine: string,
  userId: string
): Promise<void> {
  const db = getDb();
  const key = characterKey(speaker);

  const { data } = await db
    .from("series_cast")
    .select("character_key, gender, voice_description, voice_ref_url, voice_ref_text")
    .eq("series_id", seriesId)
    .limit(60);
  const cast = (data || []) as OmniCastRow[];
  const mine = cast.find((c) => c.character_key === key);

  if (mine?.voice_ref_url) return;

  // A description nobody else in this series has.
  const taken = new Set(cast.map((c) => c.voice_description).filter(Boolean));
  const description =
    mine?.voice_description ||
    DESCRIPTIONS[gender].find((d) => !taken.has(d)) ||
    DESCRIPTIONS[gender][DESCRIPTIONS[gender].length - 1];

  const line = sampleLine.trim();
  if (!line) return;

  const generated = await runWsModelSync(
    TTS_MODEL,
    { text: line, voice_description: description },
    { timeoutMs: 90_000 }
  );
  const raw = firstOutput(generated);
  if (!raw) throw new Error("OmniVoice returned no audio for the voice sample");
  const refUrl = await keep(raw, userId, `ref-${seriesId}-${key}-${Date.now()}`);

  const row = {
    voice_provider: "omnivoice",
    voice_description: description,
    voice_ref_url: refUrl,
    voice_ref_text: line,
    gender,
  };

  if (mine) {
    await db.from("series_cast").update(row).eq("series_id", seriesId).eq("character_key", key);
  } else {
    await db.from("series_cast").insert({
      id: crypto.randomUUID(),
      series_id: seriesId,
      character_key: key,
      display_name: speaker.slice(0, 60),
      voice: "omnivoice",
      pitch: "+0Hz",
      rate: "+0%",
      ...row,
    });
  }
}

/**
 * Speaks one line in a character's own cloned voice and returns a URL the
 * lip-sync model can read. The character must already be cast.
 */
export async function speakOmnivoice(
  seriesId: string,
  speaker: string,
  text: string,
  userId: string,
  tag: string
): Promise<string> {
  const db = getDb();
  const { data: row } = await db
    .from("series_cast")
    .select("voice_ref_url, voice_ref_text, voice_description")
    .eq("series_id", seriesId)
    .eq("character_key", characterKey(speaker))
    .maybeSingle();

  let raw = "";
  if (row?.voice_ref_url) {
    const cloned = await runWsModelSync(
      CLONE_MODEL,
      {
        text,
        audio: row.voice_ref_url,
        // The transcript of the sample makes the clone noticeably closer.
        ...(row.voice_ref_text ? { reference_text: row.voice_ref_text } : {}),
      },
      { timeoutMs: 90_000 }
    );
    raw = firstOutput(cloned);
  } else {
    // Never cast — should not happen, since casting runs first, but a line
    // spoken in an uncast voice is better than a silent shot.
    const generated = await runWsModelSync(
      TTS_MODEL,
      { text, ...(row?.voice_description ? { voice_description: row.voice_description } : {}) },
      { timeoutMs: 90_000 }
    );
    raw = firstOutput(generated);
  }

  if (!raw) throw new Error("OmniVoice returned no audio for this line");
  return keep(raw, userId, `line-${tag}`);
}
