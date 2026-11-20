// Daily self-review of the hype-reel pipeline (Task Scheduler: "Genesis Hype Review", 22:30).
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-review.ts
//
// The pipeline rejects bad reels on its own; it cannot change its own code.
// This closes the loop without giving it that power: every evening the local
// `claude` CLI reads the day's logs, ledger, scoreboards and reel plans
// (read-only tools) and writes a short report — what posted, what was
// skipped and why, what the numbers say, and concrete suggested fixes —
// to GENESIS_WORK_DIR/reports/review-<date>.md. Code changes still wait for
// the owner.

import fs from "node:fs";
import path from "node:path";
import { notifyPhone } from "../src/lib/genesis-news/notify";
import { runClaude } from "../src/lib/genesis-news/claude-cli";

const WORK = process.env.GENESIS_WORK_DIR || ".";
const day = new Date().toISOString().slice(0, 10);

(async () => {
  const todaysReels = fs
    .readdirSync(path.join(WORK, "reels"))
    .filter((f) => f.endsWith(".json") && fs.statSync(path.join(WORK, "reels", f)).mtime.toISOString().startsWith(day))
    .map((f) => `reels/${f}`);

  const prompt = `You are reviewing today's (${day}) run of the "hype reel" pipeline that makes and posts short football/news reels for the owner's Facebook pages (Genesis News, Mzansi Daily News). You can only READ files. The owner reads your report on their phone, so be short and concrete.

Files (relative to the current folder):
- reports/health-<date>.md — this morning's health check (service, claude login, tokens, spare reels); logs/spares.log — the overnight spare reels; "attempt N FAILED" / "posting the spare" lines in the slot logs show stories that fell through.
- logs/hype-<page>.log (and the older shared logs/hype.log) — every scheduled slot: what it picked, quality-check summaries, "quality gate"/"not enough clean footage" skips, FAILED lines, POSTED lines.
- reels/ledger.jsonl — one line per reel made (page, format, topic, published, clipIds).
- metrics/latest-genesis_news.md and any other metrics/latest-*.md — scoreboards (hype reels vs other reels).
- Today's reel plans: ${todaysReels.join(", ") || "(none)"} — each has plan.beats (labels, captions, commentary) and research facts.

Write the report in Markdown with exactly these sections:
## Today
How many slots ran, posted, skipped, failed — per page. One line per reel: title, link, posted or not.
## What went wrong
Each failure or skip with its real cause from the log (not a guess). Note repeated patterns (same failure twice = a pattern).
## What the numbers say
From the scoreboards: which formats/topics beat the page average, which lost. Only claims the numbers support; say so if it is too early.
## Suggested fixes (need the owner's OK)
At most 5, most valuable first. Each: the problem, the change (file + what to change), and the expected effect. Prefer fixes to repeated patterns.
## Tomorrow
One or two lines: what the picker should lean into or avoid.

Never invent numbers. If a file is missing, say so.`;

  const report = await runClaude(prompt, { tools: ["Read", "Glob", "Grep"], cwd: WORK, timeoutMs: 15 * 60_000 });
  const out = path.join(WORK, "reports", `review-${day}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `# Hype reel review — ${day}\n\n${report.trim()}\n`);
  console.log(`saved ${out}\n\n${report}`);
  // Phone: the day in a few lines + the suggested fixes, so they get acted on.
  const section = (name: string) => (report.split(/^## /m).find((s) => s.startsWith(name)) || "").replace(name, "").trim();
  await notifyPhone(`Reels review ${day}`,
    `${section("Today").slice(0, 900)}\n\nSUGGESTED FIXES (reply "fix them" to Claude):\n${section("Suggested fixes").replace(/^\(.*?\)\s*/, "").slice(0, 1800)}`,
    { priority: 3, tags: "bar_chart" });
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
