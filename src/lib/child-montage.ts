// ============================================
// GENESIS STUDIO — Child montage: the short film
// ============================================
// The face blend invents one child and stores one photograph of them. This is
// what that photograph was for: three moments from a day in that child's life,
// filmed from the stored face and joined into one short film.
//
// Three beats, fixed rather than chosen — first steps, breakfast, bedtime.
// They are the three photographs every family album already has, in the order
// a day runs, and fixing them is what keeps the tool one button rather than a
// scene editor. The child is the same child in all three because every clip is
// filmed from the same stored reference photograph; nothing here re-invents a
// face between shots.
//
// None of it is new machinery. The clips are the i2v workhorse the whole studio
// films with, the join is the video service's /stitch-episode pass, and the
// music under it is Series Studio's score. The only new thing is the order.

/** Marks a montage job's row, the way "[face-blend]" marks a blend job. */
export const MONTAGE_TAG = "[child-montage]";

/**
 * Marks the join on the row. `/api/jobs/[jobId]` and the reapers poll the
 * provider named by this field, and this one names our own video service
 * instead — so the prefix is what keeps them off it, exactly as "af:" does for
 * AI Action Figure.
 */
export const MONTAGE_JOB_PREFIX = "cm:";

/** Seconds of footage per beat. The i2v workhorse films in fives. */
export const CLIP_SECONDS = 5;

/**
 * The three moments, in the order they are joined.
 *
 * `title` is burned onto its own clip by the join — one line across one shot,
 * the same way a Series subtitle is drawn, which is also what gives the
 * montage its beats. The video service has no crossfade filter, so the titles
 * and the cut are the whole transition; adding one would mean changing the
 * video service, which this step does not.
 */
export const MONTAGE_SCENES: Array<{ key: string; title: string; beat: string }> = [
  {
    key: "first-steps",
    title: "First steps",
    beat:
      "The child takes their first wobbling steps across a sunlit living room floor, arms out for balance, laughing, a soft rug and family furniture behind them",
  },
  {
    key: "breakfast",
    title: "Breakfast",
    beat:
      "The child sits at a kitchen table in the morning eating breakfast from a bowl, spoon in hand, kicking their feet, warm daylight through the window behind them",
  },
  {
    key: "bedtime",
    title: "Bedtime",
    beat:
      "The child is tucked under a duvet in bed at night hugging a soft toy, eyes heavy, a warm bedside lamp glowing beside them",
  },
];

/**
 * What one beat asks the video model for.
 *
 * Every clip leads with the reference photograph because that is the thing
 * that has to survive: the model is handed the stored child face as its input
 * image, and the sentence tells it that the child in the frame IS that child.
 * The same lock the Series reference shots use, for the same reason — three
 * clips of three different children is not a montage of anyone.
 */
export function buildSceneMotionPrompt(index: number): string {
  const scene = MONTAGE_SCENES[index % MONTAGE_SCENES.length];
  return [
    `${scene.beat}.`,
    "This is exactly the child in the reference photograph — same face, same hair, same skin tone. Do not change their features.",
    "Warm natural home-video lighting, gentle handheld camera, vertical 9:16 framing, one child alone in the frame.",
    "No other people, nobody speaking, no text on screen, no watermark.",
  ].join(" ");
}

// ── Price ────────────────────────────────────────────────────────────────
//
// 25 credits for the whole montage, the top of the 20–25 band this was
// approved at.
//
// Flagged rather than hidden: it is well under what the studio's own
// derivation would charge for the same work. AI Action Figure prices one
// wan-2.2 i2v clip at 30 credits (SHOT_CREDITS in lib/action-figure.ts), so
// three of them plus a score and a join would come to roughly 90 there. This
// is an occasion purchase priced as one, and the gap should be re-checked
// against a real provider charge before it is advertised widely.
export const MONTAGE_CREDITS = 25;

/** Roughly how long a montage takes, for the progress copy. */
export const MONTAGE_ESTIMATE_SECONDS = 210;

// ── The music bed ────────────────────────────────────────────────────────
//
// Series Studio's score, asked for the genre whose underscore is "warm gentle
// underscore, soft piano, hopeful, unhurried" (lib/series/score.ts). Nobody
// speaks in a montage, so the bed is the whole soundtrack and sits far louder
// than the 0.14 an episode mixes it under dialogue at.
export const MONTAGE_MUSIC_GENRE = "family";
export const MONTAGE_MUSIC_VOLUME = 0.5;

/**
 * What a creator reads when a montage did not get made.
 *
 * All three scenes or none: a montage missing its middle is a broken output,
 * not a cheaper one, so nothing partial is ever delivered and nothing partial
 * is ever kept. The sentence says both halves of that — the money is back, and
 * pressing the button again is the whole fix.
 */
export const MONTAGE_RETRY_MESSAGE =
  "The montage could not be finished. Your credits have been returned — press Make the montage again to retry.";

/** Height of the finished montage, matching a Series episode. */
export const MONTAGE_HEIGHT: 1280 | 1920 = 1920;

/** How the finished film is titled in the gallery. */
export const MONTAGE_TITLE = "A day with our child";
