// ============================================
// SERIES STUDIO — the look of a series
// ============================================
// Three looks, chosen by the genre the creator picks:
//
//   drama    photoreal South African drama (the original look)
//   action   Hollywood blockbuster: chases, stunts, explosions
//   cartoon  a 3D animated feature: expressive characters, bright worlds
//
// The action and cartoon wording is exactly what made iVideo Studio's own
// marketing films (AI Action Movie, AI Cartoon Movie, AI Beast Wars), and
// those two looks render on the stronger video model. Creators get the
// level they saw in the ads, not an approximation of it.

export type VisualStyle = "drama" | "action" | "cartoon";

export interface StyleSpec {
  /** Closes every still prompt. */
  look: string;
  /** Closes every motion prompt. */
  motion: string;
  /** How the reference portrait of a character is drawn. */
  portrait: string;
  /** Image-to-video model used to film each shot. */
  videoModel: string;
  /** Renders on the premium model and is priced as such. */
  blockbuster: boolean;
  /** Seconds a shot with nobody speaking is held for in the cut. */
  silentHold: number;
  /** Score level under the episode. Louder where there is less talk. */
  musicVolume: number;
  /** What the sound-effects pass is told the world sounds like. */
  sound: string;
}

const LIVE =
  "Hollywood action blockbuster, photoreal, shot on ARRI Alexa, anamorphic lens, dramatic rim lighting, " +
  "motion blur, sparks and debris, 35mm film grain";

const TOON =
  "Premium 3D animated feature film style, expressive cartoon characters, big shiny eyes, soft global illumination, " +
  "vibrant saturated colours, subsurface scattering fur and skin, cinematic camera";

export const STYLES: Record<VisualStyle, StyleSpec> = {
  drama: {
    look: "Cinematic South African drama, photoreal, film grain, natural skin texture, 35mm.",
    motion: "Cinematic handheld camera movement, dramatic, photoreal.",
    portrait: "Full body portrait standing in a South African township street, neutral expression, facing camera, even daylight. Photoreal, 35mm, natural skin texture.",
    videoModel: "bytedance/seedance-v1.5-pro/image-to-video",
    blockbuster: false,
    silentHold: 3.2,
    musicVolume: 0.14,
    sound: "realistic ambience and natural sound effects",
  },
  action: {
    look: `${LIVE}, vertical composition with the subject centred.`,
    motion: "Fast dynamic camera, tracking and whip pans, slow motion on impacts, Hollywood action blockbuster, photoreal.",
    portrait: `Full body character portrait, standing, facing camera, confident stance, city at dusk behind. ${LIVE}.`,
    videoModel: "bytedance/seedance-2.5/image-to-video",
    blockbuster: true,
    silentHold: 4.6,
    musicVolume: 0.2,
    sound: "powerful blockbuster sound effects: engines, impacts, whooshes, explosions, footsteps",
  },
  cartoon: {
    look: `${TOON}, vertical composition with the subject centred.`,
    motion: "Lively animated camera, bouncy expressive character animation, squash and stretch, 3D animated feature film.",
    portrait: `Full body 3D animated character, standing, facing camera, friendly expressive pose, simple colourful background. ${TOON}.`,
    videoModel: "bytedance/seedance-2.5/image-to-video",
    blockbuster: true,
    silentHold: 4.2,
    musicVolume: 0.2,
    sound: "playful cartoon sound effects: whooshes, boings, footsteps, ambience",
  },
};

/** The look a series gets from its genre. Anything unrecognised is drama. */
export function styleForGenre(genre: string | null | undefined): VisualStyle {
  const g = (genre || "").toLowerCase();
  if (/cartoon|animat|anime|kids/.test(g)) return "cartoon";
  if (/action/.test(g)) return "action";
  return "drama";
}

export function styleSpec(style: VisualStyle | undefined): StyleSpec {
  return STYLES[style || "drama"] || STYLES.drama;
}
