// Morning health check for the hype-reel pages (Task Scheduler:
// "Genesis Hype Health", 07:00 — before the first slot at 08:15).
//
// Everything a slot needs, checked for real: the video service answers, the
// claude CLI is signed in to the subscription, each page's Facebook token
// still belongs to that page, the YouTube API key and channel token work,
// and each page has a spare reel waiting. Writes reports/health-<date>.md
// (the 23:45 self-review reads it) and one line per run to logs/health.log.
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-health.ts

import fs from "node:fs";
import path from "node:path";
import { runClaude } from "../src/lib/genesis-news/claude-cli";
import { pageToken, whoIs } from "../src/lib/facebook-reels";
import { notifyPhone } from "../src/lib/genesis-news/notify";
import { execSync, spawn } from "node:child_process";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** What the check repaired by itself this morning. */
const fixed: string[] = [];

const WORK = process.env.GENESIS_WORK_DIR || ".";
const FACTORY = process.env.AI_VIDEO_FACTORY_DIR || "C:/Users/PenuelM/Documents/ai-video-factory";
const PAGES: { key: string; name: string; yt?: string }[] = [
  { key: "genesis_news", name: "Genesis News", yt: "sa_pulse" },
  { key: "mzansi_daily_news", name: "Mzansi Daily News" },
  { key: "pawsome_daily", name: "Pawsome Daily" },
];

type Check = { name: string; ok: boolean; detail: string; fix?: string };

async function check(name: string, fix: string, fn: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, detail: await fn() };
  } catch (e) {
    return { name, ok: false, detail: (e as Error).message.slice(0, 200), fix };
  }
}

(async () => {
  const checks: Check[] = [];

  checks.push(await check("Video service (Docker)", "Start Docker Desktop; then `docker start genesis-scraper`.", async () => {
    const base = process.env.SCRAPER_SERVICE_URL || "http://localhost:3001";
    const up = () => fetch(`${base}/health`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.ok).catch(() => false);
    if (await up()) return "answering";
    // Auto-fix: start Docker Desktop if needed, then (re)start the container.
    try { execSync("docker info", { stdio: "ignore", timeout: 30_000 }); } catch {
      spawn("C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe", [], { detached: true, stdio: "ignore" }).unref();
      await sleep(120_000);
    }
    try { execSync("docker start genesis-scraper", { stdio: "ignore", timeout: 60_000 }); } catch {}
    await sleep(10_000);
    if (await up()) { fixed.push("video service was down — restarted it"); return "answering (restarted)"; }
    try { execSync("docker restart genesis-scraper", { stdio: "ignore", timeout: 90_000 }); } catch {}
    await sleep(15_000);
    if (await up()) { fixed.push("video service was stuck — restarted the container"); return "answering (restarted)"; }
    throw new Error("down, and a restart did not bring it back");
  }));

  checks.push(await check("Claude CLI (subscription login)", "Run `claude` once in a terminal and sign in.", async () => {
    const out = await runClaude("Reply with the single word OK.", { model: "haiku", timeoutMs: 90_000 });
    if (!/ok/i.test(out)) throw new Error(`unexpected reply: ${out.slice(0, 60)}`);
    return "signed in";
  }));

  for (const p of PAGES) {
    checks.push(await check(`Facebook token: ${p.name}`, "Refresh the page tokens: scripts/fb-all-page-tokens.ts with a fresh user token.", async () => {
      const token = pageToken(p.key);
      if (!token) throw new Error("no token in .env.local");
      const me = await whoIs(token);
      if (me.error || !me.id) throw new Error(me.error || "token rejected");
      return `${me.name} (${me.followers ?? "?"} followers)`;
    }));
  }

  checks.push(await check("YouTube API key (footage search)", "Replace YOUTUBE_API_KEY in .env.local and scraper.env.", async () => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("YOUTUBE_API_KEY missing");
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${key}`);
    const j = (await r.json()) as { error?: { message?: string } };
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    return "working (1 quota unit)";
  }));

  for (const p of PAGES.filter((x) => x.yt)) {
    checks.push(await check(`YouTube channel token: ${p.name}`, `Re-authorise the channel in ai-video-factory (tokens/youtube_token_${p.yt}.json).`, async () => {
      const f = path.join(FACTORY, "tokens", `youtube_token_${p.yt}.json`);
      if (!fs.existsSync(f)) throw new Error(`${f} missing`);
      const t = JSON.parse(fs.readFileSync(f, "utf8")) as { refresh_token?: string; client_id?: string; client_secret?: string; token_uri?: string };
      if (!t.refresh_token) throw new Error("no refresh token");
      if (t.client_id && t.client_secret) {
        // Trade the refresh token for an access token: proves it still works.
        const r = await fetch(t.token_uri || "https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: t.client_id, client_secret: t.client_secret }),
        });
        if (!r.ok) throw new Error(`refresh refused (HTTP ${r.status})`);
        return "refreshes";
      }
      return "present";
    }));
  }

  for (const p of PAGES) {
    checks.push(await check(`Spare reel: ${p.name}`, "The 04:30 spares task makes one; check logs/spares.log.", async () => {
      const f = path.join(WORK, "reels", `spare-${p.key}.json`);
      if (!fs.existsSync(f)) throw new Error("none waiting — a failed slot would post nothing");
      const s = JSON.parse(fs.readFileSync(f, "utf8")) as { plan?: { title?: string } };
      return s.plan?.title || "waiting";
    }));
  }

  // Auto-fix: missing spares are built now (the spares task skips pages that
  // already have one). Only when no reel is being made — it would wait anyway.
  const noSpare = checks.filter((c) => c.name.startsWith("Spare reel") && !c.ok);
  if (noSpare.length && !fs.existsSync(path.join(WORK, "reels", ".lock"))) {
    try {
      execSync('schtasks /Run /TN "Genesis Hype Spares"', { stdio: "ignore" });
      fixed.push(`started building ${noSpare.length} missing spare reel(s)`);
      for (const c of noSpare) c.fix = "Being built now (auto-fix).";
    } catch {}
  }

  const bad = checks.filter((c) => !c.ok);
  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `# Hype reels health — ${date} ${new Date().toTimeString().slice(0, 5)}`,
    "",
    bad.length ? `**${bad.length} problem(s)** — slots today may fail until fixed.` : "**All clear.**",
    "",
    ...(fixed.length ? ["Fixed automatically:", ...fixed.map((f) => `- ${f}`), ""] : []),
    "| Check | | Detail | Fix |",
    "|---|---|---|---|",
    ...checks.map((c) => `| ${c.name} | ${c.ok ? "✅" : "❌"} | ${c.detail.replace(/\|/g, "/")} | ${c.ok ? "" : c.fix} |`),
    "",
  ].join("\n");
  fs.mkdirSync(path.join(WORK, "reports"), { recursive: true });
  fs.writeFileSync(path.join(WORK, "reports", `health-${date}.md`), md);
  fs.mkdirSync(path.join(WORK, "logs"), { recursive: true });
  fs.appendFileSync(path.join(WORK, "logs", "health.log"),
    `${new Date().toISOString()} ${bad.length ? `PROBLEMS: ${bad.map((c) => `${c.name}: ${c.detail}`).join(" / ")}` : "all clear"}\n`);
  console.log(md);
  // Phone: problems loud, fixes and all-clear quiet.
  const hard = bad.filter((c) => !c.name.startsWith("Spare reel") || !fixed.length);
  await notifyPhone(
    hard.length ? `Reels health: ${hard.length} problem(s) need you` : fixed.length ? "Reels health: fixed automatically" : "Reels health: all clear",
    [...hard.map((c) => `X ${c.name}: ${c.detail}\n  -> ${c.fix}`), ...fixed.map((f) => `Fixed: ${f}`)].join("\n") || "Service, Claude login, tokens, YouTube and spares all OK.",
    { priority: hard.length ? 4 : 1, tags: hard.length ? "rotating_light" : "white_check_mark" }
  );
  process.exit(bad.length ? 2 : 0);
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
