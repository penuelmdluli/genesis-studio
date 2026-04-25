// ============================================
// GENESIS STUDIO — Sample Prompts for Onboarding
// Organized by genre for quick-fill on generate page
// ============================================

export interface SamplePrompt {
  id: string;
  label: string;
  genre: string;
  prompt: string;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    id: "cinematic-cape-town",
    label: "Cape Town Coastline",
    genre: "Cinematic",
    prompt: "Cinematic drone shot of Cape Town's coastline at golden hour, waves crashing against rocky cliffs, Table Mountain in the background. Slow dolly push-in, 24mm wide-angle, warm side-light from setting sun, volumetric mist over water. 4K, film grain, photorealistic.",
  },
  {
    id: "cinematic-night-city",
    label: "City at Night",
    genre: "Cinematic",
    prompt: "Aerial establishing shot of a modern African city skyline at night, glass towers reflecting neon lights, traffic flowing on highways below. Slow crane ascending, anamorphic lens flare, teal and orange color grade. Cinematic, 4K.",
  },
  {
    id: "abstract-liquid-gold",
    label: "Liquid Gold",
    genre: "Abstract",
    prompt: "Liquid gold flowing into geometric crystal forms, macro extreme close-up detail, dark obsidian background. Slow motion, 85mm f/1.4, volumetric light catching metallic reflections. Abstract, cinematic, 4K.",
  },
  {
    id: "abstract-particles",
    label: "Cosmic Particles",
    genre: "Abstract",
    prompt: "Millions of glowing particles forming a spiral galaxy, deep space background with nebula colors — purple, cyan, magenta. Slow zoom out revealing the full structure. 4K, photorealistic, volumetric lighting.",
  },
  {
    id: "nature-savanna",
    label: "African Savanna",
    genre: "Nature",
    prompt: "A leopard walking through dappled sunlight in a South African savanna, tall golden grass swaying in gentle wind. Tracking shot, 135mm telephoto compression, shallow depth of field, golden hour warm tones. National Geographic quality, 4K.",
  },
  {
    id: "nature-waterfall",
    label: "Tropical Waterfall",
    genre: "Nature",
    prompt: "Majestic waterfall cascading into a crystal-clear pool surrounded by lush tropical vegetation. Slow motion water droplets catching rainbow light. Crane descending shot, wide-angle, mist particles visible. 4K, cinematic.",
  },
  {
    id: "tech-data-center",
    label: "Data Center",
    genre: "Technology",
    prompt: "Massive data center interior — rows of server racks extending to vanishing point, blue LED status lights blinking in sequence. Cool fluorescent overhead lighting with warm accent from warning indicators. Slow dolly through corridor. Cinematic, 4K, deep focus.",
  },
  {
    id: "tech-circuit",
    label: "Circuit Board",
    genre: "Technology",
    prompt: "Extreme macro close-up of a circuit board, electrical pulses traveling along copper traces, capacitors glowing with energy. Camera slowly panning across the landscape of components. Blue and green accent lighting. 4K, shallow DOF.",
  },
  {
    id: "social-coffee",
    label: "Morning Coffee",
    genre: "Lifestyle",
    prompt: "A coffee cup on a rustic wooden table, steam rising in slow motion, morning sunlight streaming through a window casting warm shadows. Slow zoom in, 50mm natural perspective, golden hour warmth. Cozy, cinematic, 4K.",
  },
  {
    id: "social-food",
    label: "Gourmet Plating",
    genre: "Lifestyle",
    prompt: "Chef's hands carefully plating a gourmet dish, drizzling sauce in slow motion, fresh herbs falling onto the plate. Top-down shot transitioning to 45-degree angle, warm kitchen lighting. Food photography, cinematic, 4K.",
  },
  {
    id: "story-coder",
    label: "Night Coder",
    genre: "Story",
    prompt: "A young coder in Johannesburg works late at night, multiple monitors reflecting code in their glasses, purple neon ambiance from LED strips. Slow dolly push-in, 85mm f/1.4, cyberpunk lighting with bokeh circles. Cinematic, 4K.",
  },
  {
    id: "story-market",
    label: "African Market",
    genre: "Story",
    prompt: "Bustling African market at golden hour — colorful fabrics, fresh produce stalls, hands exchanging goods. Steadicam moving through the crowd, warm side-light, dust particles visible in golden beams. Documentary style, 4K.",
  },
];
