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

import { styleForGenre } from "@/lib/series/style";
import { envString } from "@/lib/env";
import { askClaude, parseJson } from "@/lib/series/claude";
import { episodeBrief, type SeasonPlan } from "@/lib/series/season";
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
      // "South African English" previously invited isiZulu words into the
      // dialogue. Choosing English has to mean English, or the subtitles and
      // the voice both end up fighting the script.
      return "Write ALL spoken dialogue in ENGLISH ONLY. South African English rhythm, cadence and turns of phrase are welcome, but every single word must be English — no isiZulu, isiXhosa, Afrikaans or Sesotho words at all, not even common ones.";
    case "en":
      return "Write ALL spoken dialogue in plain conversational ENGLISH ONLY. Every word must be English.";
    // The eight languages OmniVoice added. Written as they are spoken now,
    // which in South Africa means a word or two of English slipping in is
    // normal — a strictly "pure" line reads as a textbook, not a person.
    case "xh-ZA":
    case "st-ZA":
    case "tn-ZA":
    case "nso-ZA":
    case "ts-ZA":
    case "ss-ZA":
    case "ve-ZA":
    case "nr-ZA": {
      const label = localeOrDefault(id).label;
      return `Write ALL spoken dialogue in natural, conversational ${label} as it is actually spoken in South Africa today, not formal or textbook ${label}. Code-switching into English for a word or two is normal and welcome, exactly how people really talk. Use correct ${label} spelling and grammar so it is pronounced properly when spoken aloud.`;
    }
    default: {
      const label = localeOrDefault(id).label.replace(/ — .*$/, "");
      const place = localeOrDefault(id).label.includes(" — ")
        ? ` as it is actually spoken in ${localeOrDefault(id).label.split(" — ")[1]}`
        : "";
      return `Write ALL spoken dialogue in ${label}${place}, and in that language only. Use the way people really talk, not formal written language, and do not drift into English.`;
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
  /**
   * How the beat is framed.
   *
   * Chosen per shot by the writer rather than derived from emotion, because
   * deriving it produced a close-up on almost every beat — the single most
   * common mistake in vertical drama, and why the episodes read as flat.
   * Medium carries dialogue, close-up is saved for the line that has to land,
   * wide is used sparingly because 9:16 wastes width, and an insert on a
   * prop or a pair of hands is the cheapest variety there is.
   */
  shotSize: "wide" | "medium" | "close" | "insert" | "ots" | "two";
  /**
   * The other person sharing the frame (2026-10-07 film upgrade). In an
   * "ots" (over-the-shoulder) dialogue shot they are seen FROM BEHIND in the
   * foreground, face hidden, so the lip-sync still animates one mouth; in a
   * silent "two" shot both faces are visible. A scene where everyone stands
   * alone in their own frame never feels like two people in one room.
   */
  listener?: string;
  /** Drives both the performance and the camera. */
  emotion: "calm" | "angry" | "afraid" | "joyful" | "grieving" | "tense" | "shocked";
  /** Action shots get cinematic motion; dialogue shots get lip sync. */
  kind: "dialogue" | "action";
  /**
   * The shot's job in the episode's emotional spring (2026-10-07): the
   * editor holds each beat for as long as that job needs, and the reveal
   * and the cliffhanger get their sound.
   */
  beat?: "hook" | "squeeze" | "slap" | "reaction" | "drop" | "build" | "cliff";
  /** The performance as a body does it: eyes, jaw, hands, breath. Not a label. */
  acting?: string;
  /** Angle and move: "low angle, slow push-in", "eye level, static". */
  camera?: string;
  /** How long the shot is held on screen, in seconds (1.5 to 5). */
  holdSeconds?: number;
  /**
   * The approved still for this shot, made by the stills step before any
   * video is paid for. When present, filming starts from it as-is.
   */
  stillUrl?: string;
  /** How many times the creator asked for this still again (capped). */
  stillRedos?: number;
}

/** A character's locked look, as the writer described them. */
export interface CharacterLook {
  name: string;
  look: string;
}

export interface EpisodeDraft {
  title: string;
  synopsis: string;
  shots: Shot[];
  /** Replaces the series recap once the episode is made. */
  storySoFar: string;
  /** The hook that makes them watch the next one. */
  cliffhanger: string;
  /**
   * Where this episode happens, as ONE set described visually. Every shot is
   * built in a picture of it, so the scene is one room in one light.
   */
  location?: string;
  /** Every character on screen, with a fixed visual description. */
  characters?: CharacterLook[];
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
  /**
   * Looks already locked for this series. Handed back to the writer so a
   * returning character is described exactly as before.
   */
  knownLooks?: CharacterLook[];
  /** The showrunner's season plan; every episode is written against it. */
  seasonPlan?: SeasonPlan | null;
}

const EMOTIONS = ["calm", "angry", "afraid", "joyful", "grieving", "tense", "shocked"] as const;
const SHOT_SIZES = ["wide", "medium", "close", "insert", "ots", "two"] as const;
const BEATS = ["hook", "squeeze", "slap", "reaction", "drop", "build", "cliff"] as const;

/**
 * The script editor. Reads the draft against the rules it was written to,
 * scores the parts that decide whether anyone pays for the next episode,
 * and returns the rewritten script in the same shape.
 */
async function editDraft(draft: EpisodeDraft, brief: string, shotCount: number): Promise<EpisodeDraft> {
  const prompt = `You are the script editor on a hit paid micro-drama. The head writer was given the brief below and wrote the draft after it. Your job: make viewers desperate for the next episode.

Judge the draft, privately, on each of these, 1 to 10:
1. Hook: is something already wrong in the first three seconds, and is the episode's biggest reveal held back rather than spent in shot 1?
2. Squeeze: is the hero humiliated or wronged specifically enough that the audience is angry for them?
3. Slap: does the reversal land in three beats, ending on the mocker's face falling?
4. Drop: does something worse hit right after the win?
5. Cliffhanger: does it cut one beat before the answer, on new information or a face, not on a threat we expected?
6. Dialogue: is every line short, loaded and specific, with subtext, no exposition, and one quotable line?
7. Performance and camera: does every face shot have physical "acting" and a "camera" angle that fits who holds power?
8. Pace: a turn at least every fifteen seconds, most "holdSeconds" under 3?
9. Season plan: does it deliver this episode's planned beat and cliffhanger type?

Then REWRITE every shot that scored under 9 until it would score 9 or 10. Keep exactly ${shotCount} shots, the same characters, location and looks, and every rule in the brief (one speaker per dialogue shot, language, gender, subtitles, shot sizes, listener). Keep what already works.

--- BRIEF ---
${brief}
--- END BRIEF ---

--- DRAFT ---
${JSON.stringify(draft)}
--- END DRAFT ---

Respond with ONLY the rewritten script as JSON in exactly the draft's shape, no markdown, no scores.`;
  return parseJson<EpisodeDraft>(await askClaude(prompt, { effort: "high" }));
}

/**
 * Shot size and the second person in frame, made safe. A speaking line is
 * never a two-shot (two visible faces, two moving mouths): it becomes an
 * over-the-shoulder instead. A two-person framing without a second person
 * named falls back to medium, and nobody shares a frame with themselves.
 */
function framing(
  s: { shotSize?: unknown; listener?: unknown; speaker?: unknown },
  dialogue: string
): { shotSize: Shot["shotSize"]; listener?: string } {
  let size: Shot["shotSize"] = SHOT_SIZES.includes(s.shotSize as never) ? (s.shotSize as Shot["shotSize"]) : "medium";
  const listener = typeof s.listener === "string" ? s.listener.trim().slice(0, 60) : "";
  const speaker = typeof s.speaker === "string" ? s.speaker.trim() : "";
  if (size === "two" && dialogue) size = "ots";
  if ((size === "ots" || size === "two") && (!listener || listener.toLowerCase() === speaker.toLowerCase())) {
    return { shotSize: "medium" };
  }
  return size === "ots" || size === "two" ? { shotSize: size, listener } : { shotSize: size };
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
  language: string
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
    const translations = parseJson<string[]>(
      await askClaude(
        `Translate each line into natural English subtitles. Translate the meaning, not the words — an English viewer should feel what a speaker of the original feels. Keep each translation short enough to read on screen.

Respond with ONLY a JSON array of strings, in the same order, no markdown:
${JSON.stringify(needing.map(({ shot }) => shot.dialogue))}`,
        { effort: "low", maxTokens: 4000 }
      )
    );

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
export interface WriteOptions {
  /**
   * A short-form episode that doubles as an ad, capped at fifteen seconds
   * including a 3.4-second branded end card. That leaves about eleven seconds
   * of story, and spoken dialogue runs roughly three words a second — so
   * lines are held to three to eight words, which is what makes the cap hold
   * without cutting anyone off mid-word.
   */
  shortForm?: boolean;
}

export async function writeEpisode(
  ctx: SeriesContext,
  shotCount = 6,
  options: WriteOptions = {}
): Promise<EpisodeDraft> {
  const key = envString("ANTHROPIC_API_KEY");
  if (!key) throw new Error("The writer is not configured");

  const lang = languageInstruction(ctx.language);
  const first = ctx.episodeNumber <= 1;

  const continuity = first
    ? `This is EPISODE 1. Do not "open the world": open on ${ctx.characterName || "the lead"} already being humiliated, accused or wronged, so the audience is on their side within ten seconds, and end on a hook that demands episode 2.`
    : `This is EPISODE ${ctx.episodeNumber}. Here is everything that has happened so far:

--- STORY SO FAR ---
${ctx.storySoFar || "(nothing recorded)"}
--- END ---

Continue DIRECTLY from that. Do not reset, do not re-introduce characters the audience already knows, do not repeat earlier scenes. Pay off at least one thread that was left open, and open a new one.`;

  const style = styleForGenre(ctx.genre);
  const opening =
    style === "action"
      ? "You are the head writer of an ACTION MOVIE series. You write the kind of episodic action people binge and share: chases, fights, stunts, escapes, explosions, and heroes who talk under fire. Every episode plays like the best ten minutes of a blockbuster."
      : style === "cartoon"
        ? "You are the head writer of a 3D ANIMATED cartoon series for the whole family, at the level of the best animated feature films. You write big-hearted adventure and comedy with expressive characters (people, kids or talking animals), physical gags, danger that is thrilling but never gory, and moments that make families laugh and cheer."
        : "You are the head writer of a South African drama series. You write the kind of episodic drama people actually finish and share: real stakes, real families, money, loyalty, betrayal. Not an advert, not a lesson.";
  const styleRules =
    style === "action"
      ? `
ACTION MOVIE RULES — these override anything softer below.
- At least HALF the shots are "action" set pieces (round up): vehicle chases, rooftop jumps, fights, explosions, escapes, crashes. Make each one specific and physical, with the camera moving. The final shot is a spectacular set piece or a line shouted in the middle of one.
- Speaking shots happen INSIDE the action: shouting from a speeding bike, yelling over an explosion, a warning while running. Never a phone call, never a quiet room.
- A speaking shot's "action" names ONLY the speaker. No henchmen, no crowd, nobody "visible behind" them.
- No guns or firearms: danger comes from chases, crashes, explosions, fists, falls and fire.
- Dialogue is SHOUTED under pressure: warnings, orders, threats, one-liners. "Get down!", "Go, go, go!", "You're too late." Short, punchy, never a speech.
- Emotions are mostly "tense", "angry", "shocked" and "afraid". Save "calm" for a villain's cold threat.
- "wide" is allowed more often here: action needs space to read.
- Speaking frames still hold one person, but action shots may show the hero, the villain, vehicles and crowds.`
      : style === "cartoon"
        ? `
CARTOON RULES — these override anything softer below.
- Characters are animated: say what they look like in "action" (a meerkat pilot in goggles, a kid inventor with a backpack). Talking animals are welcome.
- Big expressive performances: shock takes, joyful jumps, comic panic. Emotions are mostly "joyful", "shocked", "afraid" and "tense".
- Mix comedy with adventure: a chase, a daring escape, a silly mishap, a triumphant moment.
- Dialogue is funny and warm, sometimes shouted in excitement or panic. Family-friendly always: no swearing, no gore, no weapons.
- At least half the shots are "action": flying, chasing, tumbling, escaping, celebrating.
- A speaking shot's "action" names ONLY the speaker, nobody else in frame.
- Action shots may show groups: cheering villages, rival characters, animal crowds.`
        : "";

  const prompt = `${opening}

SERIES: ${ctx.title}
GENRE: ${ctx.genre || "drama"}
${ctx.logline ? `PREMISE: ${ctx.logline}` : ""}
LEAD CHARACTER: ${ctx.characterName || "the lead"}${ctx.characterDescription ? ` — ${ctx.characterDescription}` : ""}

${continuity}

${episodeBrief(ctx.seasonPlan || null, ctx.episodeNumber)}

${styleRules}

${ctx.knownLooks?.length ? `CHARACTERS ALREADY ON SCREEN — reuse these looks WORD FOR WORD if they appear:
${ctx.knownLooks.map((c) => `- ${c.name}: ${c.look}`).join("\n")}
` : ""}
ONE SET PER EPISODE. The whole episode happens in ONE location unless the story truly moves. Describe it in "location" as a film set: the place, time of day, the light, and two or three objects that make it specific ("a Sandton mansion study at dusk, floor-to-ceiling windows over the city, dark wood desk, leather chairs, warm lamp light"). Every shot's "action" must agree with it.

LANGUAGE: ${lang}
Visual direction ("action") stays in ENGLISH. It is read by a camera system, never by the audience.

Write exactly ${shotCount} shots — not one more. ${options.shortForm
  ? `This is a fifteen-second episode, so the ${shotCount} shots are: 1) the HOOK, trouble already happening; 2) the TURN, one reveal that changes everything; 3) the CLIFFHANGER, a line or image that demands the next episode. Ignore any rule below about minimum inserts or shot variety if it would need more than ${shotCount} shots.`
  : ""}

Build it the way a vertical micro-drama is built:

STRUCTURE — the emotional spring, then the cut.
- Shot 1 is the HOOK. Trouble is already happening in the first three seconds: a face mid-shock, a public humiliation, a line that stops the scroll. No throat-clearing, no arriving-and-greeting, no scene-setting. Never spend the episode's biggest reveal in shot 1: show the wound, hold the reveal.
- SQUEEZE: the hero is mocked, accused, cornered or dismissed by someone with status who enjoys it. Make the audience angry on the hero's behalf. Specific insults, never generic ones.
- SLAP (打脸): the reversal in three fast beats: the mockery lands, the hero's real worth or power is shown, and the mocker's face falls (a silent "reaction" shot of THEM). This is the moment people pay for: build to it, then let it breathe.
- DROP: immediately after the win, something worse. Never let the episode rest in comfort.
- The last shot is the CLIFFHANGER: cut ONE BEAT BEFORE the answer, on new information or a question, ideally landing on a face. Not a threat everyone saw coming ("I will break it" is not a cliffhanger). If the viewer feels satisfied, you cut too late.
- A turn, a reveal or a reversal at least every fifteen seconds. Cut anything that is only information.
- Give every shot a "beat": "hook", "squeeze", "slap", "reaction", "drop", "build" or "cliff".

SHOTS — vary the framing, deliberately, like a filmed scene and not a row of passport photos.
Give every shot a "shotSize" of "ots", "medium", "close", "two", "wide" or "insert":
- "ots" (over-the-shoulder) is how a confrontation is filmed: the speaker faces the camera, and the person they are talking to is in the near foreground SEEN FROM BEHIND (back of the head and one shoulder, face hidden). Set "listener" to that person's exact name. Use "ots" for most of the lines in an argument or an exchange between two people, alternating sides as the speakers alternate, so the audience always knows who is facing whom.
- "medium" (waist up) is for a line spoken to nobody in particular, or to a group. Never a full-length standing pose.
- "close" is for the ONE line in the scene that has to land emotionally. Do not put a close-up on every beat; that is the commonest mistake and it makes an episode feel flat.
- "wide" establishes where we are. Use it sparingly, and only when the space itself matters.
- "insert" is a detail with no face in it: a hand on a gate latch, cash on a table, a phone screen, a car door. Use at least one per episode. It is the cheapest way to make a scene feel filmed.
- "two" is a SILENT shot (kind "action", no dialogue) with both people fully in frame, facing each other: the stare-down, the moment someone walks in on someone. Set "listener" to the second person. Use one or two per episode, usually at the turn and at the cliffhanger.
- REACTION SHOTS: after a line that lands, cut to the person who heard it — a silent "close" action shot of their face reacting. At least one per episode. It is what makes a line hit.
Do not repeat the same shotSize more than twice in a row.

BODIES — nobody poses for the camera.
- Every person is doing something with their body and the room: sitting at the desk, leaning on a chair back, gripping the papers, turning towards the window, standing up from a chair. Say it in "action".
- Never describe someone standing straight, arms at their sides, facing the camera.

ACTION — this is a drama, not an interview.
- Use "action" shots (no speech) for arrivals, reveals, and the beats between lines, and make them genuinely physical: a car pulls up, a gate is shoved open, money is thrown down, somebody walks out.
- Even in a dialogue shot the person must be DOING something, not standing still talking.

CONTINUITY — the picture must match the words.
- "action" must agree with the line. If a character says "come inside", the action shows them moving through the doorway — not standing outside facing the street. If they are leaving, they move away from what they are leaving.
- Say which way the character faces or moves when it matters, and keep it consistent between consecutive shots.
- One speaker per dialogue shot. The only other person allowed in a dialogue frame is the "ots" listener, seen from behind with their face hidden.

DIALOGUE — every line is a weapon or a wound.
- Short, loaded, specific. People say less than they mean. Subtext over statement: never "I am angry", never "you are lying to me"; slam the door, throw the papers, laugh at the wrong moment.
- No exposition and no explaining feelings. Nobody tells another character something they both already know.
- The villain is articulate, cruel and sure of their status. The hero says little, and when the hero finally speaks, it lands.
- At least one line per episode the audience will want to quote.

PERFORMANCE AND CAMERA — direct like a premium short drama.
- "acting": the performance as the body does it, never a label. Not "sad" but "eyes welling, jaw clenched, swallowing hard, fingers crushing the paper". Not "angry" but "nostrils flaring, voice dropping to a whisper, leaning in". Every face shot gets one.
- "camera": angle and movement in a few words. Low angle on whoever holds power in that moment; high angle on whoever has just lost it; a slow push-in on a reveal; a static frame on a stare-down; a whip to the face that reacts.
- Faces fill the vertical frame: mostly "ots", "medium" and "close"; "wide" only to show a confrontation's distance.
- "holdSeconds": how long the shot stays on screen. Reactions and inserts 1.5 to 2.5; a normal line is about its length plus a breath; the slap and the cliffhanger may hold 3 to 4. Most shots are under 3.

Rules that matter:
- ${options.shortForm
    ? "A dialogue line is ONE person speaking, 3 to 8 words — never more. This is a fifteen-second episode; every line must land in under three seconds."
    : "A dialogue line is ONE person speaking, 4 to 18 words. Real speech, not a speech."}
- Alternate speakers where two people are talking.
- "action" is a single clear visual sentence: who is in frame, what they do, where. Always name the character.
- For a DIALOGUE shot, "action" describes the speaker and what their body is doing. In an "ots" shot it may also place the listener's back and shoulder in the foreground, but NEVER their face: a second face on screen makes it impossible to tell who is talking.
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
    { "kind": "dialogue", "speaker": "character name", "gender": "female" or "male", "shotSize": "ots" | "medium" | "close" | "two" | "wide" | "insert", "listener": "the other person in frame for ots and two, else omit", "dialogue": "the line in the series language, empty for action shots", "subtitle": "the same line translated into natural English, empty for action shots", "action": "English visual direction that matches the line", "emotion": "calm", "beat": "hook" | "squeeze" | "slap" | "reaction" | "drop" | "build" | "cliff", "acting": "the performance as the body does it", "camera": "angle and move", "holdSeconds": 2.5 }
  ],
  "cliffhanger": "one line, English, what is left hanging",
  "location": "the ONE set this episode happens in, described visually: place, time of day, light, specific objects",
  "characters": [ { "name": "exactly as used in speaker", "look": "fixed visual description: age, build, skin, hair, clothing, one signature item. Reuse a known look word for word." } ],
  "storySoFar": "a rewritten recap covering everything from episode 1 through this one, under 250 words, English. This is the only memory the next episode gets, so carry forward every name, relationship and unresolved thread."
}`;

  let draft: EpisodeDraft;
  try {
    draft = parseJson<EpisodeDraft>(await askClaude(prompt, { effort: "high" }));
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error("The writer returned something unreadable — please try again");
    throw err;
  }

  // The script editor's pass: the same script, judged against what makes a
  // viewer pay for the next episode, and rewritten where it falls short.
  // A failed pass keeps the first draft rather than losing the episode.
  if (!options.shortForm && Array.isArray(draft.shots) && draft.shots.length) {
    try {
      const edited = await editDraft(draft, prompt, shotCount);
      if (Array.isArray(edited.shots) && edited.shots.length) draft = edited;
    } catch (err) {
      console.error("[SERIES] script editor pass skipped:", err instanceof Error ? err.message : err);
    }
  }

  if (!Array.isArray(draft.shots) || draft.shots.length === 0) {
    throw new Error("The writer returned no scenes — please try again");
  }

  // Trust nothing about the shape. A wrong `kind` would silently route a
  // speaking shot away from lip sync, which is the one thing this sells.
  // The count is enforced here, not trusted from the model. Asked for three
  // shots, it once returned twelve — which would have filmed a thirty-five
  // second "fifteen-second" ad at four times the budget. The first N shots
  // are kept, and the last kept shot is where the cliffhanger was asked for.
  draft.shots = draft.shots.slice(0, Math.min(Math.max(shotCount, 1), 12)).map((s) => {
    let dialogue = String(s.dialogue || "").slice(0, 300).trim();
    if (options.shortForm && dialogue) {
      const words = dialogue.split(/\s+/);
      if (words.length > 8) dialogue = words.slice(0, 8).join(" ").replace(/[,;:]$/, "") + ".";
    }
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
      ...framing(s, dialogue),
      kind: dialogue ? ("dialogue" as const) : ("action" as const),
      beat: BEATS.includes(s.beat as never) ? s.beat : undefined,
      acting: s.acting ? String(s.acting).slice(0, 240) : undefined,
      camera: s.camera ? String(s.camera).slice(0, 120) : undefined,
      holdSeconds: Number.isFinite(Number(s.holdSeconds))
        ? Math.min(5, Math.max(1.5, Number(s.holdSeconds)))
        : undefined,
    };
  });

  await ensureEnglishSubtitles(draft.shots, ctx.language);

  draft.title = String(draft.title || `Episode ${ctx.episodeNumber}`).slice(0, 120);
  draft.synopsis = String(draft.synopsis || "").slice(0, 600);
  draft.cliffhanger = String(draft.cliffhanger || "").slice(0, 300);
  draft.storySoFar = String(draft.storySoFar || ctx.storySoFar || "").slice(0, 4000);
  draft.location = draft.location ? String(draft.location).slice(0, 400) : undefined;
  draft.characters = Array.isArray(draft.characters)
    ? draft.characters
        .filter((c) => c && typeof c.name === "string" && typeof c.look === "string")
        .map((c) => ({ name: c.name.slice(0, 60), look: c.look.slice(0, 500) }))
        .slice(0, 12)
    : [];

  return draft;
}
