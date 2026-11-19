// Make (and optionally post) a Genesis News hype reel from the terminal or
// from Windows Task Scheduler (scripts/run_genesis_hype.cmd).
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-hype.ts \
//     --auto --publish                       # editor picks today's best story + format
//     --format preview --topic "..."         # or say exactly what to make
//     [--clips id1,id2] [--queries "a|b"] [--page genesis_news]
//
// Every reel is written to GENESIS_WORK_DIR/reels/<id>.json and appended to
// reels/ledger.jsonl, which the auto-picker reads (no repeats) and the
// metrics collector reads (which reels are ours).

import fs from "node:fs";
import path from "node:path";
import { makeHypeReel, publishHypeReel, pickTopic, type HypeFormat } from "../src/lib/genesis-news/hype";
import { pageProfile } from "../src/lib/genesis-news/pages";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const WORK = process.env.GENESIS_WORK_DIR || ".";
const LEDGER = path.join(WORK, "reels", "ledger.jsonl");
const LOCK = path.join(WORK, "reels", ".lock");

export interface LedgerRow {
  at: string;
  page: string;
  format: string;
  topic: string;
  title: string;
  videoUrl: string;
  durationSec: number;
  published: boolean;
  videoId?: string;
  postId?: string;
  why?: string;
  clipIds?: string[];
  youtubeId?: string | null;
}

function readLedger(): LedgerRow[] {
  try {
    return fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

(async () => {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  // One reel at a time: two runs would fight over the container and the CPU.
  // A lock older than 90 minutes is from a run that died.
  // Wait (up to 45 min) for a reel already in progress rather than losing
  // this slot; give up only if it is still busy after that.
  const waitUntil = Date.now() + 45 * 60_000;
  while (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 90 * 60_000) {
    if (Date.now() > waitUntil) {
      console.log("another hype reel has been running for 45+ minutes — skipping this slot");
      return;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  fs.writeFileSync(LOCK, String(process.pid));
  try {
    const page = arg("page") || "genesis_news";
    let format = arg("format") as HypeFormat | undefined;
    let topic = arg("topic");
    let queries = arg("queries")?.split("|").filter(Boolean);
    let why: string | undefined;

    if (process.argv.includes("--auto")) {
      const pick = await pickTopic(readLedger().filter((r) => r.page === page), pageProfile(page));
      ({ format, topic, why } = pick);
      queries = queries || (pick.format === "countdown" || pick.format === "throwback" ? pick.queries : undefined);
      console.log(`[genesis-hype] picked ${format}: ${topic} — ${why}`);
    }
    if (!topic) throw new Error("--topic or --auto required");

    const t0 = Date.now();
    const since = Date.now() - 14 * 86_400_000;
    const recentClips = readLedger().filter((r) => r.page === page && Date.parse(r.at) > since).flatMap((r) => r.clipIds || []);
    const reel = await makeHypeReel({
      format: format || "countdown", topic, queries, clipIds: arg("clips")?.split(",").filter(Boolean),
      page, avoidClipIds: recentClips, newest: process.argv.includes("--newest") ? true : undefined,
    });
    const id = reel.r2Key.split("/").pop()!.replace(".mp4", "");
    fs.writeFileSync(path.join(WORK, "reels", `${id}.json`), JSON.stringify({ ...reel, why }, null, 2));
    console.log(`\nREEL ${reel.videoUrl}  (${reel.durationSec.toFixed(1)}s, ${Math.round((Date.now() - t0) / 1000)}s to make)`);
    console.log(`\n${reel.caption}\n\nFIRST COMMENT: ${reel.firstComment}`);

    const row: LedgerRow = {
      at: new Date().toISOString(), page, format: reel.format, topic, title: reel.plan.title,
      videoUrl: reel.videoUrl, durationSec: reel.durationSec, published: false, why,
      clipIds: [...new Set(reel.plan.beats.flatMap((b) => b.shots.map((s) => s.clip)))],
    };
    if (process.argv.includes("--publish")) {
      const post = await publishHypeReel(reel, page);
      Object.assign(row, { published: true, videoId: post.videoId, postId: post.postId, youtubeId: post.youtubeId });
      console.log(`\nPOSTED ${JSON.stringify(post)}`);
    }
    fs.appendFileSync(LEDGER, JSON.stringify(row) + "\n");
  } finally {
    fs.rmSync(LOCK, { force: true });
  }
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
