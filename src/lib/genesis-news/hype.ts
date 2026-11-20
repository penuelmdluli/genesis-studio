// ============================================
// GENESIS NEWS — hype reels (the format the owner signed off 2026-11-19)
// ============================================
// research → find → watch → plan → voice → render → package → (publish)
//
//  research  `claude` + WebSearch: today's facts for the story, with sources.
//            Nothing in the script is allowed that is not in these facts or
//            visible in the footage.
//  find      YouTube Creative Commons search on the video service.
//  watch     the service downloads whole clips into GENESIS_WORK_DIR (shared
//            with the container) and draws frame sheets stamped with seconds.
//  plan      `claude` + Read looks at every sheet and writes the edit: which
//            seconds, what the label/captions say about THAT moment, and a
//            commentary line per beat.
//  voice     local TTS (Kokoro offline by default, or edge-tts) — no paid API.
//  render    the service cuts, lays out, mixes the commentary over the
//            footage's own crowd, -11 LUFS, uploads to R2.
//  package   caption with credits + iVideo Studio call to action, a
//            marketing first comment.
//
// Runs on the owner's PC only: it needs the claude CLI, Python TTS and the
// local genesis-scraper container (SCRAPER_SERVICE_URL=http://localhost:3001).

import path from "node:path";
import fs from "node:fs";
import { claudeJson } from "./claude-cli";
import { pageProfile, type PageProfile } from "./pages";
import { scanRadar, radarBrief } from "./radar";
import { r2PublicUrl } from "@/lib/storage";
import { publishReel, pageToken } from "@/lib/facebook-reels";
import { postPageComment } from "@/lib/social/facebook-comments";

export type HypeFormat = "preview" | "news" | "countdown" | "throwback";

export interface HypeClip {
  id: string;
  title: string;
  creator: string;
  url: string;
  license: string;
  durationSec: number;
  hasAudio?: boolean;
  sheets?: string[];
  /** Overlay-free area (fractions), from scripts/genesis_overlay.py. */
  crop?: { x: number; y: number; w: number; h: number };
}

/**
 * The framing every shot of a clip gets: inside its overlay-free area, at
 * most 72% of the width (so the footage fills more of the vertical frame).
 * Mirrored in genesis-scraper/hype-reel.js — keep them the same.
 */
export function framing(c?: HypeClip["crop"]): { x: number; y: number; w: number; h: number } {
  const b = c ?? { x: 0.04, y: 0.07, w: 0.92, h: 0.86 };
  const w = Math.min(b.w, 0.72);
  return { x: b.x + (b.w - w) / 2, y: b.y, w, h: b.h };
}

const cropExpr = (c?: HypeClip["crop"]) => {
  const f = framing(c);
  return `crop=iw*${f.w.toFixed(3)}:ih*${f.h.toFixed(3)}:iw*${f.x.toFixed(3)}:ih*${f.y.toFixed(3)}`;
};

export interface HypeShot { clip: string; start: number; dur: number; cap1?: string; cap2?: string }
export interface HypeBeat { mode?: "hook" | "beat" | "end"; label: string; voice: string; shots: HypeShot[]; voiceFile?: string }
export interface HypePlan {
  title: string;
  beats: HypeBeat[];
  postCaption: string;
  hashtags: string[];
  /** What Claude saw, per clip — kept for review. */
  notes?: string;
  /** Up to 3 cover candidates: the most striking frames + 2-4 words each. */
  thumbs?: { clip: string; t: number; text: string }[];
}

export interface Research {
  headline: string;
  facts: { fact: string; source: string }[];
  fixture?: { home: string; away: string; date?: string; time?: string; venue?: string; competition?: string } | null;
  youtubeQueries: string[];
}

export interface HypeReel {
  format: HypeFormat;
  topic: string;
  videoUrl: string;
  r2Key: string;
  caption: string;
  firstComment: string;
  plan: HypePlan;
  page: string;
  research: Research | null;
  clips: HypeClip[];
  durationSec: number;
  /** The chosen cover (Facebook reel cover + YouTube thumbnail). */
  thumbUrl?: string;
  /** Same cover on this PC, relative to the work dir. */
  thumbFile?: string;
}

// ─── plumbing ───────────────────────────────────────────────

function workDir(): string {
  const dir = process.env.GENESIS_WORK_DIR;
  if (!dir) throw new Error("GENESIS_WORK_DIR not set (the folder mounted into genesis-scraper as /work)");
  return dir;
}

// ─── footage bank ───────────────────────────────────────────
// reels/footage-bank-<page>.json: every clip used in a POSTED reel (it passed
// smart crop, the frame check and the licence check). Reused as archive
// footage for stories whose own search comes back thin, at most once every
// 2 days per clip so the page does not loop the same goal.

type BankClip = HypeClip & { lastUsed?: string };
const bankFile = (page: string) => path.join(workDir(), "reels", `footage-bank-${page}.json`);

function readBank(page: string): Record<string, BankClip> {
  try {
    return JSON.parse(fs.readFileSync(bankFile(page), "utf8"));
  } catch {
    return {};
  }
}

/** Remember the clips a posted reel used (call after publishing). */
export function addToBank(page: string, clips: HypeClip[]) {
  const bank = readBank(page);
  const now = new Date().toISOString();
  for (const c of clips) bank[c.id] = { ...c, sheets: undefined, lastUsed: now };
  fs.mkdirSync(path.dirname(bankFile(page)), { recursive: true });
  fs.writeFileSync(bankFile(page), JSON.stringify(bank, null, 1));
}

const STOP = new Set("the and for with from that this into over after before their about week weeks today frame story news vs v".split(" "));
function bankClipsFor(page: string, about: string, exclude: string[], max: number): HypeClip[] {
  const words = [...new Set(about.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [])].filter((w) => !STOP.has(w));
  const blocked = new Set([...exclude, ...readBlocklist()]);
  const fresh = Date.now() - 2 * 86_400_000;
  return Object.values(readBank(page))
    .filter((c) => !blocked.has(c.id) && (!c.lastUsed || Date.parse(c.lastUsed) < fresh))
    .map((c) => ({ c, score: words.filter((w) => c.title.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ c }) => {
      const { lastUsed: _l, ...clip } = c;
      return clip;
    });
}

async function service<T>(route: string, body?: unknown): Promise<T> {
  const url = process.env.SCRAPER_SERVICE_URL;
  const secret = process.env.SCRAPER_SERVICE_SECRET;
  if (!url || !secret) throw new Error("SCRAPER_SERVICE_URL / SCRAPER_SERVICE_SECRET not set");
  const res = await fetch(`${url}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-scraper-secret": secret },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`video service ${route} ${res.status}: ${json.error || "unknown error"}`);
  return json;
}

async function waitJob<T>(jobId: string, timeoutMs: number, log: (s: string) => void): Promise<T> {
  const until = Date.now() + timeoutMs;
  let lastStep = "";
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 4000));
    const j = await service<{ status: string; step?: string; error?: string; result?: T }>(`/hype/job/${jobId}`);
    if (j.step && j.step !== lastStep) log(`  … ${j.step}`);
    lastStep = j.step || lastStep;
    if (j.status === "done" && j.result) return j.result;
    if (j.status === "error") throw new Error(j.error || "video service job failed");
  }
  throw new Error(`video service job ${jobId} timed out`);
}

// ─── 1. research ────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

export async function research(format: HypeFormat, topic: string, page: PageProfile = pageProfile("genesis_news")): Promise<Research> {
  const prompt = `You are the research desk for ${page.desk}.
Today is ${today()}. Story: "${topic}". Reel type: ${format}.

Use web search to establish what is TRUE and CURRENT about this story. ${format === "preview" ? "Find the fixture: teams, date, kick-off time (SAST), venue, competition, and each side's recent form or league position." : ""}
Only keep facts you found on a reputable source (${page.sources}). No rumours presented as fact.

Then write 3 YouTube search queries likely to find Creative Commons FOOTAGE for this story (${page.footageHint}). Short, like a person would type.

Reply with ONLY this JSON:
{"headline": "max 60 chars", "facts": [{"fact": "...", "source": "url"}], "fixture": {"home": "", "away": "", "date": "", "time": "", "venue": "", "competition": ""} or null, "youtubeQueries": ["", "", ""]}`;
  const r = await claudeJson<Research>(prompt, { tools: ["WebSearch", "WebFetch"], timeoutMs: 6 * 60_000 });
  return {
    headline: String(r.headline || topic).slice(0, 80),
    facts: (r.facts || []).filter((f) => f?.fact).slice(0, 10),
    fixture: r.fixture?.home ? r.fixture : null,
    youtubeQueries: (r.youtubeQueries || []).filter(Boolean).slice(0, 3),
  };
}

// ─── 0. decide what to make ─────────────────────────────────

export interface TopicPick { format: HypeFormat; topic: string; why: string; queries?: string[] }

/**
 * The editor's morning call: what is the ONE reel worth making right now?
 * Big fixture within 3 days → preview; a real story today → news; a quiet
 * day → countdown/throwback. `recent` keeps it from repeating itself.
 */
export async function pickTopic(
  recent: { format: string; topic: string; at: string }[],
  page: PageProfile = pageProfile("genesis_news"),
  opts: {
    /** Topics this slot already tried and could not make into a clean reel. */
    failed?: { topic: string; why: string }[];
    /** The overnight spare: a timeless countdown/throwback, no news. */
    evergreen?: boolean;
  } = {}
): Promise<TopicPick> {
  // What SA is searching/watching/reading right now; a dead radar never
  // blocks the pick. The spare reel ignores it: it must still be good in a week.
  const radar = opts.evergreen ? "" : await scanRadar(page).then(radarBrief).catch(() => "");
  const failed = opts.failed?.length
    ? `\nAlready tried in this slot and FAILED (not enough clean, matching footage) — pick something clearly different, with plenty of footage on YouTube:\n${opts.failed.map((f) => `- ${f.topic} (${f.why})`).join("\n")}\n`
    : "";
  const steer = opts.evergreen
    ? `This is the SPARE reel, kept in reserve for a slot whose story falls through. It must be EVERGREEN: format "countdown" or "throwback", a timeless topic with lots of clean footage on YouTube, nothing dated or tied to this week's news.`
    : `When a radar item fits this page's audience and has real footage behind it, prefer it over an evergreen topic — that is what gets shared today.`;
  const prompt = `${page.picker}
Today is ${today()}.

${radar}

${steer}
${failed}
Recently made (do NOT repeat the same topic within 3 days; vary the format):
${recent.slice(-10).map((r) => `- ${r.at.slice(0, 10)} ${r.format}: ${r.topic}`).join("\n") || "- nothing yet"}

Reply with ONLY JSON: {"format": "preview"|"news"|"countdown"|"throwback", "topic": "one line a researcher can act on", "why": "one sentence", "queries": ["optional YouTube searches for footage"]}`;
  const p = await claudeJson<TopicPick>(prompt, { tools: ["WebSearch", "WebFetch"], timeoutMs: 6 * 60_000 });
  const allowed = opts.evergreen ? (["countdown", "throwback"] as const) : (["preview", "news", "countdown", "throwback"] as const);
  const format = (allowed as readonly string[]).includes(p.format) ? p.format : "countdown";
  return { format, topic: String(p.topic || page.fallbackTopic), why: String(p.why || ""), queries: p.queries?.filter(Boolean) };
}

// ─── 2. find + 3. watch ─────────────────────────────────────

export async function findClips(
  queries: string[],
  want: number,
  opts: { avoid?: string[]; newest?: boolean; publishedAfter?: string } = {}
): Promise<HypeClip[]> {
  const avoid = new Set(opts.avoid || []);
  const seen = new Map<string, HypeClip>();
  for (const q of queries) {
    const r = await service<{ clips: HypeClip[] }>("/genesis-reel/find", {
      story: q, clips: 6, order: opts.newest ? "date" : "relevance", publishedAfter: opts.publishedAfter,
    });
    // Footage used in a recent reel is skipped so the page never looks like
    // the same clip on loop.
    for (const c of r.clips || []) {
      // "6 Big Chances Missed by Kaizer Chiefs" came back for "Chiefs best
      // goals" and became half a reel of misses. Titles that announce the
      // opposite of a highlight, or a talking-head show, are skipped.
      if (/\b(miss(ed|es)?|fails?|bloopers?|reaction|react|podcast|interview|press conference|live stream|is live|preview show|prediction)\b/i.test(c.title)) continue;
      if (!seen.has(c.id) && !avoid.has(c.id)) seen.set(c.id, c);
    }
  }
  // Compilations and highlights (2-12 min) give the most moments per download.
  return [...seen.values()]
    .sort((a, b) => Number(b.durationSec >= 90 && b.durationSec <= 720) - Number(a.durationSec >= 90 && a.durationSec <= 720))
    .slice(0, want);
}

/**
 * Clips named directly (--clips): title, creator and length from YouTube,
 * and the same Creative Commons check the search applies — a named clip is
 * not exempt from the licence.
 */
async function namedClips(ids: string[]): Promise<HypeClip[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set (needed to look up named clips)");
  const j = (await (await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "snippet,contentDetails,status", id: ids.join(","), key })}`)).json()) as {
    items?: { id: string; snippet: { title: string; channelTitle: string }; contentDetails: { duration: string }; status: { license: string } }[];
  };
  const secs = (d: string) => {
    const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(d) || [];
    return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  };
  return (j.items || [])
    .filter((v) => v.status.license === "creativeCommon")
    .map((v) => ({ id: v.id, title: v.snippet.title, creator: v.snippet.channelTitle, url: `https://www.youtube.com/watch?v=${v.id}`, license: "CC BY 3.0", durationSec: secs(v.contentDetails.duration) }));
}

export async function prepareClips(clips: HypeClip[], log: (s: string) => void): Promise<HypeClip[]> {
  const { jobId } = await service<{ jobId: string }>("/hype/prepare", { clips });
  const r = await waitJob<{ ready: HypeClip[]; failed: { id: string; error: string }[] }>(jobId, 30 * 60_000, log);
  for (const f of r.failed) log(`  skipped ${f.id}: ${f.error}`);
  return r.ready.map((c) => ({ ...c, ...clips.find((x) => x.id === c.id), durationSec: c.durationSec, hasAudio: c.hasAudio, sheets: c.sheets }));
}

// ─── 4. plan ────────────────────────────────────────────────

const FORMAT_GUIDE: Record<HypeFormat, string> = {
  preview: `MATCH HYPE / PREVIEW. Sell the upcoming game so fans cannot wait.
- Hook: the fixture and when ("SUNDOWNS v CHIEFS — SATURDAY").
- 3-4 beats of the best archive moments between/for these teams (goals, saves, celebrations, fans). Label them as memories ("LAST TIME…", "REMEMBER THIS?") — never imply archive footage is from the coming match.
- A beat with the fixture facts (date, kick-off, venue) over strong footage.
- End card: "WHO WINS?" + "Comment your score".`,
  news: `NEWS FLASH. Tell the story fast and hyped.
- Hook: the headline in 3-5 words.
- 2-4 beats, one researched fact each, over footage of the team/player involved. Captions carry the fact; the footage illustrates it (never claim archive footage is from this week).
- End card: a question that splits opinion.`,
  countdown: `COUNTDOWN ("4 DERBY SCREAMERS"). The format that worked best.
- Hook (2.5-3.5s): the best moment teased + "Wait for number 1…".
- 3-5 numbered beats, worst to best: label "#4  41.5M ROCKET" style; each beat = build-up shot, the moment (ball going in), replay or reaction, celebration/fans.
- End card: "WHICH WAS THE BEST?" + "Comment 1, 2, 3 or 4".`,
  throwback: `THROWBACK / MEMORY. One great match or moment told as a story.
- Hook: why it matters ("THE DAY THE BUCS …" — only if the footage or facts show it).
- 3-4 beats in story order: setup, the moment, the reaction, the legacy.
- End card: "WHERE WERE YOU?" + "Tell us in the comments".`,
};

export async function planReel(format: HypeFormat, topic: string, facts: Research | null, clips: HypeClip[], redo?: string, page: PageProfile = pageProfile("genesis_news")): Promise<HypePlan> {
  const clipList = clips
    .map((c) => `- clip "${c.id}": "${c.title}" by ${c.creator}, ${Math.round(c.durationSec)}s. Sheets: ${(c.sheets || []).join(", ")}`)
    .join("\n");
  const prompt = `You are the editor of "${page.name}" (${page.desk}). Make a reel that TRENDS: hyped, fast, every word true.

Story: "${topic}"   Today: ${today()}
${facts ? `Researched facts (the ONLY facts you may state beyond what is visible):\n${facts.facts.map((f) => `- ${f.fact}`).join("\n")}${facts.fixture ? `\nFixture: ${JSON.stringify(facts.fixture)}` : ""}` : "No research: state only what the footage itself shows (on-screen graphics, names on shirts, scoreboards)."}

FORMAT: ${FORMAT_GUIDE[format]}${page.editNotes ? `\n${page.editNotes}` : ""}

FOOTAGE. Each sheet is a grid of frames, one every 2 seconds, stamped with the SECOND it was taken (top-left). Read EVERY sheet with the Read tool before planning:
${clipList}

Rules for shots:
- Use only real footage of the subject. Skip title cards, "NUMBER" cards, black or faded frames, transitions, other channels' intro/outro graphics, and tiny boxed-in footage.
- Channel graphics at the EDGES of a clip (subscribe buttons, bells, banners, logos, score bugs) are cropped away automatically — use the clean footage underneath. Only avoid a clip whose overlays sit over the MIDDLE of the action (a presenter's face-cam over the pitch).
- A shot is 1.5–5 seconds; start at a stamped second (the moment can be up to 2s either side). Never run past the clip's length.
- The key moment (the goal, the jump, the reveal) must be INSIDE a shot. Use different angles/replays when the sheet shows them.
- Total 30–60 seconds. Hook ≤ 3.5s. End card: one shot ≤ 3s of fans/celebration.

Rules for text:
- title: ≤ 22 chars, upper case, the reel's name ("SOWETO DERBY SCREAMERS").
- label: ≤ 20 chars, upper case. cap1/cap2: ≤ 26 chars each; cap2 is the punchline (shown in gold). Captions describe what is on screen IN THAT SHOT.
- Names: only if on a shirt, an on-screen graphic, or in the facts. Otherwise "the No.45", "the Chiefs skipper" etc. Never invent scores, dates or quotes.
- voice: what the narrator — ${page.narrator} — says over the WHOLE beat. Plain words (no [tags], no emojis, no ALL CAPS), short punchy phrases with "!" and "…". About 2.5 words per second of the beat.
- postCaption: 2-4 short lines for Facebook, 1-3 emojis, ends with a question that gets comments. hashtags: 4-6.
- thumbs: 3 cover candidates, each a DIFFERENT moment — the frames that would stop a thumb mid-scroll: peak action (the ball hitting the net, the leap, the face), sharp and well lit, the subject big in frame; never a blur, a transition, a crowd wide shot or a graphic. "t" is the exact second (from the sheet stamps). "text": 2-4 punchy words that make people NEED to watch ("WAIT FOR #1", "ROCKET FROM 35M", "HE DID WHAT?!") — curiosity, not a summary; true to the footage.

${redo ? `THIS IS A REDO. A frame-by-frame check of your last edit found:\n${redo}\nFix every point.\n\n` : ""}Reply with ONLY this JSON (no prose):
{"title": "", "notes": "one line per clip: what you saw and where",
 "beats": [{"mode": "hook"|"beat"|"end", "label": "", "voice": "", "shots": [{"clip": "<id>", "start": 0, "dur": 0, "cap1": "", "cap2": ""}]}],
 "postCaption": "", "hashtags": ["#..."],
 "thumbs": [{"clip": "<id>", "t": 0, "text": ""}, {"clip": "<id>", "t": 0, "text": ""}, {"clip": "<id>", "t": 0, "text": ""}]}

If the footage cannot honestly carry this topic (wrong players, wrong sport, nothing that shows what the topic promises), do NOT invent a reel and do NOT explain in prose — reply with ONLY:
{"unusable": "one line: what the clips actually show and why it does not fit"}`;
  const plan = await claudeJson<HypePlan & { unusable?: string }>(prompt, { tools: ["Read"], cwd: workDir(), timeoutMs: 15 * 60_000 });
  // An honest "this footage does not fit" ends the attempt with a reason the
  // slot can act on (pick a different story) instead of a JSON parse crash.
  if (plan.unusable) throw new Error(`footage does not fit the story: ${String(plan.unusable).slice(0, 200)}`);
  return validatePlan(plan, clips);
}

// ─── 3b. smart crop + blocklist ─────────────────────────────
//
// Most Creative Commons football on YouTube comes from fan channels that
// paint subscribe buttons, bells, banners and logos over the picture. Their
// edges never move while the match does, so genesis_overlay.py finds them
// and returns the clean area; every shot of that clip is cropped to it. A
// clip whose overlay sits over the middle (a face-cam) cannot be cropped
// clean: it goes on a permanent blocklist and is never downloaded again.

const BLOCKLIST = () => path.join(workDir(), "reels", "blocklist.json");

export function readBlocklist(): string[] {
  try {
    return Object.keys(JSON.parse(fs.readFileSync(BLOCKLIST(), "utf8")));
  } catch {
    return [];
  }
}

export function addToBlocklist(ids: string[], why: string) {
  if (!ids.length) return;
  let list: Record<string, { why: string; at: string }> = {};
  try {
    list = JSON.parse(fs.readFileSync(BLOCKLIST(), "utf8"));
  } catch {}
  for (const id of ids) list[id] = { why, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(BLOCKLIST()), { recursive: true });
  fs.writeFileSync(BLOCKLIST(), JSON.stringify(list, null, 1));
}

async function smartCrop(clips: HypeClip[], log: (s: string) => void): Promise<HypeClip[]> {
  const { execFile } = await import("node:child_process");
  const script = path.join(process.cwd(), "scripts", "genesis_overlay.py");
  const kept: HypeClip[] = [];
  const rejected: string[] = [];
  // Measured in parallel; results are put back in the original clip order.
  await Promise.all(clips.map(async (c) => {
    try {
      const out = await new Promise<string>((resolve, reject) =>
        execFile(process.env.GENESIS_PYTHON || "python", [script, path.join(workDir(), "src", `${c.id}.mp4`)], { timeout: 5 * 60_000 },
          (err, stdout) => (err ? reject(err) : resolve(String(stdout))))
      );
      const r = JSON.parse(out.trim().split("\n").pop() || "{}") as { x: number; y: number; w: number; h: number; usable: boolean; blobs: number };
      if (!r.usable) {
        rejected.push(c.id);
        log(`  smart crop: ${c.id} has overlays over the middle of the picture — rejected`);
        return;
      }
      const full = r.w >= 0.99 && r.h >= 0.99;
      kept.push({ ...c, crop: full ? undefined : { x: r.x, y: r.y, w: r.w, h: r.h } });
      log(`  smart crop: ${c.id} ${full ? "clean, no crop" : `keep ${Math.round(r.w * 100)}%×${Math.round(r.h * 100)}% (${r.blobs} overlay(s) cut)`}`);
    } catch (e) {
      kept.push(c); // a failed measurement never loses a clip; the model check still runs
      log(`  smart crop: ${c.id} not measured (${(e as Error).message.slice(0, 60)})`);
    }
  }));
  kept.sort((a, b) => clips.indexOf(clips.find((x) => x.id === a.id)!) - clips.indexOf(clips.find((x) => x.id === b.id)!));
  addToBlocklist(rejected, "overlays over the middle of the picture (smart crop)");
  return kept;
}

// ─── 4a. measured checks ────────────────────────────────────
//
// Black frames and freeze-frames are facts ffmpeg can measure; they should
// never depend on a model noticing them in a contact sheet.

async function deadShare(clip: string, start: number, dur: number): Promise<number> {
  const { execFile } = await import("node:child_process");
  const src = path.join(workDir(), "src", `${clip}.mp4`);
  const stderr = await new Promise<string>((resolve) =>
    execFile("ffmpeg", ["-v", "info", "-ss", start.toFixed(2), "-t", dur.toFixed(2), "-i", src, "-an",
      "-vf", "scale=320:-2,blackdetect=d=0.3:pix_th=0.12,freezedetect=n=0.004:d=0.8", "-f", "null", "-"],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }, (_e, _o, err) => resolve(String(err))));
  let dead = 0;
  for (const m of stderr.matchAll(/black_duration:([\d.]+)/g)) dead += parseFloat(m[1]);
  for (const m of stderr.matchAll(/freeze_duration: ?([\d.]+)/g)) dead += parseFloat(m[1]);
  // A freeze still running at the end of the window has no duration line.
  const lastStart = [...stderr.matchAll(/freeze_start: ?([\d.]+)/g)].length > [...stderr.matchAll(/freeze_end/g)].length
    ? parseFloat([...stderr.matchAll(/freeze_start: ?([\d.]+)/g)].at(-1)![1]) : null;
  if (lastStart !== null) dead += Math.max(0, dur - lastStart);
  return Math.min(1, dead / dur);
}

/** Drop shots that are mostly black or frozen. Returns how many went. */
export async function dropDeadShots(plan: HypePlan): Promise<{ plan: HypePlan; dropped: number }> {
  let dropped = 0;
  const beats: HypeBeat[] = [];
  for (const b of plan.beats) {
    const shots: HypeShot[] = [];
    for (const sh of b.shots) {
      if ((await deadShare(sh.clip, sh.start, sh.dur)) > 0.4) dropped++;
      else shots.push(sh);
    }
    if (shots.length) beats.push({ ...b, shots });
  }
  return { plan: { ...plan, beats }, dropped };
}

// ─── 4b. quality control ────────────────────────────────────
//
// The plan is written from frames 2 seconds apart, and the first automatic
// reel showed what that misses: a "REPLAY ANGLE" caption over the subs'
// bench, a "BOX ERUPTS" shot that was the source's title card, and a whole
// clip under a subscribe button and a face-cam. So every shot is pulled at
// its start, middle and end and checked against its own caption before a
// second of it is rendered.

interface ShotVerdict { beat: number; shot: number; verdict: "ok" | "drop" | "recaption"; cap1?: string; cap2?: string; reason?: string }
interface BeatVoice { beat: number; voice: string }
interface CheckResult { shots: ShotVerdict[]; dirtyClips: string[]; voices: BeatVoice[]; summary: string }

async function shotStrips(plan: HypePlan, key: string, clips: HypeClip[] = []): Promise<string[]> {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const { execFile } = await import("node:child_process");
  const rel = path.posix.join("checks", key);
  fs.mkdirSync(path.join(workDir(), rel), { recursive: true });
  const out: string[] = [];
  for (let b = 0; b < plan.beats.length; b++) {
    for (let s = 0; s < plan.beats[b].shots.length; s++) {
      const shot = plan.beats[b].shots[s];
      const src = path.join(workDir(), "src", `${shot.clip}.mp4`);
      const ts = [shot.start + 0.2, shot.start + shot.dur / 2, shot.start + shot.dur - 0.2].map((t) => t.toFixed(2));
      const file = `${rel}/b${b}s${s}.png`;
      await new Promise<void>((resolve, reject) =>
        execFile("ffmpeg", ["-v", "error", "-y", ...ts.flatMap((t) => ["-ss", t, "-i", src]),
          "-filter_complex", ((cr) => `[0:v]${cr},scale=-2:300[a];[1:v]${cr},scale=-2:300[b];[2:v]${cr},scale=-2:300[c];[a][b][c]hstack=3`)(cropExpr(byId.get(shot.clip)?.crop)),
          "-frames:v", "1", path.join(workDir(), file)], { timeout: 60_000 }, (err) => (err ? reject(err) : resolve()))
      );
      out.push(file);
    }
  }
  return out;
}

export async function checkPlan(plan: HypePlan, key: string, facts: Research | null, page: PageProfile = pageProfile("genesis_news"), clips: HypeClip[] = []): Promise<CheckResult> {
  const strips = await shotStrips(plan, key, clips);
  let i = 0;
  const list = plan.beats.flatMap((b, bi) =>
    b.shots.map((s, si) => `- beat ${bi} shot ${si} [${b.mode || "beat"} "${b.label}"] clip ${s.clip} @${s.start.toFixed(1)}s: caption "${s.cap1 || ""}" / "${s.cap2 || ""}" — image ${strips[i++]}`)
  );
  const voices = plan.beats.map((b, bi) => `- beat ${bi} "${b.label}": "${b.voice}"`).join("\n");
  const prompt = `You are the quality controller for "${page.name}" reels. Each image shows ONE planned shot: its first, middle and last frame side by side, ALREADY CROPPED to the framing that will air (channel graphics at the edges have been cut away). Read EVERY image with the Read tool, then judge each shot.

${list.join("\n")}

Commentary planned per beat (spoken over that beat's shots):
${voices}
${facts ? `\nResearched facts the commentary may also state:\n${facts.facts.map((f) => `- ${f.fact}`).join("\n")}\n` : ""}
For each shot:
- "ok": real footage of the subject (action, replay, people, animals, places, crowds), and the caption is a fair description of what these frames show.
- "recaption": good footage but the caption claims something not shown (e.g. "ball in the net" over open play). Give a new cap1/cap2 (<= 26 chars each, upper case) that is true for these frames.
- "drop": a title card, "NUMBER" card, black/blank/faded frame, transition, an intro/outro graphic, or footage mostly covered by overlays.
Also list in dirtyClips every clip id whose cropped frames STILL carry permanent overlays over the picture (subscribe buttons, presenter face-cams, big channel logos) — those clips must not be used at all. Small corner bugs and score bars are fine.

Then the COMMENTARY. For EVERY beat, return the line to be spoken over the shots you kept for that beat. Keep the planned line if every claim in it is either visible in those frames or in the researched facts. Otherwise rewrite it: same narrator (${page.narrator}) and about the same length, but it may only describe what the kept frames actually show (a scramble is a scramble, not a header; a bench celebrating is not a 41-metre strike) or state researched facts. Plain words, no [tags], no ALL CAPS.

Reply with ONLY JSON: {"shots": [{"beat": 0, "shot": 0, "verdict": "ok"|"drop"|"recaption", "cap1": "", "cap2": "", "reason": ""}], "dirtyClips": [], "voices": [{"beat": 0, "voice": ""}], "summary": "one line"}`;
  const r = await claudeJson<CheckResult>(prompt, { tools: ["Read"], cwd: workDir(), timeoutMs: 10 * 60_000 });
  return { shots: r.shots || [], dirtyClips: r.dirtyClips || [], voices: r.voices || [], summary: r.summary || "" };
}

/** Apply a check: drop bad shots and dirty clips, rewrite wrong captions and commentary. */
export function applyCheck(plan: HypePlan, check: CheckResult): HypePlan {
  const dirty = new Set(check.dirtyClips);
  const v = new Map(check.shots.map((x) => [`${x.beat}:${x.shot}`, x]));
  const vo = new Map(check.voices.filter((x) => x.voice?.trim()).map((x) => [x.beat, x.voice.trim()]));
  const beats = plan.beats
    .map((b, bi) => ({
      ...b,
      voice: vo.get(bi) ?? b.voice,
      shots: b.shots
        .map((s, si) => ({ s, x: v.get(`${bi}:${si}`) }))
        .filter(({ s, x }) => !dirty.has(s.clip) && x?.verdict !== "drop")
        .map(({ s, x }) => (x?.verdict === "recaption" ? { ...s, cap1: x.cap1 || s.cap1, cap2: x.cap2 || s.cap2 } : s)),
    }))
    .filter((b) => b.shots.length);
  return { ...plan, beats };
}

/**
 * Every reel sells the tool that made it: a closing card over the last
 * (dimmed) shot, spoken by the same commentator. "eye-video" is spelled for
 * the local TTS, which reads "iVideo" as "ih-video".
 */
export function withOutro(plan: HypePlan): HypePlan {
  const last = plan.beats[plan.beats.length - 1]?.shots.at(-1);
  if (!last || process.env.GENESIS_OUTRO === "off") return plan;
  return {
    ...plan,
    beats: [
      ...plan.beats,
      {
        mode: "end",
        label: "MADE WITH AI",
        voice: "Made with eye-video studio. Try it free!",
        shots: [{ clip: last.clip, start: last.start, dur: 1.5, cap1: "iVIDEO STUDIO", cap2: "FREE AT IVIDEOSTUDIO.AI" }],
      },
    ],
  };
}

const footageSecs = (p: HypePlan) => p.beats.reduce((t, b) => t + b.shots.reduce((x, y) => x + y.dur, 0), 0);

/** Clamp every shot into its clip, drop what cannot be rendered, cap at 85s (Facebook rejects >90s). */
export function validatePlan(plan: HypePlan, clips: HypeClip[]): HypePlan {
  const byId = new Map(clips.map((c) => [c.id, c]));
  let budget = 85;
  const used: { clip: string; start: number }[] = [];
  const beats: HypeBeat[] = [];
  for (const b of plan.beats || []) {
    const shots: HypeShot[] = [];
    for (const s of b.shots || []) {
      const c = byId.get(s.clip);
      if (!c) continue;
      const dur = Math.min(Math.max(Number(s.dur) || 2.5, 1), 6);
      const asked = Math.max(Number(s.start) || 0, 0);
      // A shot asked for past the end of its clip is a misread sheet, not a
      // near miss. Clamping it used to pile every such shot onto the clip's
      // last seconds (the Chiefs draft: 11 copies of the closing fans shot
      // and a fade to black). Drop it instead; small overruns still clamp.
      if (asked > c.durationSec - 1) continue;
      const start = Math.min(asked, Math.max(0, c.durationSec - dur - 0.3));
      if (dur > budget) break;
      // One clip moment, once: the Chiefs draft used the same fans still for
      // 25 seconds under three different captions.
      if (used.some((u) => u.clip === c.id && Math.abs(u.start - start) < 2.5)) continue;
      used.push({ clip: c.id, start });
      budget -= dur;
      shots.push({ clip: c.id, start, dur, cap1: String(s.cap1 || "").slice(0, 32), cap2: String(s.cap2 || "").slice(0, 32) });
    }
    if (shots.length) beats.push({ mode: b.mode, label: String(b.label || "").slice(0, 24), voice: String(b.voice || ""), shots });
  }
  if (!beats.length) throw new Error("the edit plan had no usable shots");
  return { ...plan, title: String(plan.title || "GENESIS NEWS").toUpperCase().slice(0, 26), beats };
}

// ─── 5. voice (local) ───────────────────────────────────────

export async function voiceBeats(plan: HypePlan, jobKey: string, page: PageProfile = pageProfile("genesis_news")): Promise<void> {
  const { execFile } = await import("node:child_process");
  // Each page has its own narrator; GENESIS_TTS_* only override Genesis News.
  const own = page.key === "genesis_news";
  const engine = (own && process.env.GENESIS_TTS_ENGINE) || page.tts.engine;
  const voice = (own && process.env.GENESIS_TTS_VOICE) || page.tts.voice;
  const speed = (own && process.env.GENESIS_TTS_SPEED) || page.tts.speed;
  const rel = path.posix.join("voices", jobKey);
  fs.mkdirSync(path.join(workDir(), rel), { recursive: true });
  const script = path.join(process.cwd(), "scripts", "genesis_tts.py");
  // One Python process for every line: Kokoro loads its model once (~40s)
  // instead of once per beat.
  const lines = plan.beats
    .map((beat, i) => ({ beat, i }))
    .filter(({ beat }) => beat.voice.trim())
    .map(({ beat, i }) => {
      beat.voiceFile = `${rel}/b${i}.${engine === "edge" ? "mp3" : "wav"}`;
      return { out: path.join(workDir(), beat.voiceFile), text: beat.voice };
    });
  const jobFile = path.join(workDir(), rel, "tts.json");
  fs.writeFileSync(jobFile, JSON.stringify({ engine, voice, speed, lines }));
  // The last stderr line used to be the whole error — on 2026-11-20 that was
  // a harmless torch WeightNorm warning, hiding the real failure. Report a
  // timeout as a timeout, else the last line that looks like an error; and
  // give the batch one more go before the attempt is lost.
  const once = () =>
    new Promise<void>((resolve, reject) =>
      execFile(process.env.GENESIS_PYTHON || "python", [script, "--batch", jobFile], { timeout: 20 * 60_000 }, (err, _out, stderr) => {
        if (!err) return resolve();
        if ((err as { killed?: boolean }).killed) return reject(new Error("TTS: timed out after 20 min"));
        const lines = String(stderr).trim().split("\n").map((l) => l.trim()).filter(Boolean);
        const real = [...lines].reverse().find((l) => /error|exception|traceback|failed|not found|denied/i.test(l) && !/warn/i.test(l));
        reject(new Error(`TTS: ${(real || lines.pop() || String(err.message)).slice(0, 200)}`));
      })
    );
  try {
    await once();
  } catch (e) {
    console.log(`[genesis-hype]   ${(e as Error).message} — retrying the voices once`);
    await once();
  }
}

// ─── 7. package ─────────────────────────────────────────────

const IVIDEO_CTA = "🎬 Edited with AI on iVideo Studio — make your own videos FREE at ivideostudio.ai";
const FIRST_COMMENTS = [
  "Want hype reels like this for YOUR page? 🎬 We make them with iVideo Studio — start FREE 👉 https://ivideostudio.ai",
  "This reel was edited with AI 🤖🎬 Make yours in minutes, free to start 👉 https://ivideostudio.ai",
  "Content creators 👀 Turn any clip into a hype edit with iVideo Studio — try it FREE 👉 https://ivideostudio.ai",
];

/**
 * Owner's rule (2026-11-19): the caption is our caption, our hashtags and the
 * iVideo Studio line — nothing about how the reel was made. Footage gets one
 * short credit line: the creator's name and the licence, which is what CC BY
 * asks for (the on-screen credit carries it too).
 */
export function packageCaption(plan: HypePlan, clips: HypeClip[], _format: HypeFormat): { caption: string; firstComment: string } {
  const used = new Set(plan.beats.flatMap((b) => b.shots.map((s) => s.clip)));
  const creators = [...new Set(clips.filter((c) => used.has(c.id)).map((c) => c.creator).filter(Boolean))];
  const caption = [
    plan.postCaption.trim(),
    IVIDEO_CTA,
    plan.hashtags.join(" "),
    creators.length ? `🎥 Credit: ${creators.join(", ")} (CC BY)` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const firstComment = FIRST_COMMENTS[Math.floor(Date.now() / 86_400_000) % FIRST_COMMENTS.length];
  return { caption, firstComment };
}

// ─── the whole thing ────────────────────────────────────────

export async function makeHypeReel(opts: {
  format: HypeFormat;
  topic: string;
  /** Skip research and search these directly (countdowns/throwbacks of a known video). */
  queries?: string[];
  /** Use exactly these YouTube ids (must be Creative Commons). */
  clipIds?: string[];
  maxClips?: number;
  /** YouTube ids used in recent reels — never reused. */
  avoidClipIds?: string[];
  /** Newest uploads first (news, previews, "latest" highlights). */
  newest?: boolean;
  /** Page profile key (pages.ts). Default genesis_news. */
  page?: string;
  log?: (s: string) => void;
}): Promise<HypeReel> {
  // Every line carries minutes:seconds since the start, so slow steps show.
  const t0 = Date.now();
  const stamp = () => { const s = Math.round((Date.now() - t0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const baseLog = opts.log ?? ((s: string) => console.log(`[genesis-hype] ${s}`));
  const log = (s: string) => baseLog(`[${stamp()}] ${s}`);
  const jobKey = `gh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const page = pageProfile(opts.page || "genesis_news");

  let facts: Research | null = null;
  if (opts.format === "preview" || opts.format === "news") {
    log("researching…");
    facts = await research(opts.format, opts.topic, page);
    log(`  ${facts.headline} — ${facts.facts.length} facts`);
  }

  log("finding footage…");
  const queries = opts.clipIds?.length ? [] : opts.queries?.length ? opts.queries : facts?.youtubeQueries.length ? facts.youtubeQueries : [opts.topic];
  const newest = opts.newest ?? (opts.format === "news" || opts.format === "preview");
  const avoid = [...(opts.avoidClipIds || []), ...readBlocklist()];
  let found = await findClips(queries, opts.maxClips ?? (opts.format === "throwback" ? 2 : 3), {
    avoid,
    newest,
    // Newest-first searches look back one year so "latest" means this season.
    publishedAfter: newest ? new Date(Date.now() - 365 * 86_400_000).toISOString() : undefined,
  });
  // A fresh-only search can come back empty for niche stories; widen once.
  if (!found.length && newest) found = await findClips(queries, opts.maxClips ?? 3, { avoid });
  if (opts.clipIds?.length) {
    found = await namedClips(opts.clipIds);
  } else {
    // Footage bank: clips that already passed every check in a posted reel.
    // Specific Chiefs news (a player's fitness, a coach's quote) rarely has
    // Creative Commons footage of its own — 2026-11-20's 11:15-equivalent run
    // lost 3 stories to Sundowns payroll graphics and reserve-team clips —
    // but the page's own verified Chiefs footage can illustrate it as archive.
    const extra = bankClipsFor(page.key, `${opts.topic} ${queries.join(" ")}`, found.map((c) => c.id), Math.max(2, 4 - found.length));
    if (extra.length) log(`  + footage bank: ${extra.map((c) => c.title || c.id).join(" | ")}`);
    found = [...found, ...extra];
  }
  if (!found.length) throw new Error(`no Creative Commons footage found for "${opts.topic}"`);
  log(`  ${found.map((c) => c.title || c.id).join(" | ")}`);

  log("downloading + drawing frame sheets…");
  let clips = (await prepareClips(found, log)).filter((c) => c.creator);
  clips = await smartCrop(clips, log);
  if (!clips.length) throw new Error("none of the footage could be downloaded");

  log("watching footage + writing the edit (claude)…");
  let plan = await planReel(opts.format, opts.topic, facts, clips, undefined, page);
  let usable = clips;

  let dead = await dropDeadShots(plan);
  plan = dead.plan;
  if (dead.dropped) log(`  dropped ${dead.dropped} black/frozen shot(s)`);

  log("quality check: every shot against its caption (claude)…");
  let check = await checkPlan(plan, jobKey, facts, page, clips);
  const issues = (c: CheckResult) =>
    [...c.shots.filter((x) => x.verdict !== "ok").map((x) => `- beat ${x.beat} shot ${x.shot}: ${x.verdict} — ${x.reason || ""}`),
      ...c.dirtyClips.map((id) => `- clip ${id} has permanent overlays: do not use it`)].join("\n");
  log(`  ${check.summary} (${check.shots.filter((x) => x.verdict !== "ok").length} shots flagged, dirty clips: ${check.dirtyClips.join(", ") || "none"})`);
  const flagged = check.shots.filter((x) => x.verdict !== "ok").length;
  if (check.dirtyClips.length || check.shots.filter((x) => x.verdict === "drop").length >= 2 || flagged >= 4) {
    // Too much went wrong to patch: one re-edit with the problems spelled
    // out and the dirty footage removed, then a second check.
    addToBlocklist(check.dirtyClips, "overlays inside the crop (quality check)");
    usable = clips.filter((c) => !check.dirtyClips.includes(c.id));
    if (!usable.length) throw new Error("every clip found carries permanent overlays — no clean footage for this story");
    log(`  re-editing with ${usable.length} clean clip(s)…`);
    plan = await planReel(opts.format, opts.topic, facts, usable, issues(check), page);
    dead = await dropDeadShots(plan);
    plan = dead.plan;
    if (dead.dropped) log(`  dropped ${dead.dropped} black/frozen shot(s)`);
    check = await checkPlan(plan, `${jobKey}-2`, facts, page, clips);
    log(`  ${check.summary} (${check.shots.filter((x) => x.verdict !== "ok").length} flagged)`);
  }
  // Final gate: a second edit that still needs a quarter of its shots
  // patched is a weak reel. Skip the slot rather than post it.
  const totalShots = plan.beats.reduce((n, b) => n + b.shots.length, 0);
  const stillBad = check.shots.filter((x) => x.verdict !== "ok").length;
  if (totalShots && stillBad / totalShots > 0.25) {
    throw new Error(`quality gate: ${stillBad} of ${totalShots} shots still flagged after the re-edit — skipping rather than posting a weak reel`);
  }
  plan = applyCheck(plan, check);
  if (plan.beats.length < 3 || footageSecs(plan) < 18) {
    throw new Error(`not enough clean footage after quality check (${plan.beats.length} beats, ${footageSecs(plan).toFixed(1)}s) — skipping rather than posting a weak reel`);
  }
  fs.rmSync(path.join(workDir(), "checks"), { recursive: true, force: true });
  plan = withOutro(plan);
  log(`  "${plan.title}": ${plan.beats.length} beats, ${plan.beats.reduce((s, b) => s + b.shots.reduce((x, y) => x + y.dur, 0), 0).toFixed(1)}s of footage`);

  log("voicing (local TTS)…");
  await voiceBeats(plan, jobKey, page);

  log("rendering…");
  const r2Key = `${page.key === "genesis_news" ? "genesis-news" : page.key.replace(/_/g, "-")}/${today()}/${jobKey}.mp4`;
  const { jobId } = await service<{ jobId: string }>("/hype/render", {
    plan: { ...plan, tag: page.tag, crowdGain: page.crowdGain },
    clips,
    outputR2Key: r2Key,
  });
  const done = await waitJob<{ r2Key: string; duration: number }>(jobId, 30 * 60_000, log);
  fs.rmSync(path.join(workDir(), "voices", jobKey), { recursive: true, force: true });

  log("cover: 3 candidates, Claude picks the best…");
  const cover = await makeCover(plan, clips, done.r2Key, page, log);

  const { caption, firstComment } = packageCaption(plan, usable, opts.format);
  return {
    ...cover,
    format: opts.format,
    topic: opts.topic,
    videoUrl: r2PublicUrl(done.r2Key),
    r2Key: done.r2Key,
    caption,
    firstComment,
    plan,
    page: page.key,
    research: facts,
    clips,
    durationSec: done.duration,
  };
}

// ─── 6b. cover ──────────────────────────────────────────────
//
// The cover decides whether anyone taps. The planner (who watched every
// frame) names 3 striking moments with 2-4 words each; all 3 are drawn,
// and Claude looks at the finished images side by side and keeps the one
// most likely to stop a scroll. A cover failure never loses the reel.

export async function makeCover(
  plan: HypePlan,
  clips: HypeClip[],
  videoR2Key: string,
  page: PageProfile,
  log: (s: string) => void = console.log
): Promise<{ thumbUrl?: string; thumbFile?: string }> {
  try {
    const byId = new Map(clips.map((c) => [c.id, c]));
    const cands = (plan.thumbs || []).filter((c) => byId.has(c.clip) && c.text).slice(0, 3);
    // Older plans (and a planner that skipped it): the middle of the first
    // shots of the strongest beats, under the reel's title.
    for (const b of plan.beats.filter((x) => x.mode !== "end" && x.label !== "MADE WITH AI")) {
      if (cands.length >= 3) break;
      const s = b.shots[0];
      if (s && byId.has(s.clip)) cands.push({ clip: s.clip, t: s.start + s.dur / 2, text: b.mode === "hook" ? plan.title : `${b.label}` });
    }
    const made: { file: string; r2Key: string; text: string }[] = [];
    for (const [i, c] of cands.entries()) {
      try {
        const r = await service<{ r2Key: string; file: string }>("/hype/thumb", {
          clip: { id: c.clip, crop: byId.get(c.clip)!.crop }, t: c.t, text: c.text, tag: page.tag,
          outputR2Key: videoR2Key.replace(/\.mp4$/, `-cover${i + 1}.jpg`),
        });
        made.push({ ...r, text: c.text });
      } catch (e) {
        log(`  cover ${i + 1} not drawn: ${(e as Error).message.slice(0, 80)}`);
      }
    }
    if (!made.length) return {};
    let best = 0;
    if (made.length > 1) {
      const pick = await claudeJson<{ best: number; why: string }>(
        `You are choosing the cover image for a ${page.name} reel ("${plan.title}") on Facebook and YouTube Shorts. Read each image:
${made.map((m, i) => `${i + 1}. ${m.file}`).join("\n")}

Pick the ONE that would stop the most thumbs mid-scroll at phone-feed size: a sharp, well-lit frame with a clear subject and peak action or emotion, words that are readable and make people need to watch. Reject blur, transitions, tiny subjects, clutter, text that covers the action.
Reply with ONLY JSON: {"best": <number 1-${made.length}>, "why": "one line"}`,
        { tools: ["Read"], cwd: workDir(), model: "sonnet", timeoutMs: 5 * 60_000 }
      );
      best = Math.min(Math.max(Math.round(Number(pick.best)) - 1, 0), made.length - 1);
      log(`  cover: #${best + 1} "${made[best].text}" — ${String(pick.why).slice(0, 140)}`);
    }
    return { thumbUrl: r2PublicUrl(made[best].r2Key), thumbFile: made[best].file };
  } catch (e) {
    log(`  cover skipped: ${(e as Error).message.slice(0, 120)}`);
    return {};
  }
}

/** Set an image as a Facebook reel's cover (the video's preferred thumbnail). */
export async function setReelCover(videoId: string, imagePath: string, token: string): Promise<boolean> {
  const form = new FormData();
  form.append("is_preferred", "true");
  form.append("access_token", token);
  form.append("source", new Blob([fs.readFileSync(imagePath)], { type: "image/jpeg" }), path.basename(imagePath));
  const r = await fetch(`https://graph.facebook.com/v25.0/${videoId}/thumbnails`, { method: "POST", body: form });
  if (!r.ok) console.warn(`[genesis-hype] reel cover not set (${r.status}): ${(await r.text()).slice(0, 160)}`);
  return r.ok;
}

const PAGES_YT: Record<string, string> = { genesis_news: "sa_pulse", mzansi_daily_news: "", pawsome_daily: "" };

/** Post a finished reel and drop the marketing comment under it. */
export async function publishHypeReel(
  reel: Pick<HypeReel, "videoUrl" | "caption" | "firstComment" | "thumbFile"> & { plan?: HypePlan },
  pageKey = "genesis_news",
  scheduledAt?: number
) {
  const post = await publishReel({ pageKey, videoUrl: reel.videoUrl, caption: reel.caption, scheduledAt });
  // Our chosen cover instead of whatever frame Facebook grabs.
  const cover = reel.thumbFile ? path.join(workDir(), reel.thumbFile) : "";
  let coverSet = false;
  if (post.videoId && cover && fs.existsSync(cover)) {
    coverSet = await setReelCover(post.videoId, cover, pageToken(pageKey) || "").catch(() => false);
  }
  let commentId: string | null = null;
  // Comments go on the reel's VIDEO id: its post id is a "singular status",
  // which the Graph API refuses comments on (error #12).
  if (!scheduledAt && post.videoId && reel.firstComment) {
    commentId = await postPageComment(post.videoId, reel.firstComment, pageToken(pageKey) || undefined);
  }
  // Same reel as a YouTube Short on the Genesis News channel, through the
  // factory's authorised uploader. A YouTube failure never undoes Facebook.
  let youtubeId: string | null = null;
  const ytNiche = process.env.GENESIS_YT_NICHE ?? (PAGES_YT[pageKey] || "");
  if (!scheduledAt && ytNiche && process.env.GENESIS_YOUTUBE !== "off") {
    try {
      youtubeId = await uploadShort(reel, ytNiche);
    } catch (e) {
      console.warn(`[genesis-hype] YouTube skipped: ${(e as Error).message}`);
    }
  }
  return { ...post, commentId, youtubeId, coverSet };
}

async function uploadShort(reel: Pick<HypeReel, "videoUrl" | "caption" | "firstComment" | "thumbFile"> & { plan?: HypePlan }, niche: string): Promise<string> {
  const { execFile } = await import("node:child_process");
  const desc = path.join(workDir(), "reels", `yt-desc-${Date.now()}.txt`);
  fs.mkdirSync(path.dirname(desc), { recursive: true });
  fs.writeFileSync(desc, `${reel.caption}\n\n${reel.firstComment}`);
  const firstLine = reel.caption.split("\n")[0].replace(/[^\p{L}\p{N}\s'!?,.:&—-]/gu, "").trim();
  const title = reel.plan?.title ? `${reel.plan.title} — ${firstLine}` : firstLine;
  try {
    return await new Promise<string>((resolve, reject) =>
      execFile(process.env.GENESIS_PYTHON || "python", [path.join(process.cwd(), "scripts", "genesis_youtube.py"), reel.videoUrl, title, desc, niche,
        ...(reel.thumbFile ? [path.join(workDir(), reel.thumbFile)] : [])],
        { timeout: 10 * 60_000 }, (err, out, stderr) => (err ? reject(new Error(String(stderr).trim().split("\n").pop())) : resolve(String(out).trim().split("\n").pop() || "")))
    );
  } finally {
    fs.rmSync(desc, { force: true });
  }
}

/**
 * Render a saved reel again (same plan, same clips) — after a renderer fix,
 * or with a different voice — without re-picking, re-downloading or
 * re-editing. Returns the new video URL; nothing is posted.
 */
export async function rerenderHypeReel(saved: HypeReel, log: (s: string) => void = console.log): Promise<HypeReel> {
  const page = pageProfile(saved.page || "genesis_news");
  const jobKey = `gh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // The outro is re-added so a changed outro line takes effect.
  const plan = withOutro({ ...saved.plan, beats: saved.plan.beats.filter((b) => b.label !== "MADE WITH AI").map((b) => ({ ...b, voiceFile: undefined })) });
  log("voicing (local TTS)…");
  await voiceBeats(plan, jobKey, page);
  log("rendering…");
  const r2Key = `${page.key === "genesis_news" ? "genesis-news" : page.key.replace(/_/g, "-")}/${today()}/${jobKey}.mp4`;
  const { jobId } = await service<{ jobId: string }>("/hype/render", { plan: { ...plan, tag: page.tag, crowdGain: page.crowdGain }, clips: saved.clips, outputR2Key: r2Key });
  const done = await waitJob<{ r2Key: string; duration: number }>(jobId, 30 * 60_000, log);
  fs.rmSync(path.join(workDir(), "voices", jobKey), { recursive: true, force: true });
  return { ...saved, plan, videoUrl: r2PublicUrl(done.r2Key), r2Key: done.r2Key, durationSec: done.duration };
}
