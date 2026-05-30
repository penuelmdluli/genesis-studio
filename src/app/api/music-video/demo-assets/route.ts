import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { fal } from "@fal-ai/client";
import { uploadToR2, uploadAudio, uploadThumbnail, r2PublicUrl, fileExists } from "@/lib/storage";

fal.config({ credentials: process.env.FAL_KEY || "" });

export const maxDuration = 60;


// ─── Demo Asset Definitions ──────────────────────────────────────────────────

const DEMO_SONGS = [
  {
    id: "demo-amapiano-love",
    name: "Amapiano Love",
    genre: "Amapiano",
    prompt: "Amapiano with vocal chops and melodic hooks, log drum patterns, deep bass, jazzy piano stabs, female vocal ad-libs saying 'hey' and 'yeah', South African club vibes, 115 bpm, professional production, radio quality",
    bpm: 115,
  },
  {
    id: "demo-trap-star",
    name: "Trap Star",
    genre: "Trap",
    prompt: "Hard trap beat with male vocal ad-libs, dark sinister melody, heavy 808 bass drops, crisp hi-hat rolls, vocal tag 'yeah yeah', menacing energy, Metro Boomin style production, 140 bpm, professional mix",
    bpm: 140,
  },
  {
    id: "demo-afrobeats-fire",
    name: "Afrobeats Fire",
    genre: "Afrobeats",
    prompt: "Afrobeats rhythm with catchy male vocal hook singing a melodic phrase, electric guitar licks, talking drum, infectious dance energy, Burna Boy style production, 108 bpm, tropical percussion, feel-good summer anthem",
    bpm: 108,
  },
];

const DEMO_CHARACTERS = [
  {
    id: "demo-marcus",
    name: "Marcus",
    prompt: "Ultra-photorealistic portrait of a confident 25-year-old Black male hip-hop artist, fresh skin fade haircut, diamond stud earrings, designer streetwear hoodie, heavy gold Cuban link chain, strong jawline, intense confident gaze at camera, moody purple studio lighting, smoke in background, music video still quality, 8K detail",
  },
  {
    id: "demo-naledi",
    name: "Naledi",
    prompt: "Ultra-photorealistic portrait of a gorgeous 22-year-old South African female pop artist, sleek long colorful braids, flawless makeup with glossy lips, trendy two-piece designer outfit, body glitter on collarbones, radiant megawatt smile, pink and purple neon ring light, music video still quality, 8K detail",
  },
  {
    id: "demo-zara",
    name: "Zara",
    prompt: "Ultra-photorealistic portrait of a majestic 26-year-old Black female soul singer, voluminous natural afro hair, elegant gold statement earrings, off-shoulder flowing white dress, warm soulful eyes, slight knowing smile, golden hour sunlight, ethereal glow, music video still quality, 8K detail",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function existsOnR2(key: string): Promise<boolean> {
  return fileExists(key);
}

async function generateAndStoreSong(song: typeof DEMO_SONGS[0]): Promise<string> {
  const key = `demo/music-video/songs/${song.id}.mp3`;

  // Check if already exists
  if (await existsOnR2(key)) {
    return r2PublicUrl(key);
  }

  // Generate via stable-audio
  const result = await fal.subscribe("fal-ai/stable-audio", {
    input: {
      prompt: song.prompt,
      seconds_total: 15,
    },
    logs: false,
  });

  const data = result.data as Record<string, unknown>;
  const audioUrl =
    (data?.audio_file as { url?: string })?.url ||
    (data?.audio_url as string) ||
    "";

  if (!audioUrl) throw new Error(`Failed to generate song: ${song.name}`);

  // Download and store on R2
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download generated song: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await uploadAudio(key, buffer, "audio/mpeg");

  return r2PublicUrl(key);
}

async function generateAndStoreCharacter(char: typeof DEMO_CHARACTERS[0]): Promise<string> {
  const key = `demo/music-video/characters/${char.id}.jpg`;

  // Check if already exists
  if (await existsOnR2(key)) {
    return r2PublicUrl(key);
  }

  // Generate via FLUX Pro
  const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
    input: {
      prompt: char.prompt,
      image_size: "portrait_4_3",
      num_images: 1,
    },
    logs: false,
  });

  const data = result.data as Record<string, unknown>;
  const images = data?.images as Array<{ url?: string }> | undefined;
  const imageUrl = images?.[0]?.url || "";

  if (!imageUrl) throw new Error(`Failed to generate character: ${char.name}`);

  // Download and store on R2
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download generated character: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await uploadThumbnail(key, buffer, "image/jpeg");

  return r2PublicUrl(key);
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/music-video/demo-assets
 * Returns URLs for pre-generated demo songs and character portraits.
 * If assets don't exist on R2 yet, generates them on the spot and caches permanently.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate all assets in parallel
    const [songResults, charResults] = await Promise.all([
      Promise.allSettled(DEMO_SONGS.map((song) => generateAndStoreSong(song))),
      Promise.allSettled(DEMO_CHARACTERS.map((char) => generateAndStoreCharacter(char))),
    ]);

    // Build response — include only successful ones
    const songs = DEMO_SONGS
      .map((song, i) => {
        const result = songResults[i];
        if (result.status === "fulfilled") {
          return { id: song.id, name: song.name, url: result.value, genre: song.genre };
        }
        return null;
      })
      .filter(Boolean);

    const characters = DEMO_CHARACTERS
      .map((char, i) => {
        const result = charResults[i];
        if (result.status === "fulfilled") {
          return { id: char.id, name: char.name, url: result.value };
        }
        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ songs, characters });
  } catch (err) {
    console.error("[DEMO-ASSETS] Error:", err);
    return NextResponse.json(
      { error: "Failed to load demo assets" },
      { status: 500 }
    );
  }
}
