// Re-export all pillar generators
export { generateAfrofuturismPrompt, type AfrofuturismInput } from "./afrofuturism";
export { generateMBSPrompt, type MBSCharacter, type MBSInput } from "./mbs-episode";
export { generateNewsAnimatedPrompt, type NewsAnimatedInput } from "./news-animated";
export { generateFolklorePrompt, type FolkloreInput } from "./african-folklore";

export interface PillarOutput {
  video_prompt: string;
  negative_prompt: string;
  caption_hook: string;
  cta: string;
  engine: string;
  duration: number;
  aspect_ratio: string;
}
