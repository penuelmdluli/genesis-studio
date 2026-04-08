export interface GenesisDemoInput {
  original_prompt: string;
  model_name: string;
}

export interface DemoOutput {
  format: "reveal";
  video_prompt: string;
  negative_prompt: string;
  caption_hook: string;
  cta: string;
  engine: string;
  duration: number;
  aspect_ratio: string;
  overlay_sequence: Array<{
    type: "text" | "generating" | "video" | "branding";
    content: string;
    duration: number;
  }>;
}

export function generateDemoPrompt(input: GenesisDemoInput): DemoOutput {
  return {
    format: "reveal",
    video_prompt: input.original_prompt,
    negative_prompt: "low quality, blurry, watermark",
    caption_hook: "I typed 10 words. AI made THIS.",
    cta: "Try it FREE at Genesis Studio",
    engine: "wan-2.2",
    duration: 8,
    aspect_ratio: "portrait",
    overlay_sequence: [
      { type: "text", content: input.original_prompt, duration: 3 },
      { type: "generating", content: `Generating with ${input.model_name}...`, duration: 2 },
      { type: "video", content: "generated_video_here", duration: 8 },
      { type: "branding", content: "Genesis Studio", duration: 2 },
    ],
  };
}
