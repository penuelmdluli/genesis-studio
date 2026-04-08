/**
 * Gemini News Source
 *
 * Fetches trending topics from Google Gemini API for multiple African regions.
 * Uses direct REST API calls to avoid adding a dependency.
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const REGION_MAP: Record<string, string> = {
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  AFRICA: "Pan-Africa",
  GLOBAL: "Global",
};

const DEFAULT_REGIONS = Object.keys(REGION_MAP);

export interface GeminiNewsItem {
  title: string;
  summary: string;
  category:
    | "politics"
    | "sports"
    | "entertainment"
    | "technology"
    | "culture"
    | "breaking";
  viral_potential: number;
  content_angle: string;
  suggested_hook: string;
  region: string;
  source: "gemini";
  timestamp: string;
}

function buildPrompt(regionCode: string, regionName: string): string {
  const now = new Date().toISOString();
  return (
    `You are a viral content scout for an African social media network. ` +
    `Return ONLY valid JSON array, no markdown, no code blocks.\n\n` +
    `Find the top 10 trending news topics right now for ${regionName}. For each topic return:\n` +
    `{"title":"headline","summary":"2 sentence summary","category":"politics|sports|entertainment|technology|culture|breaking",` +
    `"viral_potential":8,"content_angle":"How to frame this as a 30-sec video",` +
    `"suggested_hook":"Opening line that stops scrolling","region":"${regionCode}",` +
    `"source":"gemini","timestamp":"${now}"}\n\n` +
    `Return array of 10 objects. Pure JSON array only. No other text.`
  );
}

/**
 * Strip markdown code fences from a response string.
 * Gemini sometimes wraps JSON in ```json ... ``` blocks.
 */
function stripCodeBlocks(text: string): string {
  let cleaned = text.trim();
  // Remove opening code fence (```json or ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  // Remove closing code fence
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
}

async function fetchRegionTrends(
  regionCode: string,
  apiKey: string,
): Promise<GeminiNewsItem[]> {
  const regionName = REGION_MAP[regionCode];
  if (!regionName) {
    console.warn(`[Gemini] Unknown region code: ${regionCode}`);
    return [];
  }

  const prompt = buildPrompt(regionCode, regionName);

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}) for ${regionCode}: ${errorText}`,
    );
  }

  const data = await response.json();
  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    throw new Error(`Gemini returned empty content for ${regionCode}`);
  }

  const cleanedText = stripCodeBlocks(rawText);
  const parsed: unknown = JSON.parse(cleanedText);

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Gemini response for ${regionCode} is not an array`,
    );
  }

  // Validate and coerce each item
  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ""),
    summary: String(item.summary ?? ""),
    category: validateCategory(String(item.category ?? "breaking")),
    viral_potential: clampNumber(Number(item.viral_potential ?? 5), 1, 10),
    content_angle: String(item.content_angle ?? ""),
    suggested_hook: String(item.suggested_hook ?? ""),
    region: regionCode,
    source: "gemini" as const,
    timestamp: String(item.timestamp ?? new Date().toISOString()),
  }));
}

function validateCategory(
  cat: string,
): GeminiNewsItem["category"] {
  const valid = [
    "politics",
    "sports",
    "entertainment",
    "technology",
    "culture",
    "breaking",
  ] as const;
  const lower = cat.toLowerCase() as GeminiNewsItem["category"];
  return valid.includes(lower) ? lower : "breaking";
}

function clampNumber(n: number, min: number, max: number): number {
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Fetch trending topics from Gemini for the given regions.
 * Each region is fetched independently; failures are logged and skipped.
 */
export async function fetchGeminiTrends(
  regions?: string[],
): Promise<GeminiNewsItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini] GEMINI_API_KEY is not set");
    return [];
  }

  const targetRegions = regions ?? DEFAULT_REGIONS;
  const results: GeminiNewsItem[] = [];

  // Fetch all regions in parallel, each with its own error handling
  const settled = await Promise.allSettled(
    targetRegions.map((region) => fetchRegionTrends(region, apiKey)),
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      results.push(...result.value);
    } else {
      console.error(
        `[Gemini] Failed to fetch trends for ${targetRegions[i]}:`,
        result.reason,
      );
    }
  }

  console.log(
    `[Gemini] Fetched ${results.length} trending topics across ${targetRegions.length} regions`,
  );
  return results;
}
