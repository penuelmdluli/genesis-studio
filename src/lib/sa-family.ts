/**
 * SA Family Studio — Character, Scene, Dance & Preset definitions
 *
 * Client-safe: no server imports. Safe for "use client" components.
 */

// ── Family Characters ──────────────────────────────────────────

export interface FamilyCharacter {
  id: string;
  name: string;
  emoji: string;
  age: string;
  description: string;
  promptFragment: string;
}

export const SA_FAMILY_CHARACTERS: FamilyCharacter[] = [
  {
    id: "gogo",
    name: "Gogo",
    emoji: "👵",
    age: "70s",
    description: "The beloved grandmother — wise, warm, and full of surprises",
    promptFragment: "a lively 70-year-old South African Zulu grandmother (gogo) with a warm wrinkled face and bright kind eyes, wearing a traditional colorful Shweshwe dress with a matching doek headwrap, sturdy comfortable shoes",
  },
  {
    id: "mkhulu",
    name: "Mkhulu",
    emoji: "👴",
    age: "75",
    description: "The patriarch — stoic until the music hits",
    promptFragment: "a distinguished 75-year-old South African Zulu grandfather (mkhulu) with grey hair and warm smile, wearing a neat button-up shirt with rolled sleeves, smart trousers and polished shoes, reading glasses on nose",
  },
  {
    id: "mama",
    name: "Mama",
    emoji: "👩",
    age: "40s",
    description: "The heart of the family — juggling everything with grace",
    promptFragment: "a beautiful 40-year-old South African mother with warm dark skin and confident smile, wearing a modern African print dress with bold ankara patterns, gold hoop earrings, neat natural hair",
  },
  {
    id: "baba",
    name: "Baba",
    emoji: "👨",
    age: "45",
    description: "The dad — protective, proud, secretly the best dancer",
    promptFragment: "a handsome 45-year-old South African father with strong build and warm smile, wearing a clean polo shirt and jeans with fresh sneakers, short neat haircut, gold watch",
  },
  {
    id: "naledi",
    name: "Naledi",
    emoji: "👧",
    age: "8",
    description: "The eldest daughter — sassy, smart, always filming for TikTok",
    promptFragment: "an adorable sassy 8-year-old South African girl with beautiful dark melanin skin and bright eyes, wearing trendy kids streetwear with colorful sneakers, braided hair with colorful beads",
  },
  {
    id: "lwazi",
    name: "Lwazi",
    emoji: "👦",
    age: "5",
    description: "The youngest — chaos personified, steals every scene",
    promptFragment: "an irresistibly cute mischievous 5-year-old South African boy with big sparkling brown eyes and cheeky grin, wearing a tiny bucket hat, oversized t-shirt and miniature Air Jordans",
  },
  {
    id: "auntie",
    name: "Auntie Thandi",
    emoji: "💃",
    age: "35",
    description: "The fun aunt — arrived overdressed and ready to party",
    promptFragment: "a glamorous 35-year-old South African aunt with flawless makeup and long braids, wearing a stunning figure-hugging sequin dress in gold, high heels, oversized designer sunglasses, dripping with confidence",
  },
  {
    id: "uncle",
    name: "Uncle Sbu",
    emoji: "🕺",
    age: "38",
    description: "The cool uncle — DJ, braai master, amapiano enthusiast",
    promptFragment: "a cool 38-year-old South African uncle with fresh fade haircut and neat beard, wearing a designer jacket over a graphic tee, gold chain, clean white sneakers, always looking fresh",
  },
];

// ── Scenes ─────────────────────────────────────────────────────

export interface FamilyScene {
  id: string;
  name: string;
  emoji: string;
  promptFragment: string;
}

export const SA_FAMILY_SCENES: FamilyScene[] = [
  {
    id: "braai",
    name: "Sunday Braai",
    emoji: "🔥",
    promptFragment: "at a South African family braai (BBQ) in the backyard, braai fire glowing, garden table with potato salad and dumplings, warm golden afternoon sunlight, festive family gathering atmosphere",
  },
  {
    id: "church",
    name: "After Church",
    emoji: "⛪",
    promptFragment: "outside a South African church after Sunday service, wearing their best Sunday clothes, bright sunshine, green church yard, joyful congregation celebrating in the background",
  },
  {
    id: "living_room",
    name: "Living Room",
    emoji: "🏠",
    promptFragment: "in a cozy South African township living room, colorful crochet blankets on couches, family photos on walls, warm lighting from table lamp, comfortable home atmosphere",
  },
  {
    id: "wedding",
    name: "Family Wedding",
    emoji: "💒",
    promptFragment: "at a beautiful South African wedding reception, white tent with fairy lights, flower decorations, guests dancing in the background, joyful celebration atmosphere",
  },
  {
    id: "street",
    name: "Township Street",
    emoji: "🏘️",
    promptFragment: "on a vibrant South African township street, colorful houses in the background, kids playing, bright sunshine, authentic Soweto or Khayelitsha atmosphere, community vibe",
  },
  {
    id: "stadium",
    name: "Stadium Party",
    emoji: "🏟️",
    promptFragment: "at a packed South African stadium with colorful crowd, makarapa hats visible, vuvuzelas, SA flags waving, electric sport celebration atmosphere, bright floodlights",
  },
  {
    id: "kitchen",
    name: "Ma's Kitchen",
    emoji: "🍲",
    promptFragment: "in a warm South African kitchen, pots of umngqusho and pap on the stove, spice rack visible, checkered tablecloth, warm homey atmosphere, cooking steam rising",
  },
  {
    id: "park",
    name: "Park / Picnic",
    emoji: "🌳",
    promptFragment: "in a beautiful South African park on a sunny day, green grass, picnic blanket and baskets, jacaranda trees with purple flowers, families relaxing in the background",
  },
];

// ── Dance Styles ───────────────────────────────────────────────

export interface DanceStyle {
  id: string;
  name: string;
  emoji: string;
  description: string;
  animationPrompt: string;
  posePrompt: string;
}

export const SA_DANCE_STYLES: DanceStyle[] = [
  {
    id: "amapiano",
    name: "Amapiano",
    emoji: "💃",
    description: "The log driver — smooth hips, loose arms",
    animationPrompt: "person performing amapiano log driver dance move, smooth hip sway and arm swing, feet doing the subtle step, body loose and joyful, pure South African amapiano energy, rhythmic movement",
    posePrompt: "in a confident amapiano dance freeze-frame pose, one hip cocked to the side, arms flowing mid-swing, weight on one foot, looking joyful",
  },
  {
    id: "gwara_gwara",
    name: "Gwara Gwara",
    emoji: "🔥",
    description: "Full body wave — fluid and electric",
    animationPrompt: "person performing gwara gwara dance, fluid full-body wave motion, arms electric and alive, complete physical abandon, iconic South African gwara gwara style, energetic movement",
    posePrompt: "in a dynamic gwara gwara freeze-frame pose, body mid-wave, arms raised and flowing, knees bent, full energy captured in one moment",
  },
  {
    id: "kwaito",
    name: "Kwaito",
    emoji: "🎵",
    description: "Classic township bounce — shoulders rolling",
    animationPrompt: "person performing kwaito bounce dance, shoulders rolling smoothly, knees bent and bouncing, classic township kwaito groove, relaxed confident movement",
    posePrompt: "in a relaxed kwaito bounce pose, shoulders slightly forward, knees bent, hands in a cool relaxed position, confident township stance",
  },
  {
    id: "pantsula",
    name: "Pantsula",
    emoji: "👟",
    description: "Precision footwork — sharp and controlled",
    animationPrompt: "person performing pantsula footwork, precise sharp foot movements, upper body controlled, South African pantsula street dance, rapid intricate steps",
    posePrompt: "in a sharp pantsula freeze-frame pose, one foot precisely placed, arms controlled at sides, focused expression, street dance attitude",
  },
  {
    id: "gqom",
    name: "Gqom",
    emoji: "🎶",
    description: "Durban bass drop — low and heavy",
    animationPrompt: "person performing gqom dance, low centre of gravity, full body bounce and drop, Durban gqom dance style, heavy bass-driven movement",
    posePrompt: "in a low gqom drop pose, knees deeply bent, body low to the ground, arms forward, intense Durban dance energy",
  },
  {
    id: "praise",
    name: "Praise Dance",
    emoji: "⛪",
    description: "Gospel celebration — joyful and spirited",
    animationPrompt: "person performing South African gospel praise dance, arms raised high in worship, joyful jumping and spinning, church celebration dance, spiritual ecstasy movement",
    posePrompt: "in a praise dance pose, arms raised high to the sky, face tilted up with eyes closed in joy, one foot slightly lifted, spiritual celebration stance",
  },
  {
    id: "vosho",
    name: "Vosho",
    emoji: "⚡",
    description: "The viral squat kick — explosive energy",
    animationPrompt: "person performing vosho dance, explosive squat and kick movement, alternating legs kicking out while squatting low, high energy South African dance, viral TikTok dance energy",
    posePrompt: "in a vosho squat-kick freeze-frame pose, one leg kicked out forward, body in deep squat, arms out for balance, explosive energy",
  },
  {
    id: "any",
    name: "Freestyle",
    emoji: "🕺",
    description: "Let them dance their own way",
    animationPrompt: "person dancing joyfully with full abandon, South African township dance energy, authentic spontaneous movement and pure joy, free flowing dance",
    posePrompt: "in a dynamic freestyle dance pose, mid-movement, body expressing pure joy, authentic natural dance moment",
  },
];

// ── Quick Presets ───────────────────────────────────────────────

export interface FamilyPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  characterId: string;
  sceneId: string;
  danceId: string;
}

export const SA_FAMILY_PRESETS: FamilyPreset[] = [
  { id: "gogo_amapiano", name: "Gogo Amapiano", emoji: "👵🔥", description: "Gogo shows them how it's done — amapiano style", characterId: "gogo", sceneId: "living_room", danceId: "amapiano" },
  { id: "mkhulu_gwara", name: "Mkhulu Gwara Gwara", emoji: "👴😱", description: "Mkhulu surprises everyone with gwara gwara", characterId: "mkhulu", sceneId: "braai", danceId: "gwara_gwara" },
  { id: "family_braai", name: "Braai Dance-Off", emoji: "🔥", description: "The whole family vibing at the Sunday braai", characterId: "mama", sceneId: "braai", danceId: "amapiano" },
  { id: "lwazi_steals", name: "Lwazi Steals the Show", emoji: "👦⚡", description: "The little one shows up everyone", characterId: "lwazi", sceneId: "wedding", danceId: "vosho" },
  { id: "church_praise", name: "After Church Praise", emoji: "⛪🙏", description: "Sunday service just ended — the spirit is moving", characterId: "mama", sceneId: "church", danceId: "praise" },
  { id: "auntie_entrance", name: "Auntie's Grand Entrance", emoji: "💃✨", description: "Auntie Thandi arrives and steals all attention", characterId: "auntie", sceneId: "wedding", danceId: "amapiano" },
  { id: "uncle_dj", name: "Uncle Sbu's Set", emoji: "🕺🎧", description: "Uncle Sbu drops the beat and can't help himself", characterId: "uncle", sceneId: "stadium", danceId: "gqom" },
  { id: "naledi_tiktok", name: "Naledi's TikTok", emoji: "👧📱", description: "Naledi filming her latest dance challenge", characterId: "naledi", sceneId: "street", danceId: "amapiano" },
  { id: "baba_kwaito", name: "Baba's Throwback", emoji: "👨🎵", description: "Baba hears his old school kwaito jam", characterId: "baba", sceneId: "living_room", danceId: "kwaito" },
  { id: "gogo_gqom", name: "Gogo Goes Gqom", emoji: "👵🎶", description: "They said she couldn't — Gogo proved them wrong", characterId: "gogo", sceneId: "street", danceId: "gqom" },
];

// ── Prompt Builder ─────────────────────────────────────────────

export function buildFamilyImagePrompt(params: {
  character: FamilyCharacter;
  scene: FamilyScene;
  dance: DanceStyle;
}): { prompt: string; negativePrompt: string } {
  const { character, scene, dance } = params;

  const prompt = [
    "Photorealistic full body photo of",
    character.promptFragment,
    dance.posePrompt,
    scene.promptFragment,
    "entire body from head to feet visible, sharp focus on main subject,",
    "blurred people in the background, bokeh background,",
    "main character centered and in perfect focus,",
    "full length shot, 8K hyperrealistic, masterpiece quality",
  ].join(", ");

  const negativePrompt = [
    "blurry", "out of focus", "motion blur", "cropped", "cut off feet",
    "cut off head", "bad anatomy", "deformed", "extra limbs", "watermark",
    "text overlay", "logo", "signature", "cartoon", "anime", "illustration",
    "painting", "drawing", "low quality", "jpeg artifacts",
  ].join(", ");

  return { prompt, negativePrompt };
}

// ── Credit Costs ───────────────────────────────────────────────

export const SA_FAMILY_COSTS = {
  imageOnly: 10,      // WaveSpeed Flux Dev image generation
  animateOnly: 280,   // Motion control (standard 10s)
  full: 290,          // Image + animation combined
} as const;
