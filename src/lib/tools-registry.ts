// ============================================
// GENESIS STUDIO — Creator Tools registry
// ============================================
// The "Quick Tools" the /tools page offers: one input, one button, one
// result. Each entry says what the tool needs, what it costs, which plan it
// needs, and how to call the provider. Adding a tool is adding an entry.
//
// Chosen for South African creators specifically:
//   add-sound       — every AI clip we make is silent; foley makes it feel real
//   remove-bg       — sellers on Takealot/Instagram/Facebook Marketplace
//   dub             — reach Mozambique/Angola (pt), Francophone Africa (fr),
//                     and the world without re-shooting
//   music           — amapiano / afrobeats / gospel beats in seconds
//   image-upscale   — old phone photos → print/poster quality
//   lipsync-video   — swap the voice on an existing clip (new language, new script)

import { WS_MODELS } from "@/lib/wavespeed-tools";

export type ToolInputKind = "video" | "image" | "audio" | "text";
export type PlanId = "free" | "creator" | "pro" | "studio";

export interface ToolField {
  key: string;
  label: string;
  kind: "select" | "text" | "textarea" | "number";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  default?: string | number;
  required?: boolean;
  help?: string;
}

export interface ToolDef {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** What the user must supply. */
  inputs: Array<{ kind: ToolInputKind; key: string; label: string; required?: boolean }>;
  fields?: ToolField[];
  credits: number;
  minPlan: PlanId;
  /** "sync" tools answer in one request; "job" tools return a job id to poll. */
  mode: "sync" | "job";
  outputKind: "image" | "video" | "audio";
  /** Rough wall-clock the UI should show. */
  estimatedSeconds: number;
  model: string;
  /** Turn the user's inputs into the provider request body. */
  buildInput: (i: Record<string, string>) => Record<string, unknown>;
}

const DUB_LANGS = [
  { value: "pt", label: "Portuguese (Mozambique, Angola, Brazil)" },
  { value: "fr", label: "French (West & Central Africa)" },
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "id", label: "Indonesian" },
  { value: "tr", label: "Turkish" },
];

const MUSIC_GENRES: Array<{ value: string; label: string; tags: string }> = [
  { value: "amapiano", label: "Amapiano", tags: "amapiano, log drum, south african house, piano, deep bass, 115 bpm" },
  { value: "afrobeats", label: "Afrobeats", tags: "afrobeats, tropical, percussion, vibrant, 108 bpm" },
  { value: "gqom", label: "Gqom", tags: "gqom, durban, dark, minimal, heavy kick, 125 bpm" },
  { value: "kwaito", label: "Kwaito", tags: "kwaito, south african, mid-tempo, groove, 100 bpm" },
  { value: "gospel", label: "Gospel", tags: "gospel, choir, uplifting, piano, powerful vocals" },
  { value: "hiphop", label: "Hip Hop / Trap", tags: "hip hop, trap, hard 808 bass, rhythmic, 140 bpm" },
  { value: "rnb", label: "R&B", tags: "r&b, smooth, soulful, groove, 90 bpm" },
  { value: "pop", label: "Pop", tags: "pop, catchy, upbeat, polished, 120 bpm" },
  { value: "lofi", label: "Lo-fi Chill", tags: "lofi, chill, mellow, vinyl, 80 bpm" },
  { value: "cinematic", label: "Cinematic", tags: "cinematic, orchestral, epic, emotional" },
];

export const TOOLS: ToolDef[] = [
  {
    id: "add-sound",
    name: "Add Sound to Video",
    tagline: "Silent AI clip? Add realistic, synced sound effects and ambience in one click.",
    emoji: "🔊",
    inputs: [{ kind: "video", key: "video", label: "Video", required: true }],
    fields: [
      {
        key: "prompt",
        label: "Describe the sound",
        kind: "text",
        placeholder: "e.g. busy Joburg street, taxis hooting, people talking",
        required: true,
      },
    ],
    credits: 5,
    minPlan: "free",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 45,
    model: WS_MODELS.videoToAudio,
    buildInput: (i) => ({ video: i.video, prompt: i.prompt, duration: 8 }),
  },
  {
    id: "remove-bg-image",
    name: "Remove Background (Photo)",
    tagline: "Clean product cut-outs for your shop, thumbnails and posters.",
    emoji: "✂️",
    inputs: [{ kind: "image", key: "image", label: "Photo", required: true }],
    credits: 2,
    minPlan: "free",
    mode: "sync",
    outputKind: "image",
    estimatedSeconds: 8,
    model: WS_MODELS.imageBackgroundRemove,
    buildInput: (i) => ({ image: i.image }),
  },
  {
    id: "remove-bg-video",
    name: "Remove Background (Video)",
    tagline: "Green-screen effect with no green screen — drop yourself into any scene.",
    emoji: "🎬",
    inputs: [
      { kind: "video", key: "video", label: "Video", required: true },
      { kind: "image", key: "background_image", label: "New background (optional)" },
    ],
    credits: 25,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 120,
    model: WS_MODELS.videoBackgroundRemove,
    buildInput: (i) => ({ video: i.video, ...(i.background_image ? { background_image: i.background_image } : {}) }),
  },
  {
    id: "dub",
    name: "Translate & Dub Video",
    tagline: "Your voice, another language. Reach Mozambique, Angola, West Africa and the world.",
    emoji: "🌍",
    inputs: [{ kind: "video", key: "video", label: "Video (max ~2 min)", required: true }],
    fields: [
      { key: "target_lang", label: "Translate into", kind: "select", options: DUB_LANGS, default: "pt", required: true },
    ],
    credits: 40,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 180,
    model: WS_MODELS.dubVideo,
    buildInput: (i) => ({ video: i.video, target_lang: i.target_lang || "pt", source_lang: "auto" }),
  },
  {
    id: "music",
    name: "AI Beat & Song Maker",
    tagline: "Amapiano, gqom, afrobeats, gospel — a royalty-free track for your content in seconds.",
    emoji: "🎹",
    inputs: [],
    fields: [
      { key: "genre", label: "Genre", kind: "select", options: MUSIC_GENRES.map((g) => ({ value: g.value, label: g.label })), default: "amapiano", required: true },
      { key: "duration", label: "Length (seconds)", kind: "select", options: [{ value: "30", label: "30s (Reel / TikTok)" }, { value: "60", label: "60s" }, { value: "120", label: "2 min" }], default: "30" },
      { key: "lyrics", label: "Lyrics (leave empty for an instrumental beat)", kind: "textarea", placeholder: "Verse 1...\nChorus..." },
      { key: "vibe", label: "Extra vibe words (optional)", kind: "text", placeholder: "e.g. summer, braai, sunset, energetic" },
    ],
    credits: 8,
    minPlan: "free",
    mode: "job",
    outputKind: "audio",
    estimatedSeconds: 40,
    model: WS_MODELS.music,
    buildInput: (i) => {
      const genre = MUSIC_GENRES.find((g) => g.value === i.genre) || MUSIC_GENRES[0];
      const tags = [genre.tags, i.vibe].filter(Boolean).join(", ");
      const lyrics = (i.lyrics || "").trim() || "[instrumental]";
      return { tags, lyrics, duration: Number(i.duration) || 30 };
    },
  },
  {
    id: "image-upscale",
    name: "Photo Enhancer / Upscaler",
    tagline: "Turn a blurry phone photo into a crisp 4K image for print or posters.",
    emoji: "🔍",
    inputs: [{ kind: "image", key: "image", label: "Photo", required: true }],
    fields: [
      { key: "target_resolution", label: "Target", kind: "select", options: [{ value: "2k", label: "2K" }, { value: "4k", label: "4K" }], default: "4k" },
    ],
    credits: 3,
    minPlan: "free",
    mode: "sync",
    outputKind: "image",
    estimatedSeconds: 15,
    model: WS_MODELS.imageUpscale,
    buildInput: (i) => ({ image: i.image, target_resolution: i.target_resolution || "4k", output_format: "jpeg" }),
  },
  {
    id: "lipsync-video",
    name: "Lip Sync a Video to New Audio",
    tagline: "Swap the voice on any talking clip — new script, new language, perfect mouth movement.",
    emoji: "🗣️",
    inputs: [
      { kind: "video", key: "video", label: "Talking video", required: true },
      { kind: "audio", key: "audio", label: "New audio (MP3/WAV)", required: true },
    ],
    credits: 30,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 120,
    model: WS_MODELS.lipsyncFromVideo,
    buildInput: (i) => ({ video: i.video, audio: i.audio, sync_mode: "cut_off" }),
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, creator: 1, pro: 2, studio: 3 };
export function planAllows(userPlan: string, minPlan: PlanId): boolean {
  return (PLAN_RANK[userPlan as PlanId] ?? 0) >= PLAN_RANK[minPlan];
}

/** Client-safe view of the registry (no functions). */
export function publicTools() {
  return TOOLS.map(({ buildInput: _fn, model: _m, ...rest }) => rest);
}
