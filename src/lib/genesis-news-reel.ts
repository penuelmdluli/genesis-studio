// ============================================
// GENESIS NEWS — edited soccer news reels from real (licensed) footage
// ============================================
// 1. Scraper /genesis-reel/find: YouTube Creative Commons clips for the story
// 2. Gemini writes the banner, one caption per clip and the post caption
//    (falls back to tidied clip titles if Gemini is unavailable)
// 3. Scraper /genesis-reel/render: crops source branding off, reframes 9:16,
//    adds banner/captions/on-screen credits, uploads to R2
// 4. Optional: publish to the Genesis News Facebook page with credits in the caption
//
// Env: SCRAPER_SERVICE_URL, SCRAPER_SERVICE_SECRET, GEMINI_API_KEY,
//      FB_PAGE_TOKEN_genesis_news (scraper needs YOUTUBE_API_KEY)

import { r2PublicUrl } from "@/lib/storage";
import { publishReel } from "@/lib/facebook-reels";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface FoundClip {
  id: string;
  title: string;
  creator: string;
  url: string;
  license: string;
  durationSec: number;
}

export interface ReelCopy {
  banner: [string, string];
  captions: string[]; // one per clip, *word* = gold highlight
  postCaption: string;
}

export interface GenesisNewsReel {
  videoUrl: string;
  r2Key: string;
  caption: string; // post caption + footage credits
  copy: ReelCopy;
  clips: FoundClip[];
  durationSec: number | null;
}

async function scraper<T>(route: string, body: unknown): Promise<T> {
  const url = process.env.SCRAPER_SERVICE_URL;
  const secret = process.env.SCRAPER_SERVICE_SECRET;
  if (!url || !secret) throw new Error("SCRAPER_SERVICE_URL / SCRAPER_SERVICE_SECRET not set");
  const res = await fetch(`${url}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-scraper-secret": secret },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`scraper ${route} ${res.status}: ${json.error ?? "unknown error"}`);
  return json;
}

function tidyTitle(t: string): string {
  const s = t.replace(/[^\p{L}\p{N}\s'!?,.&-]/gu, "").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fallbackCopy(story: string, clips: FoundClip[]): ReelCopy {
  const words = story.toUpperCase().split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  return {
    banner: [words.slice(0, mid).join(" "), words.slice(mid).join(" ") || "GENESIS NEWS"],
    captions: clips.map((c) => tidyTitle(c.title)),
    postCaption: `${story} ⚽ Follow Genesis News for more.`,
  };
}

/** Gemini writes copy that matches the actual clips. Never invents facts beyond story + clip titles. */
export async function writeReelCopy(story: string, summary: string | undefined, clips: FoundClip[]): Promise<ReelCopy> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallbackCopy(story, clips);
  const prompt = `You write on-screen text for "Genesis News", a South African soccer news Facebook page (Kaizer Chiefs / PSL / Bafana focus).
Story: ${story}
${summary ? `Details: ${summary}\n` : ""}Clips in order (title by creator):
${clips.map((c, i) => `${i + 1}. "${c.title}" by ${c.creator}`).join("\n")}

Rules: use ONLY facts in the story, details and clip titles. Do not invent quotes, scores, transfers or names.
Return JSON only:
{"banner": ["LINE 1 max 18 chars", "LINE 2 max 22 chars"],
 "captions": [one punchy caption per clip, max 60 chars, wrap 1-2 key words in *stars* for gold],
 "postCaption": "2-3 short lines for the Facebook post, 1-2 emojis, end with a question to drive comments, plus 3 hashtags"}`;
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<ReelCopy>;
    const fb = fallbackCopy(story, clips);
    const banner = (parsed.banner ?? []).map((s) => String(s).toUpperCase()).filter(Boolean);
    return {
      banner: [banner[0] ?? fb.banner[0], banner[1] ?? fb.banner[1]],
      captions: clips.map((_, i) => String(parsed.captions?.[i] ?? fb.captions[i])),
      postCaption: String(parsed.postCaption ?? fb.postCaption),
    };
  } catch (e) {
    console.warn("[genesis-news] Gemini copy failed, using clip titles:", (e as Error).message);
    return fallbackCopy(story, clips);
  }
}

export async function makeGenesisNewsReel(opts: {
  story: string;
  summary?: string;
  clips?: number;
  secondsPerClip?: number;
  musicUrl?: string; // licensed track only
  copy?: Partial<ReelCopy>; // override banner/captions/post caption
}): Promise<GenesisNewsReel> {
  const found = await scraper<{ jobId: string; clips: FoundClip[] }>("/genesis-reel/find", {
    story: opts.story,
    clips: opts.clips ?? 4,
  });
  if (!found.clips.length) throw new Error(`No Creative Commons clips found for "${opts.story}". Try a broader story title.`);

  const auto = await writeReelCopy(opts.story, opts.summary, found.clips);
  const copy: ReelCopy = {
    banner: (opts.copy?.banner as [string, string]) ?? auto.banner,
    captions: opts.copy?.captions ?? auto.captions,
    postCaption: opts.copy?.postCaption ?? auto.postCaption,
  };

  const r2Key = `genesis-news/${new Date().toISOString().slice(0, 10)}/${found.jobId}.mp4`;
  const rendered = await scraper<{ r2Key: string; credits: string; duration: number | null }>("/genesis-reel/render", {
    jobId: found.jobId,
    banner: copy.banner,
    clips: found.clips.map((c, i) => ({ id: c.id, caption: copy.captions[i] ?? "", seconds: opts.secondsPerClip ?? 7.5 })),
    outputR2Key: r2Key,
    music: opts.musicUrl,
  });

  const credits = rendered.credits.replace(/^Footage credits.*\n/, "").trim();
  return {
    videoUrl: r2PublicUrl(rendered.r2Key),
    r2Key: rendered.r2Key,
    caption: `${copy.postCaption}\n\n🎥 Footage credits:\n${credits}`,
    copy,
    clips: found.clips,
    durationSec: rendered.duration,
  };
}

/** Publish (or schedule, unix seconds) a finished reel on the Genesis News page. */
export async function publishGenesisNewsReel(reel: Pick<GenesisNewsReel, "videoUrl" | "caption">, scheduledAt?: number) {
  return publishReel({ pageKey: "genesis_news", videoUrl: reel.videoUrl, caption: reel.caption, scheduledAt });
}
