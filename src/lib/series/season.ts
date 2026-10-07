// ============================================
// SERIES STUDIO — the season plan
// ============================================
// Written once, before episode 1, and handed to the writer for every
// episode after. Without it each episode was planned alone: nothing set up
// for a later payoff, no idea where the free episodes end, the same
// cliffhanger twice. (Owner, 2026-10-07: "it's good, but nothing makes me
// want to see what happens next.")
//
// Built on how paid micro-drama is actually written (research brief,
// 2026-10-07): the "emotional spring" (compress with humiliation, release
// with a face-slap reversal), a small payoff followed at once by a bigger
// drop, the audience let in on a secret the characters don't share, the
// free run ending on the biggest question and the payoff landing just after.

import { askClaude, parseJson } from "@/lib/series/claude";

export const CLIFFHANGER_TYPES = [
  "audience-sees-it-first",     // we see the danger/secret before the character does
  "revelation-on-a-face",       // the reveal lands on a reaction, cut before the explanation
  "unexpected-arrival",         // someone walks in who changes everything
  "betrayal",                   // an ally is shown to be on the other side
  "interrupted-confession",     // "There's something I never told you—" and it is cut off
  "binary-choice",              // an impossible choice, cut before it is made
  "identity-reversal",          // someone is not who we thought
  "countdown",                  // a deadline is set
  "threat",                     // explicit danger (use sparingly: it numbs)
] as const;

export interface SeasonEpisodePlan {
  n: number;
  /** One line: what happens. */
  beat: string;
  /** Who is humiliated, cornered or wronged, and how. */
  compress: string;
  /** The small satisfying win (a face-slap, a truth, a moment of power). */
  payoff: string;
  /** The bigger drop that follows at once. */
  drop: string;
  cliffhangerType: (typeof CLIFFHANGER_TYPES)[number];
  /** The exact final image or line, cut one beat before the answer. */
  cliffhanger: string;
}

export interface SeasonPlan {
  /** The secret the AUDIENCE knows and the other characters do not. */
  dramaticIrony: string;
  /** What the hero wants, and the wound behind it. */
  heroWant: string;
  /** The antagonist: who they are, what status they hold, why they are cruel. */
  villain: string;
  /** The big question the season sells. */
  seasonQuestion: string;
  /** Free episodes end here; the next one is the first paid episode. */
  paywallAfter: number;
  episodes: SeasonEpisodePlan[];
}

export interface SeasonInput {
  title: string;
  genre: string | null;
  logline: string | null;
  characterName: string | null;
  characterDescription: string | null;
  languageName: string;
  episodeCount?: number;
}

export async function planSeason(input: SeasonInput): Promise<SeasonPlan> {
  const n = Math.min(Math.max(input.episodeCount ?? 12, 6), 20);
  const paywall = Math.max(3, Math.round(n * 0.4));
  const prompt = `You are the showrunner of a hit vertical micro-drama, the kind viewers pay to unlock episode after episode (ReelShort, DramaBox, Chinese 短剧). Plan season 1 of this series: ${n} episodes, each about one minute.

SERIES: ${input.title}
GENRE: ${input.genre || "drama"}
PREMISE: ${input.logline || "(none given: invent one)"}
LEAD: ${input.characterName || "the lead"}${input.characterDescription ? ` — ${input.characterDescription}` : ""}
SPOKEN LANGUAGE: ${input.languageName}

What makes people pay, and what this plan must build in:
1. DRAMATIC IRONY. Give the audience a secret the other characters do not have (a hidden identity, a hidden power, the truth about a death). Viewers stay to watch the people who look down on the hero dig their own graves.
2. THE EMOTIONAL SPRING. Every episode compresses (the hero is humiliated, accused, mocked, cornered, by a villain who holds status and enjoys using it) and then releases with a 打脸 face-slap: the hero's real worth or power shows, and the one who mocked them is SHOWN in shock. Three beats: mocked, power shown, villain's face falls.
3. SMALL WIN, BIGGER FALL. Every episode pays off something small and then, immediately, something worse happens. Never let an episode end in comfort.
4. THE BIG THING IS WITHHELD. The season question is answered only at the end. Each episode answers one small question and opens a bigger one.
5. THE FREE RUN ENDS ON THE BIGGEST QUESTION. Episodes 1-${paywall} are free. Episode ${paywall} ends on the season's strongest hook; the payoff it promises lands in episode ${paywall + 1} or ${paywall + 2}, so people pay to see it.
6. CLIFFHANGERS ROTATE. Each episode cuts ONE BEAT BEFORE the answer, on new information or a question, never on comfort. Never use the same type twice in a row; use "threat" at most twice. Types: ${CLIFFHANGER_TYPES.join(", ")}.
7. Episode 1 opens on the hero being humiliated in public, inside the first three seconds, before the audience knows anything else. The audience must be on the hero's side within ten seconds.
8. One villain at a time; when one falls, a bigger one is revealed behind them.

Stay faithful to the premise and the lead. Specific, physical, South African where the premise is South African. No filler episodes.

Respond with ONLY this JSON, no markdown:
{
  "dramaticIrony": "...",
  "heroWant": "...",
  "villain": "...",
  "seasonQuestion": "...",
  "paywallAfter": ${paywall},
  "episodes": [
    { "n": 1, "beat": "...", "compress": "...", "payoff": "...", "drop": "...", "cliffhangerType": "one of the types", "cliffhanger": "the exact final image or line" }
  ]
}`;

  const plan = parseJson<SeasonPlan>(await askClaude(prompt, { effort: "medium" }));
  if (!Array.isArray(plan.episodes) || plan.episodes.length === 0) throw new Error("The season plan came back empty");
  plan.paywallAfter = Number(plan.paywallAfter) || paywall;
  plan.episodes = plan.episodes.slice(0, n).map((e, i) => ({
    n: i + 1,
    beat: String(e.beat || "").slice(0, 300),
    compress: String(e.compress || "").slice(0, 300),
    payoff: String(e.payoff || "").slice(0, 300),
    drop: String(e.drop || "").slice(0, 300),
    cliffhangerType: (CLIFFHANGER_TYPES as readonly string[]).includes(e.cliffhangerType)
      ? e.cliffhangerType
      : "revelation-on-a-face",
    cliffhanger: String(e.cliffhanger || "").slice(0, 300),
  }));
  return plan;
}

/** The part of the plan the writer needs for one episode. */
export function episodeBrief(plan: SeasonPlan | null, episodeNumber: number): string {
  if (!plan) return "";
  const ep = plan.episodes.find((e) => e.n === episodeNumber);
  const prev = plan.episodes.find((e) => e.n === episodeNumber - 1);
  const next = plan.episodes.find((e) => e.n === episodeNumber + 1);
  const lines = [
    "--- SEASON PLAN (the showrunner's, follow it) ---",
    `What the AUDIENCE knows that the characters do not: ${plan.dramaticIrony}`,
    `The hero wants: ${plan.heroWant}`,
    `The villain: ${plan.villain}`,
    `The season question (never answer it early): ${plan.seasonQuestion}`,
  ];
  if (ep) {
    lines.push(
      `THIS EPISODE (${ep.n}): ${ep.beat}`,
      `- Compress: ${ep.compress}`,
      `- Payoff (the face-slap): ${ep.payoff}`,
      `- Then the bigger drop: ${ep.drop}`,
      `- Cliffhanger, type "${ep.cliffhangerType}": ${ep.cliffhanger}`
    );
  } else {
    lines.push(`THIS EPISODE (${episodeNumber}) is past the planned season: invent the next turn in the same pattern.`);
  }
  if (prev) lines.push(`Last episode's cliffhanger was "${prev.cliffhangerType}": do NOT end this one the same way.`);
  if (next) lines.push(`Next episode will be: ${next.beat} (set it up, do not spoil it).`);
  if (episodeNumber === plan.paywallAfter) {
    lines.push("THIS IS THE LAST FREE EPISODE. End on the strongest hook of the season so far.");
  }
  lines.push("--- END SEASON PLAN ---");
  return lines.join("\n");
}
