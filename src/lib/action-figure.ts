// ============================================
// GENESIS STUDIO — AI Action Figure / Toy Commercial
// ============================================
// One selfie becomes a boxed collectible, and then an advert for it: the
// person is drawn as a figure sealed in its packaging, filmed being opened
// and turned on a stand, and an announcer reads the "special features"
// printed down the side of the box.
//
// None of that is new machinery. The four stages are four engines the studio
// already runs every day:
//
//   1. image edit   google/nano-banana-pro/edit — the reference-shot model
//                   Series Studio uses to keep one face across every shot
//   2. image→video  wavespeed-ai/wan-2.2/i2v-480p — the i2v workhorse in the
//                   model registry
//   3. voice        lib/edge-tts — the voice behind AI Voiceover and Series
//   4. captions     the video service's /stitch-episode pass, which burns one
//                   line onto the clip it belongs to and holds the last frame
//                   until the line has finished being spoken
//
// Caption sync falls out of that last point. Each special feature is its own
// short shot carrying its own voice line and its own burned line, so there
// are no hand-built timings anywhere and therefore nothing to drift. It is
// the same reason Series Studio draws a subtitle across a whole shot rather
// than from a subtitle file.

/** Special features an advert reads out. Three is a rhythm; five is a list. */
export const MIN_FEATURES = 3;
export const MAX_FEATURES = 4;

/** Long enough to be a feature, short enough to fit two burned lines. */
export const MAX_FEATURE_LENGTH = 70;

/**
 * What the creator typed, turned into the lines the advert will use.
 *
 * Accepts either a list or one textarea's worth of newlines, because the page
 * offers both ("write your own" and "write them for me") and neither should
 * need its own cleaning pass. Bullet characters and surrounding quotes are
 * stripped: people paste lists and models return quoted lines, and a burned
 * `• "…"` reads as an error rather than as a design.
 *
 * A marker is only a marker when it is punctuated as one. Stripping any
 * leading digit would turn "3D printed cape" into "D printed cape".
 */
const LIST_MARKER = /^\s*(?:[-•*·–—]+\s*|\d{1,2}[.)]\s*)/;
const EDGE_QUOTES = /^["'“”]+|["'“”]+$/g;

export function normaliseFeatures(raw: string[] | string): string[] {
  const lines = Array.isArray(raw) ? raw : String(raw || "").split(/\r?\n/);
  return lines
    .map((line) =>
      String(line || "")
        .replace(LIST_MARKER, "")
        .replace(EDGE_QUOTES, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, MAX_FEATURES)
    .map((line) => line.slice(0, MAX_FEATURE_LENGTH));
}

/**
 * The figure's name, as it is printed on the box.
 *
 * Kept short for the same reason a real toy name is: the image model prints
 * what it is given across the top of the card, and a sentence comes out as
 * unreadable scribble.
 */
export const MAX_FIGURE_NAME_LENGTH = 24;

export function normaliseFigureName(raw: string): string {
  return String(raw || "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_FIGURE_NAME_LENGTH);
}

// ── Who may not be turned into a figure ──────────────────────────────────
//
// There is no face-identity check anywhere in the studio — nothing to reuse —
// so this is the check. It reads the name and the feature text, not the
// photograph, which means it catches "make Elon Musk an action figure" and
// not a photograph of him uploaded under a made-up name. The consent
// checkbox is what carries that second case, and the two are deliberately
// both mandatory rather than either-or.
//
// A first pass, and knowingly incomplete: it holds the people most likely to
// be asked for. Adding a name is adding a string.
const PUBLIC_FIGURES = [
  // Politics and heads of state
  "donald trump", "joe biden", "barack obama", "kamala harris", "vladimir putin",
  "xi jinping", "narendra modi", "emmanuel macron", "volodymyr zelensky",
  "cyril ramaphosa", "jacob zuma", "julius malema", "nelson mandela",
  "benjamin netanyahu", "kim jong un", "king charles", "pope francis",
  // Business
  "elon musk", "jeff bezos", "mark zuckerberg", "bill gates", "sam altman",
  "warren buffett", "steve jobs", "patrice motsepe", "johann rupert",
  // Music
  "beyonce", "taylor swift", "rihanna", "drake", "kanye west", "kendrick lamar",
  "nicki minaj", "ariana grande", "justin bieber", "billie eilish", "adele",
  "ed sheeran", "bad bunny", "burna boy", "wizkid", "davido", "tyla",
  "black coffee", "cassper nyovest", "nasty c", "master kg", "makhadzi",
  // Screen
  "dwayne johnson", "tom cruise", "leonardo dicaprio", "will smith",
  "keanu reeves", "robert downey jr", "scarlett johansson", "zendaya",
  "margot robbie", "morgan freeman", "denzel washington", "trevor noah",
  "oprah winfrey", "mrbeast",
  // Sport
  "lionel messi", "cristiano ronaldo", "lebron james", "serena williams",
  "usain bolt", "siya kolisi", "caster semenya", "tiger woods", "novak djokovic",
];

/**
 * Comparable form of a name: lowercase, unaccented, punctuation gone.
 * "Beyoncé!!" and "beyonce" have to be the same string or the list is
 * decoration.
 */
const COMBINING_FIRST = 0x0300;
const COMBINING_LAST = 0x036f;

function comparable(text: string): string {
  // The accent is dropped rather than replaced. Decomposing "é" leaves an "e"
  // followed by a combining mark, and letting the next step turn that mark
  // into a space would split "Beyoncé" into two words and miss the name.
  const unaccented = Array.from(String(text || "").normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_FIRST || code > COMBINING_LAST;
    })
    .join("");

  return unaccented
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The public figure named in any of these pieces of text, or null.
 *
 * Matched on whole words with the haystack padded on both sides, so "drake"
 * hits "Drake" and not "Drakensberg".
 */
export function blockedPublicFigure(...texts: Array<string | undefined | null>): string | null {
  const hay = ` ${comparable(texts.filter(Boolean).join(" "))} `;
  if (hay.trim().length === 0) return null;
  for (const figure of PUBLIC_FIGURES) {
    if (hay.includes(` ${figure} `)) return figure;
  }
  return null;
}

/** The refusal, in the words the user reads. */
export const PUBLIC_FIGURE_MESSAGE =
  "This tool only makes a figure of you, or of someone who has given you permission. It cannot be used to make one of a well-known public figure.";

/** What the consent checkbox says, in one place so the page and the API agree. */
export const CONSENT_TEXT =
  "I confirm this is my own photo or I have the person's permission to use it";

// ── Prompts ──────────────────────────────────────────────────────────────

/**
 * What the image-edit model is asked for.
 *
 * It leads with the person because that is the thing that must survive — the
 * same reason the Series reference shots put the character first. Everything
 * after it is packaging: the blister pack, the printed card, the name across
 * the top. Text on the card is limited to the name for the usual reason, that
 * an image model asked for a paragraph renders scribble.
 */
export function buildFigureImagePrompt(figureName: string): string {
  return [
    "Turn the person in this photograph into a collectible action figure, still sealed in its original toy packaging.",
    "The figure is a full-body plastic action figure of THEM — same face, same hairstyle, same outfit, moulded in glossy plastic with visible joints —",
    "standing inside a clear blister pack on a printed cardboard backing card.",
    `The card is bright and glossy with bold comic-book packaging art and the name "${figureName}" printed large across the top.`,
    "Small accessory pieces are moulded into the tray beside the figure.",
    "Studio product photography, vertical 9:16 composition, the boxed figure centred against a clean gradient background, sharp focus, strong key light.",
    "No other people, no watermark, no extra lettering anywhere on the card.",
  ].join(" ");
}

/**
 * The beats of the advert, in order.
 *
 * The first shot opens the pack and the rest turn the figure, which is the
 * grammar every toy advert has used since toy adverts existed. A commercial
 * runs one beat per special feature, so a three-feature advert simply stops
 * after the third.
 */
const SHOT_BEATS = [
  "Hands lift the sealed box into frame and crack the blister pack open, cardboard flexing and plastic catching the light",
  "The figure stands on a turntable and rotates a slow full circle, the key light sweeping across its face and chest",
  "The camera pushes in close while the turntable keeps turning, catching the moulded accessories and the printed artwork on the card behind",
  "The figure is planted in a hero pose on its stand and the camera orbits it, packaging art filling the background",
];

/** How many shots an advert with this many features runs to. */
export function shotCount(featureCount: number): number {
  return Math.min(Math.max(featureCount, 1), SHOT_BEATS.length);
}

/** Motion direction for one shot, filmed from the boxed-figure still. */
export function buildShotMotionPrompt(index: number): string {
  const beat = SHOT_BEATS[index % SHOT_BEATS.length];
  return `${beat}. The action figure and its packaging are exactly the ones in the photograph. Glossy toy commercial lighting, clean studio background, smooth cinematic camera move. No people talking, no text on screen.`;
}

/**
 * Delivery for the announcer.
 *
 * A toy advert is read hot — faster, higher and louder than a voiceover. The
 * free neural voices take all three as SSML, so the hype costs nothing beyond
 * the numbers below.
 */
export const ANNOUNCER_DELIVERY = { rate: "+14%", pitch: "+10Hz", volume: "+35%" };

/**
 * Who reads the advert.
 *
 * The id IS the speech engine's own voice name, the way SERIES_LOCALES does
 * it, rather than a friendly id mapped to one somewhere else. The two friendly
 * maps that already exist — AI Voiceover's and Product Ads' — disagree with
 * each other on three voices today (alex, sophia and marcus all resolve to
 * different people depending on which page you came from). A third map would
 * drift the same way.
 */
export const ANNOUNCER_VOICES: Array<{ id: string; label: string }> = [
  { id: "en-ZA-LukeNeural", label: "Luke — South African" },
  { id: "en-ZA-LeahNeural", label: "Leah — South African" },
  { id: "en-US-GuyNeural", label: "Guy — American" },
  { id: "en-US-AriaNeural", label: "Aria — American" },
  { id: "en-GB-RyanNeural", label: "Ryan — British" },
  { id: "en-NG-AbeoNeural", label: "Abeo — Nigerian" },
];

export const DEFAULT_ANNOUNCER = ANNOUNCER_VOICES[0].id;

/** The chosen voice, or the default when the client sends something unknown. */
export function announcerVoice(id: string | undefined): string {
  return ANNOUNCER_VOICES.some((v) => v.id === id) ? (id as string) : DEFAULT_ANNOUNCER;
}

// ── Price ────────────────────────────────────────────────────────────────
//
// NOT measured against a real charge — derived from prices already in the
// codebase, and it should be re-checked against a balance reading before and
// after a real run the way the Creator Tools prices were:
//
//   boxed figure still   nano-banana-pro/edit, ~$0.14 per image
//                        (lib/series/pricing.ts, "reference still")
//   each shot            wan-2.2 480p, which the model registry already
//                        charges 30 credits for (lib/constants.ts)
//   voice and captions   ours — Edge TTS and our own video service
//
// A four-feature advert is 145 credits against roughly $0.14 + four i2v
// calls of provider cost.
export const FIGURE_IMAGE_CREDITS = 25;
export const SHOT_CREDITS = 30;

export function commercialCredits(featureCount: number): number {
  return FIGURE_IMAGE_CREDITS + shotCount(featureCount) * SHOT_CREDITS;
}

/** Roughly how long a run takes, for the progress bar. */
export function estimatedSeconds(featureCount: number): number {
  return 60 + shotCount(featureCount) * 45;
}
