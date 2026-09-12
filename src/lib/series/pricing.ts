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

/** What rendering these shots will cost the creator. Quoted before charging. */
export function renderCost(shots: ShotLike[]): number {
  return shots.reduce(
    (total, s) => total + (s.kind === "dialogue" ? DIALOGUE_SHOT_CREDITS : ACTION_SHOT_CREDITS),
    0
  );
}

/** An upfront estimate, before the script exists. Assumes a dialogue-led scene. */
export function estimateEpisodeCost(shotCount: number): number {
  const dialogue = Math.ceil(shotCount * 0.7);
  const action = shotCount - dialogue;
  return dialogue * DIALOGUE_SHOT_CREDITS + action * ACTION_SHOT_CREDITS;
}
