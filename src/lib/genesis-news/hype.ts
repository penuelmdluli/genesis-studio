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
}

export interface HypeShot { clip: string; start: number; dur: number; cap1?: string; cap2?: string }
export interface HypeBeat { mode?: "hook" | "beat" | "end"; label: string; voice: string; shots: HypeShot[]; voiceFile?: string }
export interface HypePlan {
  title: string;
  beats: HypeBeat[];
  postCaption: string;
  hashtags: string[];
  /** What Claude saw, per clip — kept for review. */
  notes?: string;
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
  research: Research | null;
  clips: HypeClip[];
  durationSec: number;
}

// ─── plumbing ───────────────────────────────────────────────

function workDir(): string {
  const dir = process.env.GENESIS_WORK_DIR;
  if (!dir) throw new Error("GENESIS_WORK_DIR not set (the folder mounted into genesis-scraper as /work)");
  return dir;
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

export async function research(format: HypeFormat, topic: string): Promise<Research> {
  const prompt = `You are the research desk for "Genesis News", a South African football page (PSL, Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, Bafana Bafana).
Today is ${today()}. Story: "${topic}". Reel type: ${format}.

Use web search to establish what is TRUE and CURRENT about this story. ${format === "preview" ? "Find the fixture: teams, date, kick-off time (SAST), venue, competition, and each side's recent form or league position." : ""}
Only keep facts you found on a reputable source (club sites, PSL, SuperSport, KickOff, iDiski Times, News24, BBC, ESPN). No rumours presented as fact.

Then write 3 YouTube search queries likely to find Creative Commons FOOTAGE for this story (highlights of these teams/players, past meetings, famous goals). Short, like a fan would type.

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
export async function pickTopic(recent: { format: string; topic: string; at: string }[]): Promise<TopicPick> {
  const prompt = `You are the editor of "Genesis News", a South African football Facebook page (10k+ followers; Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, PSL, Bafana Bafana, SA players abroad).
Today is ${today()}. Use web search to see what is happening in SA football RIGHT NOW: results in the last 48h, fixtures in the next 3 days, transfers, player form, Bafana.

Pick the ONE reel most likely to trend today:
- "preview": a big fixture (Chiefs, Pirates, Sundowns, Soweto Derby, Bafana, a cup semi/final) within 3 days.
- "news": a genuine story from the last 48h that fans are talking about.
- "countdown": "top N" of goals/saves/skills for a team, player or rivalry — great on quiet days.
- "throwback": one legendary match or moment, ideally tied to an anniversary or this week's opponent.
Our footage is Creative Commons YouTube highlights, so pick topics with lots of fan-uploaded footage (big clubs, derbies, Bafana) over obscure ones.

THE AUDIENCE IS MOSTLY KAIZER CHIEFS FANS (owner's call, 2026-11-19). So:
- Chiefs first. Every Chiefs fixture gets a preview, every Chiefs result gets a reaction/highlights reel, every real Chiefs story gets covered. Aim for at least half of all reels to be about Amakhosi.
- Then Bafana Bafana (always big), then Pirates and Sundowns — especially when they play Chiefs or lead the league.
- Quiet days: highlights and "best of" reels fans share — best Chiefs goals, best dribbles/skills, best saves, derby classics, a player's top moments. A "countdown" can be goals, skills/dribbles or saves.
- Hype Chiefs, never mock rivals' fans; banter is fine, insults are not.

Recently made (do NOT repeat the same topic within 3 days; vary the format):
${recent.slice(-10).map((r) => `- ${r.at.slice(0, 10)} ${r.format}: ${r.topic}`).join("\n") || "- nothing yet"}

Reply with ONLY JSON: {"format": "preview"|"news"|"countdown"|"throwback", "topic": "one line a researcher can act on", "why": "one sentence", "queries": ["optional YouTube searches for footage"]}`;
  const p = await claudeJson<TopicPick>(prompt, { tools: ["WebSearch", "WebFetch"], timeoutMs: 6 * 60_000 });
  const format = (["preview", "news", "countdown", "throwback"] as const).includes(p.format) ? p.format : "countdown";
  return { format, topic: String(p.topic || "Soweto Derby greatest goals"), why: String(p.why || ""), queries: p.queries?.filter(Boolean) };
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
    for (const c of r.clips || []) if (!seen.has(c.id) && !avoid.has(c.id)) seen.set(c.id, c);
  }
  // Compilations and highlights (2-12 min) give the most moments per download.
  return [...seen.values()]
    .sort((a, b) => Number(b.durationSec >= 90 && b.durationSec <= 720) - Number(a.durationSec >= 90 && a.durationSec <= 720))
    .slice(0, want);
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

export async function planReel(format: HypeFormat, topic: string, facts: Research | null, clips: HypeClip[], redo?: string): Promise<HypePlan> {
  const clipList = clips
    .map((c) => `- clip "${c.id}": "${c.title}" by ${c.creator}, ${Math.round(c.durationSec)}s. Sheets: ${(c.sheets || []).join(", ")}`)
    .join("\n");
  const prompt = `You are the editor of "Genesis News", a South African football Facebook page. Make a reel that TRENDS: hyped, fast, every word true.

Story: "${topic}"   Today: ${today()}
${facts ? `Researched facts (the ONLY facts you may state beyond what is visible):\n${facts.facts.map((f) => `- ${f.fact}`).join("\n")}${facts.fixture ? `\nFixture: ${JSON.stringify(facts.fixture)}` : ""}` : "No research: state only what the footage itself shows (on-screen graphics, names on shirts, scoreboards)."}

FORMAT: ${FORMAT_GUIDE[format]}

FOOTAGE. Each sheet is a grid of frames, one every 2 seconds, stamped with the SECOND it was taken (top-left). Read EVERY sheet with the Read tool before planning:
${clipList}

Rules for shots:
- Use only real match footage. Skip title cards, "NUMBER" cards, black or faded frames, transitions, other channels' intro/outro graphics, and tiny boxed-in footage.
- Do NOT use a clip at all if its footage carries PERMANENT overlays in the middle of the picture: subscribe buttons, a presenter's face-cam, a big channel logo over the action. (Small corner bugs and broadcast score bars are fine — the edges are cropped.)
- A shot is 1.5–5 seconds; start at a stamped second (the moment can be up to 2s either side). Never run past the clip's length.
- The moment the ball goes in must be INSIDE a shot. Use different angles/replays when the sheet shows them.
- Total 30–60 seconds. Hook ≤ 3.5s. End card: one shot ≤ 3s of fans/celebration.

Rules for text:
- title: ≤ 22 chars, upper case, the reel's name ("SOWETO DERBY SCREAMERS").
- label: ≤ 20 chars, upper case. cap1/cap2: ≤ 26 chars each; cap2 is the punchline (shown in gold). Captions describe what is on screen IN THAT SHOT.
- Names: only if on a shirt, an on-screen graphic, or in the facts. Otherwise "the No.45", "the Chiefs skipper" etc. Never invent scores, dates or quotes.
- voice: what an excited South African football commentator says over the WHOLE beat. Plain words (no [tags], no emojis, no ALL CAPS), short punchy phrases with "!" and "…". About 2.5 words per second of the beat. Local flavour welcome (Amakhosi, the Bucs, Masandawana, Bafana, "eish", "yho!") but keep it clear.
- postCaption: 2-4 short lines for Facebook, 1-3 emojis, ends with a question that gets comments. hashtags: 4-6.

${redo ? `THIS IS A REDO. A frame-by-frame check of your last edit found:\n${redo}\nFix every point.\n\n` : ""}Reply with ONLY this JSON (no prose):
{"title": "", "notes": "one line per clip: what you saw and where",
 "beats": [{"mode": "hook"|"beat"|"end", "label": "", "voice": "", "shots": [{"clip": "<id>", "start": 0, "dur": 0, "cap1": "", "cap2": ""}]}],
 "postCaption": "", "hashtags": ["#..."]}`;
  const plan = await claudeJson<HypePlan>(prompt, { tools: ["Read"], cwd: workDir(), timeoutMs: 15 * 60_000 });
  return validatePlan(plan, clips);
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

async function shotStrips(plan: HypePlan, key: string): Promise<string[]> {
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
          "-filter_complex", "[0:v]scale=400:-2[a];[1:v]scale=400:-2[b];[2:v]scale=400:-2[c];[a][b][c]hstack=3",
          "-frames:v", "1", path.join(workDir(), file)], { timeout: 60_000 }, (err) => (err ? reject(err) : resolve()))
      );
      out.push(file);
    }
  }
  return out;
}

export async function checkPlan(plan: HypePlan, key: string, facts: Research | null): Promise<CheckResult> {
  const strips = await shotStrips(plan, key);
  let i = 0;
  const list = plan.beats.flatMap((b, bi) =>
    b.shots.map((s, si) => `- beat ${bi} shot ${si} [${b.mode || "beat"} "${b.label}"] clip ${s.clip} @${s.start.toFixed(1)}s: caption "${s.cap1 || ""}" / "${s.cap2 || ""}" — image ${strips[i++]}`)
  );
  const voices = plan.beats.map((b, bi) => `- beat ${bi} "${b.label}": "${b.voice}"`).join("\n");
  const prompt = `You are the quality controller for "Genesis News" reels. Each image shows ONE planned shot: its first, middle and last frame side by side. Read EVERY image with the Read tool, then judge each shot.

${list.join("\n")}

Commentary planned per beat (spoken over that beat's shots):
${voices}
${facts ? `\nResearched facts the commentary may also state:\n${facts.facts.map((f) => `- ${f.fact}`).join("\n")}\n` : ""}
For each shot:
- "ok": real football footage (match action, replay, players, fans, stadium), and the caption is a fair description of what these frames show.
- "recaption": good footage but the caption claims something not shown (e.g. "ball in the net" over open play). Give a new cap1/cap2 (<= 26 chars each, upper case) that is true for these frames.
- "drop": a title card, "NUMBER" card, black/blank/faded frame, transition, an intro/outro graphic, or footage mostly covered by overlays.
Also list in dirtyClips every clip id whose footage carries PERMANENT overlays over the picture (subscribe buttons, presenter face-cams, big channel logos) — those clips must not be used at all. Small corner bugs and score bars are fine.

Then the COMMENTARY. For EVERY beat, return the line to be spoken over the shots you kept for that beat. Keep the planned line if every claim in it is either visible in those frames or in the researched facts. Otherwise rewrite it: same excited South African commentator energy and about the same length, but it may only describe what the kept frames actually show (a scramble is a scramble, not a header; a bench celebrating is not a 41-metre strike) or state researched facts. Plain words, no [tags], no ALL CAPS.

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
        voice: "Made with eye-video studio! Create your own videos free, at eye video studio dot A I!",
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
  const beats: HypeBeat[] = [];
  for (const b of plan.beats || []) {
    const shots: HypeShot[] = [];
    for (const s of b.shots || []) {
      const c = byId.get(s.clip);
      if (!c) continue;
      const dur = Math.min(Math.max(Number(s.dur) || 2.5, 1), 6);
      const start = Math.min(Math.max(Number(s.start) || 0, 0), Math.max(0, c.durationSec - dur - 0.3));
      if (dur > budget) break;
      budget -= dur;
      shots.push({ clip: c.id, start, dur, cap1: String(s.cap1 || "").slice(0, 32), cap2: String(s.cap2 || "").slice(0, 32) });
    }
    if (shots.length) beats.push({ mode: b.mode, label: String(b.label || "").slice(0, 24), voice: String(b.voice || ""), shots });
  }
  if (!beats.length) throw new Error("the edit plan had no usable shots");
  return { ...plan, title: String(plan.title || "GENESIS NEWS").toUpperCase().slice(0, 26), beats };
}

// ─── 5. voice (local) ───────────────────────────────────────

export async function voiceBeats(plan: HypePlan, jobKey: string): Promise<void> {
  const { execFile } = await import("node:child_process");
  const engine = process.env.GENESIS_TTS_ENGINE || "kokoro";
  const voice = process.env.GENESIS_TTS_VOICE || (engine === "edge" ? "en-ZA-LukeNeural" : "bm_george");
  const speed = process.env.GENESIS_TTS_SPEED || "1.12";
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
  await new Promise<void>((resolve, reject) =>
    execFile(process.env.GENESIS_PYTHON || "python", [script, "--batch", jobFile], { timeout: 10 * 60_000 }, (err, _out, stderr) =>
      err ? reject(new Error(`TTS: ${String(stderr).trim().split("\n").pop()}`)) : resolve()
    )
  );
}

// ─── 7. package ─────────────────────────────────────────────

const IVIDEO_CTA = "🎬 Edited with AI on iVideo Studio — make your own videos FREE at ivideostudio.ai";
const FIRST_COMMENTS = [
  "Want hype reels like this for YOUR page? 🎬 We make them with iVideo Studio — start FREE 👉 https://ivideostudio.ai",
  "This reel was edited with AI 🤖⚽ Make yours in minutes, free to start 👉 https://ivideostudio.ai",
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
  log?: (s: string) => void;
}): Promise<HypeReel> {
  const log = opts.log ?? ((s: string) => console.log(`[genesis-hype] ${s}`));
  const jobKey = `gh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let facts: Research | null = null;
  if (opts.format === "preview" || opts.format === "news") {
    log("researching…");
    facts = await research(opts.format, opts.topic);
    log(`  ${facts.headline} — ${facts.facts.length} facts`);
  }

  log("finding footage…");
  const queries = opts.clipIds?.length ? [] : opts.queries?.length ? opts.queries : facts?.youtubeQueries.length ? facts.youtubeQueries : [opts.topic];
  const newest = opts.newest ?? (opts.format === "news" || opts.format === "preview");
  let found = await findClips(queries, opts.maxClips ?? (opts.format === "throwback" ? 2 : 3), {
    avoid: opts.avoidClipIds,
    newest,
    // Newest-first searches look back one year so "latest" means this season.
    publishedAfter: newest ? new Date(Date.now() - 365 * 86_400_000).toISOString() : undefined,
  });
  // A fresh-only search can come back empty for niche stories; widen once.
  if (!found.length && newest) found = await findClips(queries, opts.maxClips ?? 3, { avoid: opts.avoidClipIds });
  if (opts.clipIds?.length) {
    found = opts.clipIds.map((id) => ({ id, title: "", creator: "", url: `https://www.youtube.com/watch?v=${id}`, license: "CC BY 3.0", durationSec: 0 }));
  }
  if (!found.length) throw new Error(`no Creative Commons footage found for "${opts.topic}"`);
  log(`  ${found.map((c) => c.title || c.id).join(" | ")}`);

  log("downloading + drawing frame sheets…");
  const clips = (await prepareClips(found, log)).filter((c) => c.creator);
  if (!clips.length) throw new Error("none of the footage could be downloaded");

  log("watching footage + writing the edit (claude)…");
  let plan = await planReel(opts.format, opts.topic, facts, clips);
  let usable = clips;

  log("quality check: every shot against its caption (claude)…");
  let check = await checkPlan(plan, jobKey, facts);
  const issues = (c: CheckResult) =>
    [...c.shots.filter((x) => x.verdict !== "ok").map((x) => `- beat ${x.beat} shot ${x.shot}: ${x.verdict} — ${x.reason || ""}`),
      ...c.dirtyClips.map((id) => `- clip ${id} has permanent overlays: do not use it`)].join("\n");
  log(`  ${check.summary} (${check.shots.filter((x) => x.verdict !== "ok").length} shots flagged, dirty clips: ${check.dirtyClips.join(", ") || "none"})`);
  const flagged = check.shots.filter((x) => x.verdict !== "ok").length;
  if (check.dirtyClips.length || check.shots.filter((x) => x.verdict === "drop").length >= 2 || flagged >= 4) {
    // Too much went wrong to patch: one re-edit with the problems spelled
    // out and the dirty footage removed, then a second check.
    usable = clips.filter((c) => !check.dirtyClips.includes(c.id));
    if (!usable.length) throw new Error("every clip found carries permanent overlays — no clean footage for this story");
    log(`  re-editing with ${usable.length} clean clip(s)…`);
    plan = await planReel(opts.format, opts.topic, facts, usable, issues(check));
    check = await checkPlan(plan, `${jobKey}-2`, facts);
    log(`  ${check.summary} (${check.shots.filter((x) => x.verdict !== "ok").length} flagged)`);
  }
  plan = applyCheck(plan, check);
  if (plan.beats.length < 3 || footageSecs(plan) < 18) {
    throw new Error(`not enough clean footage after quality check (${plan.beats.length} beats, ${footageSecs(plan).toFixed(1)}s) — skipping rather than posting a weak reel`);
  }
  fs.rmSync(path.join(workDir(), "checks"), { recursive: true, force: true });
  plan = withOutro(plan);
  log(`  "${plan.title}": ${plan.beats.length} beats, ${plan.beats.reduce((s, b) => s + b.shots.reduce((x, y) => x + y.dur, 0), 0).toFixed(1)}s of footage`);

  log("voicing (local TTS)…");
  await voiceBeats(plan, jobKey);

  log("rendering…");
  const r2Key = `genesis-news/${today()}/${jobKey}.mp4`;
  const { jobId } = await service<{ jobId: string }>("/hype/render", { plan, clips, outputR2Key: r2Key });
  const done = await waitJob<{ r2Key: string; duration: number }>(jobId, 30 * 60_000, log);
  fs.rmSync(path.join(workDir(), "voices", jobKey), { recursive: true, force: true });

  const { caption, firstComment } = packageCaption(plan, usable, opts.format);
  return {
    format: opts.format,
    topic: opts.topic,
    videoUrl: r2PublicUrl(done.r2Key),
    r2Key: done.r2Key,
    caption,
    firstComment,
    plan,
    research: facts,
    clips,
    durationSec: done.duration,
  };
}

/** Post a finished reel and drop the marketing comment under it. */
export async function publishHypeReel(
  reel: Pick<HypeReel, "videoUrl" | "caption" | "firstComment"> & { plan?: HypePlan },
  pageKey = "genesis_news",
  scheduledAt?: number
) {
  const post = await publishReel({ pageKey, videoUrl: reel.videoUrl, caption: reel.caption, scheduledAt });
  let commentId: string | null = null;
  // Comments go on the reel's VIDEO id: its post id is a "singular status",
  // which the Graph API refuses comments on (error #12).
  if (!scheduledAt && post.videoId && reel.firstComment) {
    commentId = await postPageComment(post.videoId, reel.firstComment, pageToken(pageKey) || undefined);
  }
  // Same reel as a YouTube Short on the Genesis News channel, through the
  // factory's authorised uploader. A YouTube failure never undoes Facebook.
  let youtubeId: string | null = null;
  const ytNiche = process.env.GENESIS_YT_NICHE ?? (pageKey === "genesis_news" ? "sa_pulse" : "");
  if (!scheduledAt && ytNiche && process.env.GENESIS_YOUTUBE !== "off") {
    try {
      youtubeId = await uploadShort(reel, ytNiche);
    } catch (e) {
      console.warn(`[genesis-hype] YouTube skipped: ${(e as Error).message}`);
    }
  }
  return { ...post, commentId, youtubeId };
}

async function uploadShort(reel: Pick<HypeReel, "videoUrl" | "caption" | "firstComment"> & { plan?: HypePlan }, niche: string): Promise<string> {
  const { execFile } = await import("node:child_process");
  const desc = path.join(workDir(), "reels", `yt-desc-${Date.now()}.txt`);
  fs.mkdirSync(path.dirname(desc), { recursive: true });
  fs.writeFileSync(desc, `${reel.caption}\n\n${reel.firstComment}`);
  const firstLine = reel.caption.split("\n")[0].replace(/[^\p{L}\p{N}\s'!?,.:&—-]/gu, "").trim();
  const title = reel.plan?.title ? `${reel.plan.title} — ${firstLine}` : firstLine;
  try {
    return await new Promise<string>((resolve, reject) =>
      execFile(process.env.GENESIS_PYTHON || "python", [path.join(process.cwd(), "scripts", "genesis_youtube.py"), reel.videoUrl, title, desc, niche],
        { timeout: 10 * 60_000 }, (err, out, stderr) => (err ? reject(new Error(String(stderr).trim().split("\n").pop())) : resolve(String(out).trim().split("\n").pop() || "")))
    );
  } finally {
    fs.rmSync(desc, { force: true });
  }
}
