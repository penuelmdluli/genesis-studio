// ---------------------------------------------------------------------------
// Prompt Suggestions & Templates for Genesis Studio
// ---------------------------------------------------------------------------

/**
 * Curated clickable prompts shown when the prompt field is empty.
 * Designed to be inspiring, varied, and produce great AI-generated videos.
 */
export const PROMPT_SUGGESTIONS: string[] = [
  "A golden retriever running through a field of sunflowers at sunset, slow motion, cinematic",
  "Aerial drone shot of Cape Town coastline at sunrise, waves crashing, 4K cinematic",
  "A futuristic cyberpunk city at night with neon lights reflecting on wet streets, rain falling",
  "Time-lapse of a blooming flower in a garden, macro lens, soft natural lighting",
  "An astronaut floating in space with Earth in the background, cinematic lighting, slow motion",
  "A chef preparing a gourmet dish in a professional kitchen, close-up details, warm lighting",
  "African savanna at golden hour, elephants walking toward camera, dust particles in light",
  "A dancer performing contemporary ballet in an empty warehouse, dramatic shadows, slow motion",
];

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  icon: string; // emoji
  template: string;
  placeholders: { key: string; label: string; example: string }[];
}

export const TEMPLATE_CATEGORIES = [
  "All",
  "Business",
  "Social Media",
  "Cinematic",
  "Education",
  "African/SA",
  "Music",
  "Lifestyle",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "product-showcase",
    name: "Product Showcase",
    category: "Business",
    icon: "📦",
    template:
      "A sleek {product} rotating on a minimalist pedestal, studio lighting, soft reflections on a dark surface, luxury commercial aesthetic, 4K",
    placeholders: [
      { key: "product", label: "Product", example: "wireless headphone" },
    ],
  },
  {
    id: "talking-head",
    name: "Talking Head",
    category: "Social Media",
    icon: "🗣️",
    template:
      "A {person_description} speaking directly to camera in a {setting}, natural lighting, shallow depth of field, podcast style",
    placeholders: [
      {
        key: "person_description",
        label: "Person",
        example: "young woman with braids",
      },
      { key: "setting", label: "Setting", example: "modern home office" },
    ],
  },
  {
    id: "recipe-video",
    name: "Recipe Video",
    category: "Lifestyle",
    icon: "🍳",
    template:
      "Top-down shot of hands preparing {dish}, ingredients being added one by one, warm kitchen lighting, food photography style, appetizing",
    placeholders: [
      { key: "dish", label: "Dish", example: "a colorful pasta salad" },
    ],
  },
  {
    id: "property-tour",
    name: "Property Tour",
    category: "Business",
    icon: "🏠",
    template:
      "Smooth walkthrough of a {property_type} with {features}, golden hour light streaming through windows, real estate cinematic style",
    placeholders: [
      {
        key: "property_type",
        label: "Property",
        example: "modern penthouse apartment",
      },
      {
        key: "features",
        label: "Features",
        example: "floor-to-ceiling windows and marble floors",
      },
    ],
  },
  {
    id: "music-video",
    name: "Music Video",
    category: "Music",
    icon: "🎵",
    template:
      "A {performer} performing on stage with {visual_style}, dramatic concert lighting, smoke effects, dynamic camera movement",
    placeholders: [
      { key: "performer", label: "Performer", example: "solo guitarist" },
      {
        key: "visual_style",
        label: "Visual Style",
        example: "neon purple and blue lights",
      },
    ],
  },
  {
    id: "sa-content",
    name: "South African Story",
    category: "African/SA",
    icon: "🇿🇦",
    template:
      "A cinematic shot of {scene} in {location}, warm African light, vibrant colors, cultural richness, documentary style",
    placeholders: [
      {
        key: "scene",
        label: "Scene",
        example: "a street market bustling with activity",
      },
      {
        key: "location",
        label: "SA Location",
        example: "Soweto, Johannesburg",
      },
    ],
  },
  {
    id: "tutorial",
    name: "Tutorial/How-To",
    category: "Education",
    icon: "📚",
    template:
      "Screen recording style: a clear step-by-step demonstration of {topic}, clean background, professional graphics overlay, educational tone",
    placeholders: [
      { key: "topic", label: "Topic", example: "setting up a home studio" },
    ],
  },
  {
    id: "cinematic-landscape",
    name: "Epic Landscape",
    category: "Cinematic",
    icon: "🏔️",
    template:
      "Sweeping aerial shot of {landscape}, {time_of_day}, dramatic clouds, cinematic color grading, Hans Zimmer-style epic mood",
    placeholders: [
      {
        key: "landscape",
        label: "Landscape",
        example: "Drakensberg mountains",
      },
      { key: "time_of_day", label: "Time", example: "golden hour sunset" },
    ],
  },
  {
    id: "fashion",
    name: "Fashion Lookbook",
    category: "Social Media",
    icon: "👗",
    template:
      "A model wearing {outfit} walking through {location}, editorial fashion photography style, soft bokeh background, magazine quality",
    placeholders: [
      {
        key: "outfit",
        label: "Outfit",
        example: "a flowing ankara print dress",
      },
      {
        key: "location",
        label: "Location",
        example: "a sunlit cobblestone street",
      },
    ],
  },
  {
    id: "fitness",
    name: "Fitness/Workout",
    category: "Lifestyle",
    icon: "💪",
    template:
      "An athlete performing {exercise} in {setting}, dynamic angles, motivational energy, high contrast lighting, sports commercial style",
    placeholders: [
      {
        key: "exercise",
        label: "Exercise",
        example: "box jumps and burpees",
      },
      {
        key: "setting",
        label: "Setting",
        example: "an outdoor rooftop gym at dawn",
      },
    ],
  },
];
