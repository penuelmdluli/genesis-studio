// ============================================
// GENESIS NEWS — edited soccer news reels from real (licensed) footage
// ============================================
// 1. Scraper /genesis-reel/find: YouTube Creative Commons clips for the story
// 2. Claude (local CLI) writes the banner, one caption per clip and the post caption
//    (falls back to tidied clip titles if the claude CLI is unavailable)
// 3. Scraper /genesis-reel/render: crops source branding off, reframes 9:16,
//    adds banner/captions/on-screen credits, uploads to R2. Started and then
//    polled — downloading and encoding four clips takes minutes, and the proxy
//    in front of the video service closes the request at 100 seconds.
// 4. Optional: publish to the Genesis News Facebook page with credits in the caption
//
// Env: SCRAPER_SERVICE_URL, SCRAPER_SERVICE_SECRET, (claude CLI on PATH),
//      FB_PAGE_TOKEN_genesis_news (scraper needs YOUTUBE_API_KEY)

import { r2PublicUrl } from "@/lib/storage";
import { publishReel } from "@/lib/facebook-reels";

/**
 * Copy is written by the local Claude Code CLI (`claude -p`), on the owner's
 * Claude subscription. This pipeline runs on the owner's PC next to the
 * genesis-scraper container, so no API key is needed. The prompt goes in on
 * stdin, so Windows never re-quotes it. Where the CLI does not exist (the
 * hosted Cloudflare app) this throws and the caller falls back to clip titles.
 */
async function askClaude(prompt: string): Promise<string> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json", "--model", process.env.GENESIS_NEWS_CLAUDE_MODEL || "sonnet"], {
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("claude CLI timed out after 120s")); }, 120_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exit ${code}: ${err.trim().slice(0, 300)}`));
      try {
        const envelope = JSON.parse(out) as { result?: string; is_error?: boolean };
        if (envelope.is_error || !envelope.result) return reject(new Error(`claude CLI error: ${String(envelope.result).slice(0, 300)}`));
        // The model sometimes wraps its JSON in prose or a fence; keep the object only.
        const m = envelope.result.match(/\{[\s\S]*\}/);
        if (!m) return reject(new Error("claude CLI returned no JSON object"));
        resolve(m[0]);
      } catch (e) {
        reject(e as Error);
      }
    });
    child.stdin.end(prompt);
  });
}

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

function service(): { url: string; secret: string } {
  const url = process.env.SCRAPER_SERVICE_URL;
  const secret = process.env.SCRAPER_SERVICE_SECRET;
  if (!url || !secret) throw new Error("SCRAPER_SERVICE_URL / SCRAPER_SERVICE_SECRET not set");
  return { url, secret };
}

async function scraper<T>(route: string, body: unknown): Promise<T> {
  const { url, secret } = service();
  const res = await fetch(`${url}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-scraper-secret": secret },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`scraper ${route} ${res.status}: ${json.error ?? "unknown error"}`);
  return json;
}

interface RenderJob {
  status: "running" | "done" | "error";
  r2Key?: string;
  credits?: string;
  duration?: number | null;
  error?: string;
}

/** Waits on a started render. Polls, because the render outlives its request. */
async function waitForRender(jobId: string, pollMs: number, timeoutMs: number): Promise<Required<Pick<RenderJob, "r2Key" | "credits">> & { duration: number | null }> {
  const { url, secret } = service();
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, pollMs));
    const res = await fetch(`${url}/genesis-reel/render/${jobId}`, { headers: { "x-scraper-secret": secret } });
    // The video service sleeps when idle and loses the jobs it was holding in
    // memory, so a job that has stopped existing is a dead wait, not a slow one.
    if (res.status === 404) throw new Error("the render was interrupted — start it again");
    if (!res.ok) throw new Error(`render status ${res.status}`);
    const job = (await res.json().catch(() => ({}))) as RenderJob;
    if (job.status === "done" && job.r2Key) {
      return { r2Key: job.r2Key, credits: job.credits ?? "", duration: job.duration ?? null };
    }
    if (job.status !== "running") throw new Error(job.error || "the render failed");
    if (Date.now() >= deadline) {
      throw new Error(`the render is still going after ${Math.round(timeoutMs / 60000)} minutes — check the video service`);
    }
  }
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

/** Claude writes copy that matches the actual clips. Never invents facts beyond story + clip titles. */
export async function writeReelCopy(story: string, summary: string | undefined, clips: FoundClip[]): Promise<ReelCopy> {
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
    const raw = await askClaude(prompt);
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<ReelCopy>;
    const fb = fallbackCopy(story, clips);
    const banner = (parsed.banner ?? []).map((s) => String(s).toUpperCase()).filter(Boolean);
    return {
      banner: [banner[0] ?? fb.banner[0], banner[1] ?? fb.banner[1]],
      captions: clips.map((_, i) => String(parsed.captions?.[i] ?? fb.captions[i])),
      postCaption: String(parsed.postCaption ?? fb.postCaption),
    };
  } catch (e) {
    console.warn("[genesis-news] Claude copy failed, using clip titles:", (e as Error).message);
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
  pollEveryMs?: number; // how often the render is checked on (default 6s)
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
  const started = await scraper<{ jobId: string }>("/genesis-reel/render", {
    jobId: found.jobId,
    banner: copy.banner,
    // Every clip carries its own title, creator and licence rather than just
    // an id. The video service sleeps between requests and loses what /find
    // left in memory, and it refuses to render footage it cannot credit.
    clips: found.clips.map((c, i) => ({
      ...c,
      caption: copy.captions[i] ?? "",
      seconds: opts.secondsPerClip ?? 7.5,
    })),
    outputR2Key: r2Key,
    music: opts.musicUrl,
  });
  if (!started.jobId) throw new Error("the video service did not start the render");
  const rendered = await waitForRender(started.jobId, opts.pollEveryMs ?? 6000, 12 * 60 * 1000);

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
