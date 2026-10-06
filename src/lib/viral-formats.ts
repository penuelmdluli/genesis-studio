// ============================================
// GENESIS STUDIO — Viral formats
// ============================================
// One-tap recipes for the AI video formats that are actually going viral
// right now, so a new user's first video is one people share, not a blank
// prompt box. Sourced from the Growth Brain trends engine (Sep–Oct 2026),
// which kept recording the same handful: the ordinary moment that turns
// epic, a giant creature over a real crowd, stepping through a portal into
// a battle, the stadium big-screen close-up, the hero trailer, the power-up.
//
// Each format is photo-first (the person's own photo is what makes it
// theirs and shareable) with a no-photo variant for text-to-video. The
// model is the best one the person's plan includes, so free users get a
// working video and paid plans get the sharper picture and sound.

import type { ModelId } from "@/types";

export interface ViralFormat {
  id: string;
  title: string;
  /** One line under the title: what you get. */
  tagline: string;
  emoji: string;
  /** Tailwind gradient for the card, since we show no paid sample renders. */
  gradient: string;
  /** Image-to-video prompt: animates the uploaded photo. */
  prompt: string;
  /** Text-to-video prompt for people who have no photo to hand. */
  promptNoPhoto: string;
  /** Best first, cheapest last; the first one the plan allows is used. */
  models: ModelId[];
  /** Short placeholder telling them which photo works best. */
  photoHint: string;
}

const CINEMATIC = "cinematic lighting, shallow depth of field, film grain, smooth camera motion, highly detailed, vertical 9:16 framing";

export const VIRAL_FORMATS: ViralFormat[] = [
  {
    id: "ordinary-to-epic",
    title: "Ordinary to Epic",
    tagline: "Your everyday moment becomes a movie scene",
    emoji: "🎬",
    gradient: "from-amber-500/30 to-rose-600/30",
    prompt: `The person in the photo stands still as the camera slowly pushes in. Suddenly the ordinary scene transforms into an epic movie moment: golden light floods in, wind sweeps their hair and clothes, dust and sparks drift through the air, the background expands into a vast dramatic landscape. They lift their head with a confident look straight into the camera. ${CINEMATIC}`,
    promptNoPhoto: `A young South African person waiting at a busy taxi rank. Suddenly the ordinary scene transforms into an epic movie moment: golden light floods in, wind sweeps their clothes, dust and sparks drift through the air, the street expands into a vast dramatic landscape. They lift their head with a confident look straight into the camera. ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A clear photo of you, anywhere ordinary",
  },
  {
    id: "giant-creature",
    title: "Giant Creature Arrives",
    tagline: "A colossal dragon swoops over the crowd",
    emoji: "🐉",
    gradient: "from-emerald-500/30 to-sky-700/30",
    prompt: `Filmed from a phone in the crowd. A colossal dragon swoops down out of the clouds and flies low over the scene in the photo, its giant shadow passing over everyone, wings blasting wind, people look up in awe and shout. The camera shakes slightly as it tilts up to follow the creature. Realistic, ${CINEMATIC}`,
    promptNoPhoto: `Filmed from a phone in a packed stadium crowd. A colossal dragon swoops down out of the clouds and flies low over the stands, its giant shadow passing over everyone, wings blasting wind, fans look up in awe and shout. The camera shakes slightly as it tilts up to follow the creature. Realistic, ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A street, event or crowd photo",
  },
  {
    id: "portal-step",
    title: "Through the Portal",
    tagline: "Step through a glowing portal into battle",
    emoji: "🌀",
    gradient: "from-violet-500/30 to-fuchsia-700/30",
    prompt: `A glowing swirling portal tears open beside the person in the photo, light and energy spilling out. They turn, walk toward it and step through, emerging on the other side onto an epic fantasy battlefield with warriors and a dragon in the sky. The camera follows behind them through the portal in one continuous move. ${CINEMATIC}`,
    promptNoPhoto: `A glowing swirling portal tears open in a quiet city street at night. A young warrior walks toward it and steps through, emerging onto an epic fantasy battlefield with armies and a dragon in the sky. The camera follows behind them through the portal in one continuous move. ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A full-body or half-body photo of you",
  },
  {
    id: "stadium-big-screen",
    title: "Stadium Big Screen",
    tagline: "You on the jumbotron, the crowd goes wild",
    emoji: "🏟️",
    gradient: "from-yellow-400/30 to-green-700/30",
    prompt: `The person in the photo appears live on a giant stadium big screen during a night match, broadcast-style close-up with a scoreboard graphic. They notice they are on the screen, laugh and wave, then celebrate. Cut to the packed crowd cheering and waving flags under the floodlights. ${CINEMATIC}`,
    promptNoPhoto: `A football fan appears live on a giant stadium big screen during a night match in South Africa, broadcast-style close-up with a scoreboard graphic. They notice they are on the screen, laugh and wave, then celebrate with a vuvuzela. Cut to the packed crowd cheering under the floodlights. ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A smiling photo of your face",
  },
  {
    id: "hero-trailer",
    title: "Action Hero Trailer",
    tagline: "Slow-motion walk, explosions behind you",
    emoji: "💥",
    gradient: "from-orange-500/30 to-red-800/30",
    prompt: `Movie trailer shot. The person in the photo walks toward the camera in slow motion, calm and unstoppable, as huge explosions bloom behind them, debris and embers flying past. Their coat moves in the blast wind. Low angle, teal and orange blockbuster colour grade. ${CINEMATIC}`,
    promptNoPhoto: `Movie trailer shot. A calm, unstoppable hero walks toward the camera in slow motion as huge explosions bloom behind them, debris and embers flying past, coat moving in the blast wind. Low angle, teal and orange blockbuster colour grade. ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A full-body photo works best",
  },
  {
    id: "power-up",
    title: "Power Up",
    tagline: "Glowing energy aura, superhero moment",
    emoji: "⚡",
    gradient: "from-cyan-400/30 to-indigo-700/30",
    prompt: `The person in the photo closes their eyes, then a glowing energy aura erupts around them, lightning crackles across their body, their hair lifts in the energy wind, small stones float up from the ground, and they open eyes that glow bright. The camera slowly circles them. ${CINEMATIC}`,
    promptNoPhoto: `A young person closes their eyes, then a glowing energy aura erupts around them, lightning crackles across their body, their hair lifts in the energy wind, small stones float up from the ground, and they open eyes that glow bright. The camera slowly circles them. ${CINEMATIC}`,
    models: ["kling-2.6", "seedance-1.5", "wan-2.2"],
    photoHint: "A clear photo of your face and shoulders",
  },
];

export function getViralFormat(id: string | null | undefined): ViralFormat | undefined {
  return id ? VIRAL_FORMATS.find((f) => f.id === id) : undefined;
}

/** The best model for this format that the person's plan includes. */
export function modelForFormat(format: ViralFormat, available: ModelId[]): ModelId | undefined {
  return format.models.find((m) => available.includes(m)) ?? available[0];
}
