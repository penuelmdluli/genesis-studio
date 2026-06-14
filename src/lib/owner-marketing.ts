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
    prompt: "Photorealistic full body photo of an adorable 3-year-old South African Zulu baby girl standing center frame in a confident dance-ready pose, entire body from head to tiny feet visible, sharp focus on her, radiant dark melanin-rich skin with natural glow, big bright sparkling brown eyes, wearing authentic colorful Zulu beaded headpiece and intricate beaded necklace in red gold and turquoise, vibrant red and gold traditional outfit with detailed beadwork, tiny beaded anklets, joyful beaming smile, blurred crowd of people dancing and celebrating in the background, festive atmosphere with bokeh lights, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["zulu", "traditional", "girl"],
  },
  {
    id: "xhosa-prince",
    name: "Xhosa Prince",
    prompt: "Photorealistic full body photo of a charming 4-year-old South African Xhosa baby boy standing center frame with hands on hips in a playful pose, entire body from head to shoes visible, sharp focus on him, rich dark brown skin with natural glow, bright smile showing tiny teeth, wearing modern Xhosa-inspired outfit with traditional ochre and white geometric patterns, small beaded cap, fresh white sneakers, blurred crowd of excited kids and adults cheering in the background, outdoor celebration atmosphere, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["xhosa", "traditional", "boy"],
  },
  {
    id: "ndebele-star",
    name: "Ndebele Star",
    prompt: "Photorealistic full body photo of a stunning 3-year-old South African Ndebele baby girl standing proudly center frame with arms slightly out in a dance pose, entire body from head to feet visible, sharp focus on her, beautiful deep melanin skin, wearing authentic Ndebele-inspired outfit with bold geometric patterns in electric blue canary yellow cherry red and emerald green, colorful beaded ankle bracelets, blurred traditional dancers and musicians performing in the background, cultural celebration setting, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["ndebele", "colorful", "girl"],
  },
  {
    id: "township-kid",
    name: "Township Kid",
    prompt: "Photorealistic full body photo of an irresistibly cool 4-year-old South African township baby boy standing center frame in a boss pose with arms crossed, entire body from head to fresh sneakers visible, sharp focus on him, smooth dark skin, cheeky grin, wearing trendy streetwear — brand new tiny Air Jordan sneakers, tilted bucket hat, colorful puffer jacket in SA flag green and gold, miniature gold chain necklace, blurred group of township kids hanging out and playing behind him, colorful Soweto street with graffiti walls in soft focus, main character sharp and centered, full length shot, 8K hyperrealistic",
    tags: ["urban", "streetwear", "boy"],
  },
  {
    id: "amapiano-queen",
    name: "Amapiano Queen",
    prompt: "Photorealistic full body photo of a dazzling 3-year-old South African baby girl center frame in a sassy dance pose with one hand on hip, entire body from head to sparkly shoes visible, sharp focus on her, glowing dark skin, wearing sparkling sequin mini dress in rose gold and hot pink, tiny designer sunglasses pushed up on forehead, miniature gold hoop earrings, sparkly pink shoes, blurred crowd of people dancing at a vibrant amapiano party in the background, colorful disco lights creating pink purple and blue bokeh, DJ booth silhouette, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["amapiano", "party", "girl"],
  },
  {
    id: "gqom-king",
    name: "Gqom King",
    prompt: "Photorealistic full body photo of an impossibly cool 4-year-old South African Durban baby boy standing center frame in a power stance with arms crossed, entire body from head to gold-accent sneakers visible, sharp focus on him, dark skin with dramatic lighting, wearing sleek all-black outfit with gold zipper accents and gold chain, fresh black and gold tiny sneakers, confident smirk, blurred silhouettes of people dancing in a dark club behind him, neon cyan and magenta lights casting colored beams through fog, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["gqom", "durban", "boy"],
  },
  {
    id: "rainbow-nation",
    name: "Rainbow Nation Baby",
    prompt: "Photorealistic full body photo of a beautiful 3-year-old mixed-race South African baby standing center frame with arms outstretched joyfully, entire body from curly hair to colorful shoes visible, sharp focus on her, gorgeous curly afro hair with tiny colorful ribbons in SA flag colors, wearing a bright rainbow tutu dress layered with all six flag colors, colorful sneakers, holding a miniature South African flag, enormous proud smile, blurred diverse crowd of families waving flags and celebrating Heritage Day in the background, festive atmosphere with confetti, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["rainbow", "patriotic", "unisex"],
  },
  {
    id: "safari-explorer",
    name: "Safari Explorer",
    prompt: "Photorealistic full body photo of an adventurous 4-year-old South African baby standing center frame in an explorer pose pointing forward, entire body from pith helmet to boots visible, sharp focus on them, wearing adorable safari explorer outfit with tiny khaki vest many pockets cargo shorts and little hiking boots, miniature pith helmet, oversized binoculars around neck, curious excited expression, blurred group of safari tourists and a safari vehicle in the background, golden African savanna with acacia trees at sunset, main character in perfect focus, full length shot, 8K hyperrealistic",
    tags: ["safari", "adventure", "unisex"],
  },
  {
    id: "soweto-dancer",
    name: "Soweto Dancer",
    prompt: "Photorealistic full body photo of a dynamic 3-year-old South African baby center frame mid-dance-move with arms spread wide and one foot lifted, entire body from head to fresh sneakers visible, sharp focus on them, dark skin glistening with energy, wearing colorful African print outfit with modern streetwear fusion and fresh dance sneakers, huge joyful laughing expression, blurred circle of excited township kids and adults clapping and cheering around them, street dance battle atmosphere, golden afternoon light between colorful houses, main character tack sharp, full length action shot, 8K hyperrealistic",
    tags: ["dance", "soweto", "unisex"],
  },
  {
    id: "tech-prodigy",
    name: "Tech Prodigy",
    prompt: "Photorealistic full body photo of a focused 4-year-old South African baby standing center frame confidently holding a tiny tablet, entire body from head to clean sneakers visible, sharp focus on them, wearing miniature round glasses and smart casual outfit with tiny blazer jeans and clean white sneakers, one hand holding glowing tablet, serious concentrated expression, blurred group of tech professionals working at desks with screens in a modern open-plan office behind them, futuristic startup atmosphere with subtle teal and purple ambient lighting, main character in perfect focus, full length shot, 8K hyperrealistic",
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
