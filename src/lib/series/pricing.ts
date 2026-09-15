// ============================================
// SERIES STUDIO — what a series costs us, and what it costs them
// ============================================
// Every number here is derived from a real provider price, so the margin is
// visible rather than assumed. Credits are worth about $0.02 at the 500-pack
// rate, and less on bigger packs — the floor is what the margin is checked
// against.
//
// Per shot, at provider cost:
//   still (flux-2-flash)                      $0.008
//   dialogue: lip sync ~5s @ $0.075/s         $0.375
//   action:   cinematic i2v 5s                ~$0.30
//
// So a dialogue shot costs us about $0.383 and earns 100 credits (~$2.00) —
// a little over 5x. An action shot costs about $0.308 and earns 80 credits
// (~$1.60). Writing is Claude only, a couple of cents, and is charged at 10
// credits so that planning a whole season stays effectively free.

export const DIALOGUE_SHOT_CREDITS = 100;
export const ACTION_SHOT_CREDITS = 80;

// Action movie and 3D cartoon series film on Seedance 2.5. Measured
// 2026-09-14: $1.62 per 5s shot, plus the reference still (~$0.14), the
// sound-effects pass ($0.05) and, for speech, lip sync (~$0.375). About $2.20
// for a speaking shot and $1.85 for an action one: 280 and 240 credits keep
// the same healthy multiple the drama shots carry.
// English dialogue shots (since 2026-09-15) are spoken by the video model
// itself: no voice or lip-sync pass, so they cost us less than this assumes.
// Prices are left unchanged; the saving is margin.
export const BLOCKBUSTER_DIALOGUE_SHOT_CREDITS = 280;
export const BLOCKBUSTER_ACTION_SHOT_CREDITS = 240;
export const EPISODE_SCRIPT_CREDITS = 10;

/** Shots per episode. Six is roughly a 30-45 second scene. */
export const DEFAULT_SHOT_COUNT = 6;
export const MIN_SHOT_COUNT = 3;
export const MAX_SHOT_COUNT = 12;

/** Episodes a season may be planned to, in one go. */
export const MAX_SEASON_EPISODES = 10;

export interface ShotLike {
  kind: "dialogue" | "action";
}

/** Credits for one shot of a given kind, in a normal or blockbuster series. */
export function shotCredits(kind: ShotLike["kind"], blockbuster = false): number {
  if (blockbuster) return kind === "dialogue" ? BLOCKBUSTER_DIALOGUE_SHOT_CREDITS : BLOCKBUSTER_ACTION_SHOT_CREDITS;
  return kind === "dialogue" ? DIALOGUE_SHOT_CREDITS : ACTION_SHOT_CREDITS;
}

/** What rendering these shots will cost the creator. Quoted before charging. */
export function renderCost(shots: ShotLike[], blockbuster = false): number {
  return shots.reduce((total, s) => total + shotCredits(s.kind, blockbuster), 0);
}

/** An upfront estimate, before the script exists. Assumes a dialogue-led scene. */
export function estimateEpisodeCost(shotCount: number, blockbuster = false): number {
  const dialogue = Math.ceil(shotCount * 0.7);
  const action = shotCount - dialogue;
  return dialogue * shotCredits("dialogue", blockbuster) + action * shotCredits("action", blockbuster);
}
