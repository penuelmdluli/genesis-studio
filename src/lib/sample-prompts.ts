// ============================================
// GENESIS STUDIO — Sample Prompts Library
// 12 curated prompts across 4 categories for
// onboarding quick-fill and generate page chips
// ============================================

import { ModelId } from "@/types";

export type SamplePromptCategory = "cinematic" | "character" | "product" | "abstract";

export interface SamplePrompt {
  id: string;
  category: SamplePromptCategory;
  title: string;
  prompt: string;
  thumbnailHint: string;
  recommendedModel: ModelId;
  recommendedDuration: 5 | 10;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  // ---- Cinematic ----
  {
    id: "cinema-cape-coastline",
    category: "cinematic",
    title: "Cape Town coastline at golden hour",
    prompt: "Cinematic aerial drone shot of a rugged coastline at golden hour, waves crashing against dark rocks, warm sunlight, slow forward motion, photorealistic, 4K film grain",
    thumbnailHint: "🌊",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "cinema-savanna-leopard",
    category: "cinematic",
    title: "Leopard in dappled sunlight",
    prompt: "A leopard stalking slowly through tall golden grass in dappled afternoon sunlight, shallow depth of field, slow tracking shot, cinematic 4K quality, natural earth tones",
    thumbnailHint: "🐆",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "cinema-city-rain",
    category: "cinematic",
    title: "Rain-soaked city street at night",
    prompt: "Neon-lit city street at night during light rain, reflections on wet pavement, distant car lights blurred, cinematic moody atmosphere, slow forward dolly, 4K",
    thumbnailHint: "🌃",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  // ---- Character ----
  {
    id: "char-coder-pretoria",
    category: "character",
    title: "Focused coder, late night",
    prompt: "A young African coder in a dimly lit room types intently, multiple monitors glow blue and purple, code reflects in their glasses, cyberpunk aesthetic, medium close-up, cinematic 4K",
    thumbnailHint: "💻",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "char-market-walk",
    category: "character",
    title: "Marketplace stroll",
    prompt: "A confident young woman in colourful traditional African attire walking through a vibrant outdoor marketplace, slow motion, warm afternoon light, market stalls blurred in background, cinematic",
    thumbnailHint: "🛍️",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "char-portrait-laugh",
    category: "character",
    title: "Genuine laughter portrait",
    prompt: "Cinematic close-up portrait of a person laughing genuinely, warm window light from the left, soft bokeh background, 4K detail, candid moment, shallow depth of field",
    thumbnailHint: "😄",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  // ---- Product ----
  {
    id: "product-coffee-steam",
    category: "product",
    title: "Coffee with morning light",
    prompt: "A ceramic coffee cup on a rustic wooden table, steam rising slowly, soft morning sunlight from window, slow zoom in, commercial product shot quality, warm tones, 4K",
    thumbnailHint: "☕",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "product-sneaker-spin",
    category: "product",
    title: "Sneaker on rotating platform",
    prompt: "A clean white sneaker on a rotating black platform, studio lighting from three sides, slow 360 rotation, minimalist commercial product video, high contrast, 4K",
    thumbnailHint: "👟",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "product-watch-detail",
    category: "product",
    title: "Luxury watch macro",
    prompt: "Macro shot of a luxury wristwatch, second hand ticking, light reflecting on metal, deep blacks, soft fill light, cinematic commercial detail shot, 4K",
    thumbnailHint: "⌚",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  // ---- Abstract ----
  {
    id: "abstract-liquid-gold",
    category: "abstract",
    title: "Liquid gold flowing",
    prompt: "Liquid gold flowing into geometric crystal forms, macro detail, dark background, slow motion, hypnotic, premium product feel, deep contrasts, 4K",
    thumbnailHint: "✨",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "abstract-ink-water",
    category: "abstract",
    title: "Ink blooming in water",
    prompt: "Black ink blooming into clear water in slow motion, spreading organic tendrils, soft underlit composition, dramatic high contrast, abstract art, 4K",
    thumbnailHint: "🖤",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
  {
    id: "abstract-particle-storm",
    category: "abstract",
    title: "Particle storm",
    prompt: "Glowing orange particles swirling in a dark void, organic flow patterns, slow drift toward camera, ethereal, deep blacks, cinematic 4K",
    thumbnailHint: "🌟",
    recommendedModel: "wan-2.2",
    recommendedDuration: 5,
  },
];

export function getPromptsByCategory(category: SamplePromptCategory): SamplePrompt[] {
  return SAMPLE_PROMPTS.filter((p) => p.category === category);
}

export function getPromptById(id: string): SamplePrompt | undefined {
  return SAMPLE_PROMPTS.find((p) => p.id === id);
}

export function getRandomPrompts(count: number): SamplePrompt[] {
  const shuffled = [...SAMPLE_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getOnePerCategory(): SamplePrompt[] {
  const categories: SamplePromptCategory[] = ["cinematic", "character", "product", "abstract"];
  return categories.map((cat) => {
    const inCat = getPromptsByCategory(cat);
    return inCat[Math.floor(Math.random() * inCat.length)];
  });
}
