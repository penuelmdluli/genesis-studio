// ============================================
// SERIES STUDIO — the music under the scene
// ============================================
// An episode carrying only dialogue reads as a rehearsal. Every micro-drama
// worth finishing has something running underneath it, and at a fraction of a
// cent per episode there is no reason not to.
//
// Instrumental, always: a vocal track would fight the performance and the
// subtitles at the same time. It is mixed well under the speech, so it is
// felt rather than listened to.

import { runWsModelSync, WS_MODELS } from "@/lib/wavespeed-tools";
import { styleForGenre } from "@/lib/series/style";

/** What the music should sound like, taken from the genre the creator chose. */
const SCORE_BY_GENRE: Record<string, string> = {
  drama: "tense cinematic underscore, dark strings, slow pulse, restrained",
  family: "warm gentle underscore, soft piano, hopeful, unhurried",
  "township comedy": "light playful underscore, bright kwaito-tinged groove, upbeat",
  crime: "menacing underscore, low bass pulse, sparse percussion, dread",
  romance: "tender underscore, soft strings and piano, intimate",
  thriller: "urgent underscore, driving pulse, rising tension, sharp strings",
};

function tagsFor(genre: string | null | undefined): string {
  // The scores behind iVideo Studio's own action and cartoon films.
  const style = styleForGenre(genre);
  if (style === "action") {
    return "hybrid orchestral action movie score, pounding drums, pulsing synth bass, huge brass hits, fast tempo, rising tension, instrumental, no vocals";
  }
  if (style === "cartoon") {
    return "whimsical adventurous orchestral animated film score, playful woodwinds, soaring strings, joyful brass fanfare, instrumental, no vocals";
  }
  const key = (genre || "drama").toLowerCase().trim();
  const base = SCORE_BY_GENRE[key] || SCORE_BY_GENRE.drama;
  return `${base}, south african drama score, instrumental, no vocals`;
}

/**
 * Makes a score for one episode and returns its URL, or null if it cannot be
 * made. Null is fine: the episode is assembled without music rather than not
 * at all.
 */
export async function generateScore(
  genre: string | null | undefined,
  seconds: number
): Promise<string | null> {
  try {
    // A little longer than the episode so the loop never has to wrap; the mix
    // is cut to the picture regardless.
    const duration = Math.min(Math.max(Math.round(seconds) + 8, 20), 120);

    const result = await runWsModelSync(
      WS_MODELS.music,
      {
        tags: tagsFor(genre),
        // The model requires the field; this is how it is told to stay
        // instrumental.
        lyrics: "[inst]",
        duration,
      },
      { timeoutMs: 180_000 }
    );

    const url = Array.isArray(result?.outputs) ? String(result.outputs[0] || "") : "";
    return url || null;
  } catch (err) {
    console.error("[SERIES] score generation failed:", err);
    return null;
  }
}
