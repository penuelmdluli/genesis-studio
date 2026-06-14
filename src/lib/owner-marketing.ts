/**
 * GENESIS STUDIO — Owner Marketing Engine
 *
 * Every video is a marketing tool. This module handles:
 * 1. SA-culture branded character presets for image generation
 * 2. Scenario-based prompts (party, dance, chill, dinner, etc.)
 * 3. Auto-comment with marketing links on every posted video
 * 4. Image generation history tracking
 *
 * Style: MBS baby characters in South African cultural settings.
 * Goal: Create scroll-stopping content that markets ivideostudio.ai.
 */

import { envString } from "@/lib/env";

// ── SA Culture Character Presets ──
// Each preset generates a unique South African baby character
// designed for maximum engagement + brand consistency

export interface CharacterPreset {
  id: string;
  name: string;
  prompt: string;
  tags: string[];
}

export const SA_CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "zulu-princess",
    name: "Zulu Princess",
    prompt: "Photorealistic portrait of an adorable 3-year-old South African Zulu baby girl, radiant dark melanin-rich skin with natural glow, big bright sparkling brown eyes with catchlights, wearing authentic colorful Zulu isicholo beaded headpiece and intricate beaded necklace in red gold and turquoise, vibrant red and gold traditional outfit with detailed beadwork embroidery, joyful confident beaming smile showing dimples, soft diffused Rembrandt lighting from the left, creamy bokeh background with warm golden tones, natural skin pores and peach fuzz visible, Canon EOS R5 85mm f/1.2 lens shallow depth of field",
    tags: ["zulu", "traditional", "girl"],
  },
  {
    id: "xhosa-prince",
    name: "Xhosa Prince",
    prompt: "Photorealistic portrait of a charming 4-year-old South African Xhosa baby boy, rich dark brown skin with natural healthy glow, bright infectious smile showing tiny white teeth, wearing modern Xhosa-inspired outfit with traditional ochre and white geometric patterns, small intricately beaded inkciyo cap, confident playful stance with hands on hips, warm three-point studio lighting, clean slightly blurred earthy-toned background, natural skin texture and micro details visible, shot on Hasselblad X2D medium format 90mm lens",
    tags: ["xhosa", "traditional", "boy"],
  },
  {
    id: "ndebele-star",
    name: "Ndebele Star",
    prompt: "Photorealistic portrait of a stunning 3-year-old South African Ndebele baby girl, beautiful deep melanin skin with natural radiance, wearing authentic Ndebele-inspired outfit with bold geometric patterns in electric blue canary yellow cherry red and emerald green, colorful beaded dzilla neck rings accessory, ornate beaded headband, proud dignified happy expression with bright eyes, vibrant painted Ndebele house wall softly blurred in background, professional fashion photography lighting, incredible skin detail and fabric texture, Nikon Z9 105mm f/1.4",
    tags: ["ndebele", "colorful", "girl"],
  },
  {
    id: "township-kid",
    name: "Township Kid",
    prompt: "Photorealistic portrait of an irresistibly cool 4-year-old South African township baby boy, smooth dark skin with healthy glow, cheeky confident grin, wearing fresh trendy streetwear — brand new tiny Air Jordan sneakers, tilted bucket hat, colorful puffer jacket in SA flag green and gold, miniature gold chain necklace, arms crossed boss pose, standing against vibrant Soweto township wall covered in colorful street art and graffiti, golden hour afternoon sunlight casting warm shadows, street photography style, Sony A7R V 50mm f/1.4 GM",
    tags: ["urban", "streetwear", "boy"],
  },
  {
    id: "amapiano-queen",
    name: "Amapiano Queen",
    prompt: "Photorealistic portrait of a dazzling 3-year-old South African baby girl styled for an amapiano music video, glowing dark skin, wearing sparkling sequin mini dress in rose gold and hot pink, tiny designer sunglasses pushed up on forehead, miniature gold hoop earrings, confident sassy dance pose with one hand on hip, colorful disco club lights creating pink purple and blue bokeh in background, confetti particles floating in air, rim lighting creating a halo effect around her, party atmosphere, professional music video cinematography quality",
    tags: ["amapiano", "party", "girl"],
  },
  {
    id: "gqom-king",
    name: "Gqom King",
    prompt: "Photorealistic portrait of an impossibly cool 4-year-old South African Durban baby boy ready for a gqom party, dark skin with dramatic lighting, wearing sleek all-black outfit with gold zipper accents and gold chain, fresh black and gold tiny sneakers, intense confident expression with slight smirk, arms crossed power pose, dramatic neon cyan and magenta club lighting casting colored shadows on his face, dark moody background with laser beams, fog machine haze in air, editorial fashion photography quality, Phase One IQ4 150MP",
    tags: ["gqom", "durban", "boy"],
  },
  {
    id: "rainbow-nation",
    name: "Rainbow Nation Baby",
    prompt: "Photorealistic portrait of a beautiful 3-year-old mixed-race South African baby with gorgeous curly afro hair decorated with tiny colorful ribbons in SA flag colors green gold red blue black and white, wearing a bright rainbow tutu dress layered with all six flag colors, holding a miniature South African flag, enormous proud joyful smile with sparkling eyes full of wonder, Table Mountain and Cape Town waterfront softly blurred in golden hour background, warm sunset rim lighting creating a magical glow, professional child portrait photography, Fujifilm GFX 100S",
    tags: ["rainbow", "patriotic", "unisex"],
  },
  {
    id: "safari-explorer",
    name: "Safari Explorer",
    prompt: "Photorealistic portrait of an adventurous 4-year-old South African baby in adorable safari explorer outfit, tiny khaki vest with many pockets, miniature pith helmet slightly too big, oversized binoculars hanging around neck, curious wide-eyed excited expression looking into the distance, standing on African red dirt with blurred golden savanna grassland and single acacia tree silhouetted against spectacular orange and pink African sunset in background, dust particles floating in warm golden light, National Geographic quality nature photography, Canon EOS R3 70-200mm f/2.8",
    tags: ["safari", "adventure", "unisex"],
  },
  {
    id: "soweto-dancer",
    name: "Soweto Dancer",
    prompt: "Photorealistic action portrait of a dynamic 3-year-old South African baby mid-dance-move on a Soweto street, dark skin glistening with energy, wearing colorful traditional-meets-modern fusion outfit with African print fabric and fresh sneakers, caught mid-spin with arms out and one foot lifted, huge joyful laughing expression, motion blur on spinning fabric while face is tack sharp, crowd of blurred township kids cheering in background, golden afternoon light streaming between colorful houses, freeze-frame dance photography style, Sony A1 with 24-70mm f/2.8 GM",
    tags: ["dance", "soweto", "unisex"],
  },
  {
    id: "tech-prodigy",
    name: "Tech Prodigy",
    prompt: "Photorealistic portrait of a focused 4-year-old South African baby sitting at a tiny desk with a glowing laptop screen reflecting blue light on their face, wearing miniature round glasses and a smart casual outfit, one small hand on the keyboard typing with serious concentrated expression, holographic code and data visualizations floating in the air around them, futuristic dark room with subtle teal and purple ambient lighting, tech startup office aesthetic, representing Africa's digital future, cinematic sci-fi lighting, RED V-RAPTOR 8K cinema camera quality",
    tags: ["tech", "future", "unisex"],
  },
];

// ── Scenario Presets ──
// Different settings/moods for the characters — each generates unique content

export interface ScenarioPreset {
  id: string;
  name: string;
  emoji: string;
  promptSuffix: string;
  hashtags: string[];
  captionHook: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "amapiano-party",
    name: "Amapiano Party",
    emoji: "🎶",
    promptSuffix: "dancing at a vibrant amapiano party, colorful club lights, DJ booth in background, confetti flying, energetic dance moves, party atmosphere, South African party vibes",
    hashtags: ["#Amapiano", "#AmapianoIsALifestyle", "#SouthAfricaDance", "#PartyVibes"],
    captionHook: "The party doesn't start until they arrive 🔥",
  },
  {
    id: "street-dance",
    name: "Street Dance Battle",
    emoji: "💃",
    promptSuffix: "doing an epic street dance battle in a Johannesburg township street, crowd cheering around them, colorful graffiti walls, boombox playing, energetic breakdancing moves, golden hour sunlight",
    hashtags: ["#DanceBattle", "#StreetDance", "#Mzansi", "#DanceChallenge"],
    captionHook: "When the beat drops and they can't hold it anymore 🔥",
  },
  {
    id: "braai-chill",
    name: "Braai & Chill",
    emoji: "🥩",
    promptSuffix: "chilling at a South African braai (BBQ), sitting on a tiny chair next to the braai fire, wearing a 'Braai Master' apron, holding tongs, smoke rising, family garden setting, warm golden afternoon light",
    hashtags: ["#BraaiDay", "#SouthAfrica", "#Mzansi", "#WeekendVibes"],
    captionHook: "Weekend braai energy activated 🔥",
  },
  {
    id: "dinner-fancy",
    name: "Fancy Dinner",
    emoji: "🍽️",
    promptSuffix: "sitting at a fancy restaurant table, wearing a tiny suit/dress, holding a menu upside down, candle-lit table, silver cutlery, looking sophisticated and serious, luxury restaurant interior, warm ambient lighting",
    hashtags: ["#FancyDinner", "#BossVibes", "#LivingLarge", "#Mzansi"],
    captionHook: "Table for one. The boss has arrived 🔥",
  },
  {
    id: "soccer-celebration",
    name: "Soccer Celebration",
    emoji: "⚽",
    promptSuffix: "celebrating a soccer goal, wearing Bafana Bafana jersey, sliding on knees on green grass pitch, arms spread wide, crowd celebrating in blurred background, stadium lights, triumphant expression",
    hashtags: ["#BafanaBafana", "#SouthAfricanFootball", "#GoalCelebration", "#Mzansi"],
    captionHook: "GOOOAAAL! Bafana Bafana's youngest player scores again 🔥",
  },
  {
    id: "graduation",
    name: "Graduation Day",
    emoji: "🎓",
    promptSuffix: "wearing a graduation cap and gown, holding a tiny diploma, throwing cap in the air, proud expression, university building in background, confetti falling, family cheering, warm sunshine",
    hashtags: ["#Graduation", "#ProudMoment", "#Education", "#FutureStar"],
    captionHook: "They did it! The youngest graduate in Mzansi 🔥",
  },
  {
    id: "chill-poolside",
    name: "Poolside Chill",
    emoji: "🏊",
    promptSuffix: "relaxing on a tiny pool lounger by a sparkling blue pool, wearing tiny sunglasses and a sun hat, holding a juice box like a cocktail, palm trees in background, summer vibes, bright sunny day",
    hashtags: ["#PoolDay", "#SummerVibes", "#Chillin", "#Mzansi"],
    captionHook: "Living the life. No stress. Just vibes 🔥",
  },
  {
    id: "studio-recording",
    name: "Studio Session",
    emoji: "🎤",
    promptSuffix: "in a professional music recording studio, wearing headphones that are too big, standing at a microphone, mixing console with colorful LED lights in background, serious concentrated expression, moody studio lighting",
    hashtags: ["#StudioSession", "#MusicLife", "#NextBigThing", "#Mzansi"],
    captionHook: "The album is coming. The world is NOT ready 🔥",
  },
  {
    id: "traditional-ceremony",
    name: "Traditional Ceremony",
    emoji: "🪘",
    promptSuffix: "at a traditional South African ceremony, wearing beautiful traditional attire with beadwork, surrounded by dancers and drummers, colorful decorations, warm firelight, proud cultural celebration atmosphere",
    hashtags: ["#SouthAfricanCulture", "#Heritage", "#Traditional", "#Mzansi"],
    captionHook: "The culture is ALIVE and BEAUTIFUL 🔥",
  },
  {
    id: "entrepreneur",
    name: "Young Boss",
    emoji: "💼",
    promptSuffix: "sitting at a tiny desk in a modern office, wearing a miniature business suit, tiny laptop open, talking on a toy phone looking very serious, city skyline through glass windows, professional corporate setting",
    hashtags: ["#YoungBoss", "#Entrepreneur", "#BossVibes", "#Mzansi"],
    captionHook: "The CEO is taking calls. Do NOT disturb 🔥",
  },
];

// ── Build Full Image Prompt ──

export function buildOwnerImagePrompt(
  character: CharacterPreset,
  scenario: ScenarioPreset
): string {
  return `${character.prompt}, ${scenario.promptSuffix}`;
}

// ── Build Caption for Owner Posts ──

export function buildOwnerCaption(
  scenario: ScenarioPreset,
  characterName: string,
  extraText?: string
): string {
  const marketingLine = "Made with AI → ivideostudio.ai";
  const scenarioHashtags = scenario.hashtags.join(" ");

  return `${scenario.captionHook}

${characterName} ${scenario.emoji}

${extraText ? extraText + "\n\n" : ""}${marketingLine}

🔗 https://ivideostudio.ai

#MzansiBabyStars #MBS #GenesisStudio #AIVideo #MadeWithAI #SouthAfrica #Mzansi #Viral #FYP ${scenarioHashtags}`;
}

// ── Auto-Comment on Posted Videos ──
// Every video gets marketing comments — subtle but effective

const MARKETING_COMMENTS = [
  "This was made with AI! Create your own → ivideostudio.ai 🔥",
  "Make YOUR own AI dance video FREE → ivideostudio.ai",
  "Want this for YOUR character? Try it free → ivideostudio.ai",
  "100% AI-generated! Make yours → ivideostudio.ai",
  "Turn ANY photo into a dancing video → ivideostudio.ai 🔥",
  "50 FREE credits to create your own → ivideostudio.ai",
  "AI made this in 60 seconds. Your turn → ivideostudio.ai",
  "Create videos like this FREE → ivideostudio.ai 🎬",
];

const ENGAGEMENT_COMMENTS = [
  "Drop ⭐ if this made you smile!",
  "Who else is watching this on repeat? 🔥",
  "Tag someone who NEEDS to see this 👀",
  "The vibe is IMMACULATE 🔥",
  "Name this dance move 👇",
  "Share with your family group chat 🔥",
  "Follow for more! We post daily 🔥",
  "South Africa to the WORLD 🇿🇦🔥",
  "The culture is alive! Comment your flag 🔥",
  "Watch till the end! 👀🔥",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a set of auto-comments for a posted video.
 * Returns 3 comments: engagement, community, and marketing (with link).
 * Spread them out over time for natural engagement patterns.
 */
export function generateMarketingComments(): {
  comments: string[];
  delayMinutes: number[];
} {
  return {
    comments: [
      pickRandom(ENGAGEMENT_COMMENTS),
      pickRandom(ENGAGEMENT_COMMENTS.filter((c) => c !== pickRandom(ENGAGEMENT_COMMENTS))),
      pickRandom(MARKETING_COMMENTS),
    ],
    // Stagger: immediate, 15 min later, 1 hour later
    delayMinutes: [0, 15, 60],
  };
}

/**
 * Post a comment on a Facebook video/post.
 * Uses the page access token to comment as the page.
 */
export async function commentOnFacebookPost(
  postId: string,
  comment: string,
  pageAccessToken: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${postId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: comment,
          access_token: pageAccessToken,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[MARKETING] Comment failed on ${postId}: ${err.slice(0, 150)}`);
      return { success: false, error: `FB API ${res.status}` };
    }

    const data = (await res.json()) as { id: string };
    console.log(`[MARKETING] Commented on ${postId}: ${data.id}`);
    return { success: true, commentId: data.id };
  } catch (err) {
    console.error("[MARKETING] Comment error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Auto-comment on a posted video with marketing + engagement comments.
 * Call this after successfully posting a video to Facebook.
 * Posts first comment immediately, queues others for later.
 */
export async function autoCommentOnPost(
  postId: string,
  pageAccessToken: string
): Promise<void> {
  const { comments, delayMinutes } = generateMarketingComments();

  // Post first comment immediately
  await commentOnFacebookPost(postId, comments[0], pageAccessToken);

  // Schedule remaining comments (best-effort, non-blocking)
  for (let i = 1; i < comments.length; i++) {
    const delayMs = delayMinutes[i] * 60 * 1000;
    setTimeout(async () => {
      await commentOnFacebookPost(postId, comments[i], pageAccessToken);
    }, delayMs);
  }
}

// ── Image History Tracking ──
// Store owner-generated marketing images for reuse

export interface MarketingImageRecord {
  characterPresetId: string;
  scenarioPresetId: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

/**
 * Save a marketing image to the database for future selection.
 */
export async function saveMarketingImage(
  record: MarketingImageRecord
): Promise<void> {
  try {
    const { getDb } = await import("@/lib/db-driver");
    const db = getDb();
    await db.from("owner_marketing_images").insert({
      character_preset_id: record.characterPresetId,
      scenario_preset_id: record.scenarioPresetId,
      prompt: record.prompt,
      image_url: record.imageUrl,
      created_at: record.createdAt,
    });
    console.log("[MARKETING] Saved marketing image to history");
  } catch (err) {
    console.warn("[MARKETING] Failed to save image history:", err);
  }
}

/**
 * Get marketing image history for the owner.
 */
export async function getMarketingImageHistory(
  limit = 50
): Promise<MarketingImageRecord[]> {
  try {
    const { getDb } = await import("@/lib/db-driver");
    const db = getDb();
    const { data } = await db
      .from("owner_marketing_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data || []).map((row: any) => ({
      characterPresetId: row.character_preset_id,
      scenarioPresetId: row.scenario_preset_id,
      prompt: row.prompt,
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
