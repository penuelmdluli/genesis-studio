import type { PillarOutput } from "./index";

export interface AfrofuturismInput {
  city: string;
  detail: string;
}

export { type PillarOutput };

export function generateAfrofuturismPrompt(input: AfrofuturismInput): PillarOutput {
  return {
    video_prompt: `Cinematic wide shot of ${input.city} in 2050, ${input.detail}, Afrocentric architecture blended with advanced solar technology, golden hour lighting, 8K ultra-detailed, Afrofuturism aesthetic, photorealistic, slow cinematic push-in camera movement, crowd of stylish Africans in futuristic fashion, flying transport vehicles in background, lush greenery integrated into buildings, vibrant colors`,
    negative_prompt: "blurry, low quality, text, watermark, deformed, ugly, western architecture only",
    caption_hook: "They said Africa was behind. Look again.",
    cta: "Which city should we show next?",
    engine: "wan-2.2",
    duration: 8,
    aspect_ratio: "portrait",
  };
}
