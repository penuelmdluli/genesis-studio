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

/**
 * Convert a verbose scene prompt into 2-4 short search terms.
 * Strips camera/lighting/style jargon. Uses the first few nouns + topic.
 */
export function extractSearchTerms(scenePrompt: string): string[] {
  // Remove cinematography jargon
  const cleaned = scenePrompt
    .replace(/slow dolly|push-in|tracking shot|crane|steadicam|handheld|orbit|drone|jib|whip pan|parallax|locked-off|dutch angle|rack focus|rim light/gi, "")
    .replace(/\d+mm|f\/[\d.]+/gi, "")
    .replace(/cinematic|photorealistic|anamorphic|4K|film grain|shallow depth of field|golden hour|rembrandt lighting|chiaroscuro|volumetric/gi, "")
    .replace(/No human face.*$/i, "")
    .replace(/[,.]\s*/g, ". ")
    .trim();

  // Take first 2 sentences, pull key nouns/phrases
  const sentences = cleaned.split(".").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const terms: string[] = [];
  for (const s of sentences) {
    // Grab 2-5 significant words
    const words = s
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/^(with|from|into|this|that|their|about|very|just|only|over|under|above|below)$/i.test(w))
      .slice(0, 4);
    if (words.length > 0) terms.push(words.join(" "));
  }
  return terms.filter(Boolean);
}

/**
 * Find the best stock clip matching a scene.
 * Tries multiple keywords across both providers.
 * Returns null if nothing matches.
 */
export async function findStockClip(params: {
  scenePrompt: string;
  targetWidth?: number;
  targetHeight?: number;
  minDuration?: number;
  aspectRatio?: "portrait" | "landscape" | "square";
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

  const terms = extractSearchTerms(params.scenePrompt);
  if (terms.length === 0) {
    console.warn(`[STOCK] No search terms extracted from prompt`);
    return null;
  }
  console.log(`[STOCK] Searching for: ${terms.map((t) => `"${t}"`).join(", ")}`);

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
