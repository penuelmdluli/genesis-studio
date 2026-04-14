// ============================================
// STOCK FOOTAGE ENGINE
// Sources real footage from Pexels + Pixabay by
// matching keywords from the script. Solves the
// AI avatar problem by using real human-created
// b-roll instead of AI-generated clips.
//
// Free API keys:
//   Pexels:  https://www.pexels.com/api/  (200 req/hr)
//   Pixabay: https://pixabay.com/api/docs/ (5000 req/hr)
// ============================================

export interface StockClip {
  url: string;          // Direct video file URL
  duration: number;     // Seconds
  width: number;
  height: number;
  source: "library-a" | "library-b"; // Opaque — hide provider names from UI
  thumbUrl?: string;
  id: string | number;
}

export interface SearchParams {
  query: string;
  targetWidth: number;
  targetHeight: number;
  minDuration: number;
  orientation?: "portrait" | "landscape" | "square";
  perPage?: number;
}

// ─────────────────────────────────────────────────────────
// PROVIDER A (Pexels)
// ─────────────────────────────────────────────────────────

async function searchProviderA(p: SearchParams): Promise<StockClip[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query: p.query,
    per_page: String(p.perPage || 20),
    ...(p.orientation && { orientation: p.orientation }),
  });

  try {
    const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
      headers: {
        Authorization: key,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      console.warn(`[STOCK-A] search "${p.query}" → HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      videos?: Array<{
        id: number;
        duration: number;
        width: number;
        height: number;
        image?: string;
        video_files?: Array<{ link: string; width: number; height: number; quality?: string; file_type?: string }>;
      }>;
    };

    const out: StockClip[] = [];
    for (const v of data.videos || []) {
      if (v.duration < p.minDuration) continue;

      // Prefer exact-match resolution, fall back to any HD (≥720p)
      const files = v.video_files || [];
      const exact = files.find((f) => f.width === p.targetWidth && f.height === p.targetHeight);
      const sameAspect = files.find((f) => {
        const ar = f.width / f.height;
        const targetAr = p.targetWidth / p.targetHeight;
        return Math.abs(ar - targetAr) < 0.02 && f.height >= 720;
      });
      const anyHd = files.find((f) => f.height >= 720 && (f.file_type === "video/mp4" || f.link.endsWith(".mp4")));

      const pick = exact || sameAspect || anyHd;
      if (!pick) continue;

      out.push({
        url: pick.link,
        duration: v.duration,
        width: pick.width,
        height: pick.height,
        source: "library-a",
        thumbUrl: v.image,
        id: v.id,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[STOCK-A] error:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// PROVIDER B (Pixabay)
// ─────────────────────────────────────────────────────────

async function searchProviderB(p: SearchParams): Promise<StockClip[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    q: p.query,
    video_type: "all",
    per_page: String(p.perPage || 50),
    key,
    safesearch: "true",
  });

  try {
    const res = await fetch(`https://pixabay.com/api/videos/?${params}`);
    if (!res.ok) {
      console.warn(`[STOCK-B] search "${p.query}" → HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      hits?: Array<{
        id: number;
        duration: number;
        picture_id?: string;
        videos?: Record<string, { url: string; width: number; height: number }>;
      }>;
    };

    const out: StockClip[] = [];
    for (const hit of data.hits || []) {
      if (hit.duration < p.minDuration) continue;
      const variants = hit.videos ? Object.values(hit.videos) : [];

      // Pick the smallest variant ≥ target dimensions (saves bandwidth, matches quality)
      const candidates = variants
        .filter((v) => v.width >= p.targetWidth && v.height >= p.targetHeight && v.url)
        .sort((a, b) => a.width * a.height - b.width * b.height);

      // Fallback: any variant with height ≥ 720
      const pick = candidates[0] || variants.find((v) => v.height >= 720);
      if (!pick || !pick.url) continue;

      out.push({
        url: pick.url,
        duration: hit.duration,
        width: pick.width,
        height: pick.height,
        source: "library-b",
        thumbUrl: hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_1280.jpg` : undefined,
        id: hit.id,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[STOCK-B] error:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// PUBLIC: Find the best clip for a scene description
// ─────────────────────────────────────────────────────────

// Topic-to-search-terms dictionary for common viral content categories.
// When scene prompt keywords match any of these keys, we prefer these proven
// stock-footage search phrases over raw extraction.
const TOPIC_SEARCH_PHRASES: Record<string, string[]> = {
  // Money / economy / markets
  market: ["stock market crash", "wall street trading floor", "bear market", "financial crisis"],
  stock: ["stock market", "trading screens", "wall street", "stock exchange"],
  economy: ["economy recession", "inflation", "business district", "city skyline finance"],
  rand: ["south african currency", "money exchange", "currency crash"],
  currency: ["money cash", "currency exchange", "banknotes"],
  inflation: ["rising prices", "grocery store", "money stack"],
  recession: ["empty office", "closed business", "economic downturn"],
  crypto: ["bitcoin", "cryptocurrency trading", "digital coins"],
  bitcoin: ["bitcoin crypto", "digital currency"],
  // Oil / energy / Middle East
  oil: ["oil refinery", "oil tanker ship", "gas pump", "oil rig"],
  pipeline: ["oil pipeline", "energy infrastructure", "desert pipeline"],
  hormuz: ["oil tanker", "persian gulf ships", "navy warship"],
  gas: ["gas station", "oil refinery", "natural gas plant"],
  // Wars / military
  war: ["war military", "battlefield", "tank desert", "soldiers marching"],
  military: ["military parade", "army tanks", "soldiers training"],
  missile: ["missile launch", "rocket fire", "military weapons"],
  tank: ["military tank", "armored vehicle"],
  soldier: ["soldiers training", "military troops"],
  drone: ["military drone", "aerial surveillance"],
  strike: ["military strike", "airstrike", "explosion"],
  nato: ["military alliance", "nato troops"],
  ukraine: ["ukraine war", "destroyed buildings", "refugees"],
  iran: ["iran middle east", "tehran city"],
  israel: ["israel flag", "jerusalem", "middle east conflict"],
  // Politics
  trump: ["donald trump speech", "white house", "political rally"],
  politics: ["government building", "politician speech", "congress parliament"],
  parliament: ["parliament building", "government chamber"],
  election: ["voting booth", "ballot box", "political rally"],
  anc: ["south africa government", "parliament cape town"],
  da: ["south africa parliament"],
  eskom: ["power station", "electricity grid", "south africa infrastructure"],
  loadshedding: ["power outage", "city blackout", "power lines"],
  // Crime
  crime: ["police car", "crime scene", "handcuffs", "police siren"],
  police: ["police car siren", "police officer", "patrol vehicle"],
  robbery: ["security camera", "bank vault", "crime scene"],
  murder: ["police crime scene", "investigation"],
  arrested: ["handcuffs", "police arrest", "jail cell"],
  prison: ["prison bars", "jail cell", "orange jumpsuit"],
  cartel: ["drug bust", "police raid", "money cash stack"],
  hijack: ["highway police", "car chase", "emergency sirens"],
  // Tech / AI
  ai: ["artificial intelligence", "computer server", "data center", "futuristic tech"],
  "artificial intelligence": ["ai computer", "robot arm", "data center servers"],
  robot: ["humanoid robot", "robotic arm factory"],
  chatgpt: ["computer screen", "typing keyboard", "ai interface"],
  tech: ["technology data center", "server room", "silicon valley"],
  startup: ["modern office", "tech workers", "coworking space"],
  chip: ["semiconductor", "microchip circuit", "silicon wafer"],
  data: ["data center", "server rack", "network cables"],
  cyber: ["hacker computer", "cybersecurity", "binary code"],
  hack: ["computer hacker", "matrix code", "dark room computer"],
  starlink: ["satellite space", "starlink dish", "satellite orbit"],
  elon: ["spacex rocket", "tesla car", "technology innovation"],
  tesla: ["electric car", "tesla factory", "ev charging"],
  spacex: ["rocket launch", "spacex rocket", "space mission"],
  // Africa-specific
  africa: ["african city skyline", "african continent", "africa landscape"],
  johannesburg: ["johannesburg skyline", "south africa city"],
  "cape town": ["cape town table mountain", "south africa coast"],
  durban: ["durban beach", "south africa coast"],
  soweto: ["township south africa", "johannesburg neighborhood"],
  mzansi: ["south africa", "johannesburg skyline"],
  lagos: ["lagos nigeria city", "african metropolis"],
  nairobi: ["nairobi kenya", "african city"],
  "south africa": ["south africa landscape", "johannesburg skyline", "south africa flag"],
  // News generic
  news: ["news broadcast", "newsroom", "breaking news graphics"],
  breaking: ["news alert", "breaking news studio"],
  // Topics I saw in queue
  jobs: ["office workers typing", "call center agents", "open plan office", "business people working"],
  job: ["office workers", "busy office", "employees computer"],
  layoff: ["empty office desk", "closed business", "unemployment line"],
  replacing: ["office automation", "robot arm factory", "computer server rack"],
  automation: ["robotic factory", "automated assembly line", "robot arm"],
  worker: ["office worker typing", "business professional"],
  employee: ["office workers", "call center", "business meeting"],
  china: ["china shanghai skyline", "beijing city", "chinese flag"],
  whatsapp: ["smartphone messaging", "mobile phone typing"],
  food: ["grocery shopping", "food market", "produce aisle"],
  price: ["grocery store shopping", "shopping cart", "supermarket aisle"],
};

// Anti-keywords — if the stock clip's URL or metadata hints at these, skip it.
// Prevents Revolutionary War reenactments, medieval footage, cartoons, etc.
const BLACKLIST_TERMS = [
  "revolutionary-war",
  "civil-war",
  "medieval",
  "reenactment",
  "historical-battle",
  "cartoon",
  "animation-kids",
  "vintage-uniform",
];

/**
 * Convert a scene prompt + topic into search terms.
 *
 * Dictionary-first strategy: we ONLY use proven search phrases from
 * TOPIC_SEARCH_PHRASES. No freeform noun extraction (that produced garbage
 * matches like Revolutionary War reenactments).
 *
 * Fallback: if no dictionary hits, just use the topic title as-is.
 */
export function extractSearchTerms(scenePrompt: string, topicTitle?: string): string[] {
  const combinedLower = `${scenePrompt} ${topicTitle || ""}`.toLowerCase();
  const matches: string[] = []; // preserve order of addition

  // Score each topic by # of keyword matches and preserve strongest first
  const topicHits: Array<{ phrases: string[]; score: number }> = [];
  for (const [key, phrases] of Object.entries(TOPIC_SEARCH_PHRASES)) {
    // Match whole-word (avoid "ai" matching "said")
    const re = new RegExp(`\\b${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(combinedLower)) {
      topicHits.push({ phrases, score: phrases.length });
    }
  }

  // Flatten top-matching phrases (up to 2 per topic, 6 total)
  for (const hit of topicHits) {
    for (const phrase of hit.phrases.slice(0, 2)) {
      if (matches.length < 6 && !matches.includes(phrase)) matches.push(phrase);
    }
  }

  // If no dictionary hits at all, fall back to topic title
  if (matches.length === 0 && topicTitle) {
    // Strip numbers and filler
    const cleanTopic = topicTitle
      .replace(/^\d+\s*(ways|reasons|jobs|things|tips)/i, "$1")
      .replace(/[0-9]+%?/g, "")
      .replace(/\b(is|are|the|a|an|will|has|have|just|now|here|this|that)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanTopic.length > 5) matches.push(cleanTopic);
  }

  return matches.slice(0, 4);
}

/**
 * Find the best stock clip matching a scene.
 * Tries multiple keywords across both providers.
 * Returns null if nothing matches.
 */
export async function findStockClip(params: {
  scenePrompt: string;
  topicTitle?: string;
  sceneIndex?: number; // 0-based; used to vary search term selection across scenes
  targetWidth?: number;
  targetHeight?: number;
  minDuration?: number;
  aspectRatio?: "portrait" | "landscape" | "square";
  excludeUrls?: Set<string>; // clips already used in this production
}): Promise<StockClip | null> {
  const targetWidth = params.targetWidth ?? (params.aspectRatio === "portrait" ? 720 : 1280);
  const targetHeight = params.targetHeight ?? (params.aspectRatio === "portrait" ? 1280 : 720);
  const minDuration = params.minDuration ?? 5;
  const orientation =
    params.aspectRatio === "portrait"
      ? "portrait"
      : params.aspectRatio === "square"
        ? "square"
        : "landscape";

  const allTerms = extractSearchTerms(params.scenePrompt, params.topicTitle);
  if (allTerms.length === 0) {
    console.warn(`[STOCK] No search terms extracted from prompt`);
    return null;
  }
  // Rotate terms by scene index so different scenes search different phrases.
  // e.g. scene 1 starts at term 0, scene 2 starts at term 1, etc.
  const startIdx = (params.sceneIndex || 0) % allTerms.length;
  const terms = [...allTerms.slice(startIdx), ...allTerms.slice(0, startIdx)];
  console.log(`[STOCK scene=${params.sceneIndex ?? 0}] Searching for: ${terms.map((t) => `"${t}"`).join(", ")}`);

  const allClips: StockClip[] = [];
  const seen = new Set<string>();

  // Try each search term in both providers (parallel per term)
  for (const term of terms) {
    const [a, b] = await Promise.all([
      searchProviderA({ query: term, targetWidth, targetHeight, minDuration, orientation }),
      searchProviderB({ query: term, targetWidth, targetHeight, minDuration }),
    ]);
    for (const clip of [...a, ...b]) {
      if (seen.has(clip.url)) continue;
      if (params.excludeUrls?.has(clip.url)) continue;
      // Skip blacklisted content (historical reenactments, cartoons, etc.)
      const urlLower = clip.url.toLowerCase();
      if (BLACKLIST_TERMS.some((t) => urlLower.includes(t))) continue;
      seen.add(clip.url);
      allClips.push(clip);
    }
    // Stop searching once we have enough candidates
    if (allClips.length >= 10) break;
  }

  if (allClips.length === 0) {
    console.warn(`[STOCK] No clips found for terms: ${terms.join(", ")}`);
    return null;
  }

  // Pick best: exact dimension match first, otherwise longest/most aspect-accurate
  const targetAr = targetWidth / targetHeight;
  const scored = allClips.map((c) => {
    const ar = c.width / c.height;
    const arScore = 1 - Math.min(Math.abs(ar - targetAr) / targetAr, 1);
    const resScore = Math.min(c.height / targetHeight, 2);
    const durScore = Math.min(c.duration / (minDuration * 2), 1);
    return { clip: c, score: arScore * 0.5 + resScore * 0.3 + durScore * 0.2 };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0].clip;
  console.log(`[STOCK] Selected: ${best.source} ${best.width}x${best.height} ${best.duration}s (score=${scored[0].score.toFixed(2)})`);
  return best;
}

/**
 * Download a stock clip server-side and re-upload to our R2 bucket.
 * This solves two problems:
 *   1. Pexels/Pixabay CDNs sometimes block hotlinking (403 from some IPs)
 *   2. We get a stable URL we own (no expiration)
 *
 * Returns a signed R2 URL, or the original URL if upload fails.
 */
export async function mirrorClipToR2(clip: StockClip, productionId: string, sceneNumber: number): Promise<string> {
  try {
    const { S3Client, PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const R2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";

    // Use API-key auth on download when possible (Pexels rejects some unauth IPs)
    const downloadHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; Genesis-Studio/1.0)",
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    };
    if (clip.source === "library-a" && process.env.PEXELS_API_KEY) {
      downloadHeaders.Authorization = process.env.PEXELS_API_KEY;
    }

    const dlRes = await fetch(clip.url, { headers: downloadHeaders });
    if (!dlRes.ok) {
      console.warn(`[STOCK] Download failed ${dlRes.status} for ${clip.url.substring(0, 60)} — returning original URL`);
      return clip.url;
    }
    const buf = Buffer.from(await dlRes.arrayBuffer());
    if (buf.length < 10_000) {
      console.warn(`[STOCK] Download suspiciously small: ${buf.length}B — returning original URL`);
      return clip.url;
    }

    const key = `stock-scenes/${productionId.substring(0, 8)}/${sceneNumber}.mp4`;
    await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: "video/mp4" }));
    const signedUrl = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 86400 });
    console.log(`[STOCK] Mirrored ${(buf.length / 1024 / 1024).toFixed(1)}MB to R2: ${key}`);
    return signedUrl;
  } catch (err) {
    console.warn(`[STOCK] mirror-to-R2 failed:`, err instanceof Error ? err.message : err);
    return clip.url;
  }
}

/**
 * Check if stock footage is available (any API key configured).
 */
export function isStockFootageAvailable(): boolean {
  return !!(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);
}

/**
 * Decide whether a scene should use stock footage vs AI generation.
 * Rules:
 * - News/politics/finance/breaking → STOCK (no avatar, real events)
 * - AI-specific topics / unique visuals → AI
 * - Default (when topic is generic) → STOCK
 */
export function shouldUseStockFootage(pillar: string | undefined): boolean {
  if (!pillar) return true;
  const stockPillars = new Set([
    "news",
    "news_animated",
    "breaking_news",
    "geopolitics",
    "finance",
    "tech",
    "entertainment",
    "celebrity",
    "viral_moments",
    "health_wellness",
    "wars",
    "crime",
    "guns",
  ]);
  return stockPillars.has(pillar);
}
