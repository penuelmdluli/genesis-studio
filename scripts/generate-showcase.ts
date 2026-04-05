/**
 * Generate real showcase videos using FAL AI (Kling 2.6 Pro with native audio)
 * and insert them into the explore_videos table.
 *
 * Usage: npx tsx scripts/generate-showcase.ts
 */

import { fal } from "@fal-ai/client";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

fal.config({ credentials: process.env.FAL_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface ShowcasePrompt {
  prompt: string;
  duration: string;
  category: string;
  tags: string[];
}

const SHOWCASE_PROMPTS: ShowcasePrompt[] = [
  // ── CINEMATIC ──
  {
    prompt: "Cinematic close-up of a lion yawning on a warm rock at golden hour. Its mane glows in the sunlight. A deep rumbling growl echoes. Birds chirp in the acacia trees behind. Shallow depth of field, documentary style.",
    duration: "10",
    category: "cinematic",
    tags: ["animals", "nature", "golden-hour"],
  },
  {
    prompt: "Slow motion shot of ocean waves crashing against black volcanic rocks during a storm. White spray explodes upward. Thunder cracks in the distance. Rain hammers the surface. Dramatic wide angle, IMAX quality.",
    duration: "10",
    category: "cinematic",
    tags: ["nature", "ocean", "storm"],
  },
  {
    prompt: "A single red maple leaf falls slowly from a tree in a misty Japanese garden. It twists and spirals through the air, landing gently on the surface of a still koi pond. Ripples expand outward. Soft wind rustles other leaves. Zen atmosphere.",
    duration: "10",
    category: "cinematic",
    tags: ["nature", "zen", "peaceful"],
  },
  {
    prompt: "An astronaut floats weightlessly inside a space station, looking out the cupola window at Earth below. Equipment hums softly. Sunlight moves slowly across the interior. The curvature of Earth glows blue and white. Serene, contemplative. IMAX documentary feel.",
    duration: "10",
    category: "cinematic",
    tags: ["space", "sci-fi", "peaceful"],
  },

  // ── DIALOGUE ──
  {
    prompt: "Close-up of a confident young woman in a modern office. She looks directly at the camera and says: 'The future belongs to those who create it.' Warm natural lighting from a window. Slight smile. Professional but approachable. Clean background.",
    duration: "8",
    category: "dialogue",
    tags: ["business", "motivational", "talking-head"],
  },
  {
    prompt: "A weathered old fisherman sits on a dock at sunset. He holds a fishing rod and says: 'The sea gives, and the sea takes. You learn to respect both.' Gentle waves lap against wooden posts. Seagulls cry in the distance. Golden hour light on his face.",
    duration: "10",
    category: "dialogue",
    tags: ["storytelling", "character", "sunset"],
  },
  {
    prompt: "A chef in a professional kitchen looks at the camera and says: 'Cooking is not about recipes. It is about passion.' He then picks up a knife and begins slicing a tomato with precision. The blade cuts cleanly. Juice runs on the cutting board. Kitchen sounds of sizzling and clanking in the background.",
    duration: "10",
    category: "dialogue",
    tags: ["food", "cooking", "talking-head"],
  },

  // ── ACTION & SOUND ──
  {
    prompt: "Extreme slow motion of a wine glass falling off a marble countertop and shattering on a dark tile floor. The glass explodes into hundreds of crystalline fragments. Red wine splashes outward in dramatic arcs. Sharp impact sound followed by tinkling glass settling. 120fps slow motion feel.",
    duration: "8",
    category: "action",
    tags: ["slow-motion", "dramatic", "sound-design"],
  },
  {
    prompt: "A powerful black stallion gallops through shallow water on a beach at sunset. Hooves splash rhythmically. Water droplets catch the golden light. Mane and tail flow in the wind. Camera tracks alongside at full speed. Dramatic orchestral energy. Wide cinematic shot.",
    duration: "10",
    category: "action",
    tags: ["horses", "action", "cinematic"],
  },
  {
    prompt: "A basketball player in slow motion dunks the ball with power. The crowd roars. The ball slams through the net with a satisfying swish. He hangs on the rim for a moment. Arena lights flare. Epic sports moment. Close-up following the ball.",
    duration: "8",
    category: "action",
    tags: ["sports", "basketball", "slow-motion"],
  },

  // ── LIFESTYLE & VIRAL ──
  {
    prompt: "A barista creates intricate latte art in a cozy coffee shop. Steamed milk pours in a steady stream, forming a perfect rosetta pattern. The cup sits on a wooden counter. Warm cafe ambiance with soft jazz playing. Close-up overhead shot.",
    duration: "8",
    category: "lifestyle",
    tags: ["coffee", "satisfying", "asmr"],
  },
  {
    prompt: "A cute golden retriever puppy discovers snow for the first time. It pounces, rolls, and shakes off snowflakes. Tail wagging furiously. Excited little barks. Backyard covered in fresh white snow. Morning sunlight. Pure joy. 4K clarity.",
    duration: "10",
    category: "lifestyle",
    tags: ["dogs", "cute", "snow", "viral"],
  },
  {
    prompt: "Satisfying video of colorful dominoes falling in an elaborate spiral pattern across a wooden floor. Each domino clicks against the next in a perfect cascade. The pattern reveals a heart shape from above. Crisp clicking sounds with each fall. Top-down camera slowly reveals the full pattern.",
    duration: "10",
    category: "lifestyle",
    tags: ["satisfying", "dominoes", "viral", "asmr"],
  },
  {
    prompt: "A street musician plays a soulful saxophone solo under a warm streetlight on a rainy Paris boulevard at night. Raindrops glisten on the cobblestones. A few people walk by with umbrellas. Notes echo down the empty street. Moody noir atmosphere.",
    duration: "10",
    category: "lifestyle",
    tags: ["music", "paris", "night", "mood"],
  },

  // ── AFRICAN / SOUTH AFRICAN ──
  {
    prompt: "A vibrant South African street scene in Soweto. A group of young dancers perform a synchronized amapiano dance in front of colorful houses. Upbeat music plays. Dust kicks up from their footwork. Crowd watches and cheers. Golden afternoon light. Wide shot, handheld energy.",
    duration: "10",
    category: "african",
    tags: ["south-africa", "dance", "amapiano", "viral"],
  },
  {
    prompt: "Aerial drone shot of Cape Town at sunrise. The camera sweeps over Table Mountain as golden light breaks through clouds. The city and ocean stretch below. Dramatic cinematic music swells. Mist rolls over the mountain edge. Ultra-wide establishing shot.",
    duration: "10",
    category: "african",
    tags: ["south-africa", "cape-town", "drone", "cinematic"],
  },
  {
    prompt: "A Zulu warrior in traditional beaded regalia performs a powerful shield dance on a hilltop at sunset. His movements are sharp and rhythmic. The shield catches the light. Stamping feet hit the red earth. Traditional drums beat in the background. Wide shot with dramatic sky.",
    duration: "10",
    category: "african",
    tags: ["south-africa", "zulu", "culture", "dance"],
  },

  // ── PRODUCT / COMMERCIAL ──
  {
    prompt: "A sleek smartphone rotates slowly on a glossy black surface. Studio lighting creates clean reflections and highlights. The screen lights up showing a beautiful interface. Subtle electronic whoosh sound. Apple-style product commercial. White text appears: 'Designed for you.'",
    duration: "8",
    category: "commercial",
    tags: ["product", "tech", "commercial", "business"],
  },
  {
    prompt: "Close-up of fresh sushi being assembled by a chef's hands. Each piece is placed with precision on a wooden board. Wasabi is dabbed with a brush. Ginger is fanned beside it. Natural top lighting. ASMR quality — you hear every subtle sound of the knife, the fish, the placement.",
    duration: "10",
    category: "commercial",
    tags: ["food", "sushi", "asmr", "commercial"],
  },

  // ── FANTASY / SCI-FI ──
  {
    prompt: "A massive dragon lands on a cliff edge at dusk. Its wings fold with a leathery rustle. It turns its head slowly, revealing glowing amber eyes. Steam rises from its nostrils. Distant thunder. The landscape below shows a medieval kingdom with twinkling lights. Epic fantasy. Wide establishing shot.",
    duration: "10",
    category: "fantasy",
    tags: ["dragon", "fantasy", "epic", "cinematic"],
  },
  {
    prompt: "A samurai stands alone in a bamboo forest during heavy rain. He slowly unsheathes his katana. The blade rings with a clean metallic sound. Rain runs down his face. Lightning illuminates the scene. He takes a fighting stance. Epic, intense, cinematic.",
    duration: "10",
    category: "fantasy",
    tags: ["samurai", "action", "rain", "cinematic"],
  },

  // ── BRAIN STUDIO DEMO ──
  {
    prompt: "A detective enters a dark office at night. Rain hammers the window. He picks up a letter from the desk. He reads aloud: 'Meet me at the docks at midnight.' He sets down the letter, grabs his coat, and walks toward the door. His footsteps echo on hardwood. The door creaks open.",
    duration: "10",
    category: "brain-studio",
    tags: ["detective", "noir", "storytelling", "dialogue"],
  },

  // ── EXTRA: make it 23 total ──
  {
    prompt: "A hummingbird hovers in super slow motion beside a bright red flower. Its wings beat so fast they blur. It dips its beak into the flower. Sunlight catches the iridescent feathers — green, blue, purple. Soft ambient garden sounds. Macro lens, dreamy bokeh.",
    duration: "8",
    category: "cinematic",
    tags: ["nature", "birds", "slow-motion", "macro"],
  },
];

async function generateVideo(item: ShowcasePrompt, index: number): Promise<string | null> {
  const label = `[${index + 1}/${SHOWCASE_PROMPTS.length}]`;
  console.log(`${label} Generating: "${item.prompt.slice(0, 70)}..."`);

  try {
    const result = await fal.subscribe("fal-ai/kling-video/v2.6/pro/text-to-video", {
      input: {
        prompt: item.prompt,
        duration: item.duration,
        aspect_ratio: "16:9",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`  ${label} Processing...`);
        }
      },
    });

    const videoUrl = (result.data as any)?.video?.url;
    if (!videoUrl) {
      console.error(`  ${label} No video URL in result`);
      return null;
    }

    console.log(`  ${label} Done: ${videoUrl.slice(0, 80)}...`);

    // Insert into explore_videos
    const { error } = await supabase.from("explore_videos").insert({
      user_id: "genesis-studio-official",
      prompt: item.prompt,
      model_id: "kling-2.6",
      video_url: videoUrl,
      thumbnail_url: null,
      duration: parseInt(item.duration),
      resolution: "720p",
      has_audio: true,
      type: item.category === "brain-studio" ? "brain" : "standard",
      is_free_tier: false,
      is_featured: true,
      is_published: true,
      tags: item.tags,
      creator_name: "Genesis Studio",
      creator_avatar_url: null,
      views: Math.floor(Math.random() * 500) + 100,
      likes: Math.floor(Math.random() * 100) + 20,
      recreates: Math.floor(Math.random() * 30) + 5,
    });

    if (error) {
      console.error(`  ${label} DB insert failed: ${error.message}`);
    } else {
      console.log(`  ${label} Saved to explore_videos`);
    }

    return videoUrl;
  } catch (err: any) {
    console.error(`  ${label} FAILED: ${err.message}`);
    return null;
  }
}

async function main() {
  // Check which prompts already exist in DB
  const { data: existing } = await supabase
    .from("explore_videos")
    .select("prompt")
    .eq("user_id", "genesis-studio-official");

  const existingPrompts = new Set((existing || []).map((r: any) => r.prompt));
  const remaining = SHOWCASE_PROMPTS.filter((p) => !existingPrompts.has(p.prompt));

  if (remaining.length === 0) {
    console.log("\n✅ All showcase videos already generated!\n");
    return;
  }

  console.log(`\n🎬 Generating ${remaining.length} showcase videos (${existingPrompts.size} already done)...\n`);

  const results: { prompt: string; url: string | null }[] = [];

  // Generate 3 at a time
  for (let i = 0; i < remaining.length; i += 3) {
    const batch = remaining.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((item, j) => generateVideo(item, i + j))
    );

    // If all in batch failed with Forbidden, stop early (no credits)
    const allForbidden = batchResults.every((r) => r === null);
    for (let j = 0; j < batch.length; j++) {
      results.push({ prompt: batch[j].prompt.slice(0, 60), url: batchResults[j] });
    }

    if (allForbidden && i > 0) {
      console.log("\n⚠️  All requests failing — likely out of FAL credits. Stopping early.");
      console.log("   Top up credits at https://fal.ai/dashboard/billing and re-run this script.\n");
      break;
    }

    if (i + 3 < remaining.length) {
      console.log(`\n  ⏳ Waiting 5s before next batch...\n`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const succeeded = results.filter((r) => r.url).length;
  const failed = results.filter((r) => !r.url).length;
  console.log(`\n📊 Results: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) {
    console.log(`💡 Re-run this script after topping up FAL credits to generate the remaining videos.`);
  }
  console.log(`\n🎉 Done!\n`);
}

main().catch(console.error);
