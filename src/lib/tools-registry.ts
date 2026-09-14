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
  /** Offer an AI helper next to the field ("lyrics" → /api/ai-singer/generate-lyrics). */
  assist?: "lyrics";
}

export interface ToolDef {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** What the user must supply. */
  inputs: Array<{ kind: ToolInputKind; key: string; label: string; required?: boolean }>;
  fields?: ToolField[];
  /** Base credits. */
  credits: number;
  /** Extra credits per second of input media, for providers that bill per second. */
  creditsPerSecond?: number;
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

/**
 * The song model sings exactly what it is given and plays instrumental for
 * the rest. A one-liner ("Sihle my daughter") over 30 seconds came out as
 * one sung phrase and 25 seconds of beat — technically correct, not what
 * anyone wants. Short input becomes a structured hook that repeats to fill
 * the length; anything already structured or long enough is left alone.
 */
export function shapeLyrics(raw: string, durationSec: number): string {
  const text = raw.trim();
  if (!text) return "[instrumental]";
  if (/\[(verse|chorus|hook|bridge|intro|outro|inst|instrumental)/i.test(text)) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const target = Math.round(durationSec * 1.6); // ≈ words a vocal covers at song pace
  if (words.length >= target * 0.6) return text;

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const hook = lines.slice(0, 2).join("\n");
  const verse = lines.length > 2 ? lines.slice(2).join("\n") : hook;
  const sections = [`[verse]\n${verse}`, `[chorus]\n${hook}\n${hook}`];
  if (durationSec >= 60) sections.push(`[verse]\n${verse}`, `[chorus]\n${hook}\n${hook}`);
  if (durationSec >= 120) sections.push(`[bridge]\n${verse}`, `[chorus]\n${hook}\n${hook}\n${hook}`);
  return sections.join("\n\n");
}

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
    // Provider bills ≈ $0.05/s.
    credits: 10,
    creditsPerSecond: 8,
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
    // Dubbing bills per second of speech (≈ $0.01/s list, ≈ $0.02/s effective).
    credits: 10,
    creditsPerSecond: 4,
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
      {
        key: "lyrics",
        label: "Lyrics (leave empty for an instrumental beat)",
        kind: "textarea",
        placeholder: "[verse]\nSihle, my daughter, light of my morning...\n[chorus]\n...",
        help: "A 30s track sings roughly 40–60 words; 60s about 100. A single line becomes a hook that repeats — or tap \"Write lyrics for me\".",
        assist: "lyrics",
      },
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
      const duration = Number(i.duration) || 30;
      return { tags, lyrics: shapeLyrics(i.lyrics || "", duration), duration };
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
    // sync/lipsync-2 bills ≈ $0.05/s.
    credits: 10,
    creditsPerSecond: 8,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 120,
    model: WS_MODELS.lipsyncFromVideo,
    buildInput: (i) => ({ video: i.video, audio: i.audio, sync_mode: "cut_off" }),
  },

  // ── Added 2026-09-14. Every price below is set from a measured charge, not
  // the catalogue figure: each model was run once and the balance read before
  // and after. (Seedance 2.5 was listed at $0.90 and actually charged $1.62.)
  // Credits are worth $0.010–0.024, so each tool is at least twice cost even
  // at the cheapest rate.
  {
    id: "face-swap-image",
    name: "Face Swap (Photo)",
    tagline: "Put your face on any photo — a movie poster, a magazine cover, a scene you dreamed up.",
    emoji: "🎭",
    inputs: [
      { kind: "image", key: "image", label: "The photo to change", required: true },
      { kind: "image", key: "face_image", label: "Your face", required: true },
    ],
    fields: [
      {
        key: "consent",
        label: "Whose face is this?",
        kind: "select",
        required: true,
        options: [
          { value: "mine", label: "It's my own face" },
          { value: "permission", label: "I have this person's permission" },
        ],
        help: "Only use your own face, or someone who has agreed. Swapping in a person without their consent is not allowed.",
      },
    ],
    // Measured $0.01 per image.
    credits: 5,
    minPlan: "free",
    mode: "sync",
    outputKind: "image",
    estimatedSeconds: 15,
    model: "wavespeed-ai/image-face-swap",
    buildInput: (i) => ({ image: i.image, face_image: i.face_image, output_format: "jpeg", enable_sync_mode: true }),
  },
  {
    id: "face-swap-video",
    name: "Star In Any Video",
    tagline: "Swap your face into any clip. The most shareable thing a creator can post.",
    emoji: "🌟",
    inputs: [
      { kind: "video", key: "video", label: "The video", required: true },
      { kind: "image", key: "face_image", label: "Your face", required: true },
    ],
    fields: [
      {
        key: "consent",
        label: "Whose face is this?",
        kind: "select",
        required: true,
        options: [
          { value: "mine", label: "It's my own face" },
          { value: "permission", label: "I have this person's permission" },
        ],
        help: "Only use your own face, or someone who has agreed. Swapping in a person without their consent is not allowed.",
      },
      {
        key: "target_gender",
        label: "Swap which face?",
        kind: "select",
        default: "all",
        options: [
          { value: "all", label: "The main face" },
          { value: "female", label: "Only a woman's face" },
          { value: "male", label: "Only a man's face" },
        ],
      },
    ],
    // Measured $0.05 for a 4.2s clip; billed per second so long clips stay covered.
    credits: 10,
    creditsPerSecond: 3,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 90,
    model: "wavespeed-ai/video-face-swap",
    buildInput: (i) => ({ video: i.video, face_image: i.face_image, target_gender: i.target_gender || "all" }),
  },
  {
    id: "two-person-talk",
    name: "Two People Talking",
    tagline: "One photo of two people, two voices — both speak, each with their own lip sync.",
    emoji: "👥",
    inputs: [
      { kind: "image", key: "image", label: "Photo with two people", required: true },
      { kind: "audio", key: "left_audio", label: "Voice of the person on the LEFT", required: true },
      { kind: "audio", key: "right_audio", label: "Voice of the person on the RIGHT", required: true },
    ],
    fields: [
      {
        key: "order",
        label: "How do they talk?",
        kind: "select",
        default: "left_right",
        options: [
          { value: "left_right", label: "Left speaks, then right" },
          { value: "right_left", label: "Right speaks, then left" },
          { value: "meanwhile", label: "Both at the same time" },
        ],
      },
    ],
    // Measured $0.30 for 9.2s at 480p (~$0.033/s), billed on both voices together.
    credits: 10,
    creditsPerSecond: 7,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 180,
    model: "wavespeed-ai/infinitetalk/multi",
    buildInput: (i) => ({
      image: i.image,
      left_audio: i.left_audio,
      right_audio: i.right_audio,
      order: i.order || "left_right",
      resolution: "480p",
      prompt: "Two people in conversation, natural head movement and expressions, accurate lip sync.",
    }),
  },
  {
    id: "music-video",
    name: "Music Video From Your Song",
    tagline: "Upload a track and a photo. Get a full music video — made for amapiano, gqom and gospel.",
    emoji: "🎬",
    inputs: [
      { kind: "audio", key: "audio", label: "Your song (MP3)", required: true },
      { kind: "image", key: "image", label: "Photo of the artist", required: true },
    ],
    fields: [
      {
        key: "prompt",
        label: "The look",
        kind: "textarea",
        placeholder: "Performing on a Soweto rooftop at sunset, crowd dancing below",
        help: "Where it happens and the mood. The person in your photo stays the star.",
      },
      {
        key: "aspect_ratio",
        label: "Shape",
        kind: "select",
        default: "9:16",
        options: [
          { value: "9:16", label: "Vertical — Reels, TikTok, Shorts" },
          { value: "16:9", label: "Wide — YouTube" },
        ],
      },
    ],
    // Measured $0.33 for a 10s song at 480p (~$0.033/s). The song's length is
    // read on the server, so a long track is billed for its real length.
    credits: 15,
    creditsPerSecond: 7,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 240,
    model: "wavespeed-ai/music-video-generator",
    buildInput: (i) => ({
      audio: i.audio,
      images: [i.image],
      prompt: i.prompt || "A music performance video, cinematic lighting, energetic",
      aspect_ratio: i.aspect_ratio || "9:16",
      resolution: "480p",
    }),
  },
  {
    id: "video-extend",
    name: "Make It Longer",
    tagline: "Add seconds to the end of any clip — the story carries on from the last frame.",
    emoji: "➕",
    inputs: [{ kind: "video", key: "video", label: "The clip to extend", required: true }],
    fields: [
      {
        key: "prompt",
        label: "What happens next",
        kind: "textarea",
        required: true,
        placeholder: "He turns and walks out through the gate into the busy street",
      },
      {
        key: "duration",
        label: "How much longer",
        kind: "select",
        default: "5",
        options: [
          { value: "5", label: "5 more seconds" },
          { value: "10", label: "10 more seconds" },
        ],
      },
    ],
    // Measured $0.20 per 5s added at 768p. Priced flat at the 10-second cost,
    // because the charge depends on the length added, not the clip supplied.
    credits: 80,
    minPlan: "creator",
    mode: "job",
    outputKind: "video",
    estimatedSeconds: 150,
    model: "wavespeed-ai/minimax-h3/video-extend",
    buildInput: (i) => ({
      video: i.video,
      prompt: i.prompt,
      duration: i.duration === "10" ? 10 : 5,
      resolution: "768p",
    }),
  },
];

/** Credits for a run, given the input media length in seconds (0 when unknown). */
export function toolPrice(tool: ToolDef, seconds: number): number {
  if (!tool.creditsPerSecond) return tool.credits;
  // Unknown length is billed as a full minute so a missing probe can never undercharge.
  const s = seconds > 0 ? Math.min(seconds, 600) : 60;
  return tool.credits + Math.ceil(s) * tool.creditsPerSecond;
}

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
