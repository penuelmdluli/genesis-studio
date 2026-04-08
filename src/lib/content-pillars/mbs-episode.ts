import type { PillarOutput } from "./index";

export interface MBSCharacter {
  name: string;
  signature_trait: string;
  outfit_description: string;
}

export interface MBSInput {
  character: MBSCharacter;
  scenario: string;
  setting: string;
}

export function generateMBSPrompt(input: MBSInput): PillarOutput {
  return {
    video_prompt: `Adorable realistic baby ${input.character.name} with ${input.character.signature_trait}, wearing ${input.character.outfit_description} with embroidered star branding, ${input.scenario}, rich South African ${input.setting} setting, crowd reacting with amazement, cinematic lighting, hyper-detailed baby features, 9:16 portrait composition, bokeh background, ultra-realistic, warm golden tones, dramatic slow motion`,
    negative_prompt: "scary, horror, violence, blood, deformed face, ugly, blurry, low quality",
    caption_hook: "WHO DIS",
    cta: "Drop a star if you know this baby!",
    engine: "wan-2.2",
    duration: 8,
    aspect_ratio: "portrait",
  };
}
