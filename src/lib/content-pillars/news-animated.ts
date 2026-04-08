export interface NewsAnimatedInput {
  headline: string;
  summary: string;
  category: string;
  region: string;
}

export interface MultiSceneOutput {
  scenes: Array<{
    prompt: string;
    negative_prompt: string;
    duration: number;
  }>;
  voiceover_script: string;
  caption_hook: string;
  cta: string;
  engine: string;
  total_duration: number;
  aspect_ratio: string;
}

export function generateNewsAnimatedPrompt(input: NewsAnimatedInput): MultiSceneOutput {
  return {
    scenes: [
      {
        prompt: `Breaking news broadcast style opening, dramatic African newsroom with holographic screens showing "${input.headline}", professional African news anchor gesturing, red breaking news banner, cinematic lighting, 9:16 portrait, photorealistic, urgent atmosphere`,
        negative_prompt: "cartoon, anime, low quality, blurry",
        duration: 4,
      },
      {
        prompt: `Cinematic visualization of ${input.summary}, dramatic camera movement, photorealistic, relevant ${input.region} setting, emotional lighting, 9:16 portrait, 8K detail, news documentary style`,
        negative_prompt: "cartoon, anime, low quality, blurry, text overlay",
        duration: 4,
      },
      {
        prompt: `Dramatic wide shot aftermath or resolution scene related to ${input.headline}, people reacting, ${input.region} urban or rural setting as appropriate, golden hour or dramatic lighting, cinematic composition, 9:16 portrait, photorealistic`,
        negative_prompt: "cartoon, anime, low quality, blurry",
        duration: 4,
      },
    ],
    voiceover_script: `Breaking news from ${input.region}. ${input.summary}. Stay tuned for more updates.`,
    caption_hook: `BREAKING: ${input.headline}`,
    cta: "Follow for daily African news animated",
    engine: "wan-2.2",
    total_duration: 12,
    aspect_ratio: "portrait",
  };
}
