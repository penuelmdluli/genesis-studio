import type { PillarOutput } from "./index";

export interface FolkloreInput {
  legend: string;
  character: string;
  setting: string;
  action: string;
}

export function generateFolklorePrompt(input: FolkloreInput): PillarOutput {
  return {
    video_prompt: `Epic cinematic scene from African legend of ${input.legend}, ${input.character} in ${input.setting}, ${input.action}, firelight and golden hour lighting, hyper-detailed authentic African cultural clothing and artifacts, Studio Ghibli quality meets African epic, dramatic composition, emotional storytelling, 9:16 vertical, rich earth tones and vibrant traditional colors, atmospheric particles, volumetric lighting`,
    negative_prompt: "western clothing, modern buildings, low quality, blurry, anime face, cartoon style",
    caption_hook: "They never taught you this in school",
    cta: "Which legend should we animate next?",
    engine: "wan-2.2",
    duration: 10,
    aspect_ratio: "portrait",
  };
}
