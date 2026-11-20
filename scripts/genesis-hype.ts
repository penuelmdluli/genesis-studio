// Make (and optionally post) a Genesis News hype reel from the terminal or
// from Windows Task Scheduler (scripts/run_genesis_hype.cmd).
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-hype.ts \
//     --auto --publish                       # editor picks today's best story + format
//     --format preview --topic "..."         # or say exactly what to make
//     [--clips id1,id2] [--queries "a|b"] [--page genesis_news]
//     --spare                                # overnight: make (not post) an evergreen spare reel
//
// An --auto slot tries up to 3 stories, then posts the page's spare reel
// (reels/spare-<page>.json) rather than leaving the slot empty.
//
// Every reel is written to GENESIS_WORK_DIR/reels/<id>.json and appended to
// reels/ledger.jsonl, which the auto-picker reads (no repeats) and the
// metrics collector reads (which reels are ours).

import fs from "node:fs";
import path from "node:path";
import { makeHypeReel, publishHypeReel, pickTopic, type HypeFormat, type HypeReel } from "../src/lib/genesis-news/hype";
import { pageProfile } from "../src/lib/genesis-news/pages";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const WORK = process.env.GENESIS_WORK_DIR || ".";
const LEDGER = path.join(WORK, "reels", "ledger.jsonl");
const LOCK = path.join(WORK, "reels", ".lock");
const sparePath = (page: string) => path.join(WORK, "reels", `spare-${page}.json`);

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
  // A lock older than 150 minutes is from a run that died.
  // Wait (up to 80 min — a slot with retries can run an hour) for a reel already in progress rather than losing
  // this slot; give up only if it is still busy after that.
  const waitUntil = Date.now() + 80 * 60_000;
  while (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 150 * 60_000) {
    if (Date.now() > waitUntil) {
      console.log("another hype reel has been running for 80+ minutes â€” skipping this slot");
      return;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  fs.writeFileSync(LOCK, String(process.pid));
  try {
    const page = arg("page") || "genesis_news";
    const spare = process.argv.includes("--spare");
    const auto = spare || process.argv.includes("--auto");
    const publish = !spare && process.argv.includes("--publish");
    const slotStart = Date.now();
    const since = Date.now() - 14 * 86_400_000;
    const recentClips = readLedger().filter((r) => r.page === page && Date.parse(r.at) > since).flatMap((r) => r.clipIds || []);

    // The overnight spare: one finished, checked evergreen reel per page,
    // waiting in reels/spare-<page>.json for a slot whose story falls through.
    if (spare && fs.existsSync(sparePath(page)) && Date.now() - fs.statSync(sparePath(page)).mtimeMs < 5 * 86_400_000) {
      console.log(`[genesis-hype] a spare for ${page} is already waiting â€” nothing to do`);
      return;
    }

    // A slot gets up to 3 stories: when one cannot become a clean reel (the
    // quality gate, too little footage, a crash), the editor picks a clearly
    // different one. No new attempt starts after 60 minutes.
    const failed: { topic: string; why: string }[] = [];
    let reel: HypeReel | null = null;
    let topic = arg("topic");
    let why: string | undefined;
    for (let attempt = 1; attempt <= (auto ? 3 : 1); attempt++) {
      if (attempt > 1 && Date.now() - slotStart > 60 * 60_000) break;
      let format = arg("format") as HypeFormat | undefined;
      let queries = arg("queries")?.split("|").filter(Boolean);
      try {
        if (auto) {
          const pick = await pickTopic(readLedger().filter((r) => r.page === page), pageProfile(page), { failed, evergreen: spare });
          ({ format, topic, why } = pick);
          queries = queries || (pick.format === "countdown" || pick.format === "throwback" ? pick.queries : undefined);
          console.log(`[genesis-hype] ${attempt > 1 ? `attempt ${attempt} â€” ` : ""}picked ${format}: ${topic} â€” ${why}`);
        }
        if (!topic) throw new Error("--topic or --auto required");
        const t0 = Date.now();
        reel = await makeHypeReel({
          format: format || "countdown", topic, queries, clipIds: arg("clips")?.split(",").filter(Boolean),
          page, avoidClipIds: recentClips, newest: process.argv.includes("--newest") ? true : undefined,
        });
        console.log(`\nREEL ${reel.videoUrl}  (${reel.durationSec.toFixed(1)}s, ${Math.round((Date.now() - t0) / 1000)}s to make)`);
        break;
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`[genesis-hype] attempt ${attempt} FAILED: ${msg.slice(0, 300)}`);
        if (topic) failed.push({ topic, why: msg.slice(0, 120) });
        if (!auto) throw e;
      }
    }

    if (spare) {
      if (!reel) throw new Error(`no spare reel could be made for ${page}`);
      fs.writeFileSync(sparePath(page), JSON.stringify({ ...reel, topic, why }, null, 2));
      console.log(`[genesis-hype] spare for ${page} saved: ${reel.plan.title}`);
      return;
    }

    // Every story fell through: post the spare instead of leaving the slot empty.
    if (!reel && publish && fs.existsSync(sparePath(page))) {
      const s = JSON.parse(fs.readFileSync(sparePath(page), "utf8"));
      ({ topic, why } = s);
      reel = s as HypeReel;
      console.log(`[genesis-hype] every story fell through â€” posting the spare: ${reel.plan.title}`);
    }
    if (!reel) throw new Error(`no reel this slot (${failed.length} stories tried, no spare waiting)`);

    const id = reel.r2Key.split("/").pop()!.replace(".mp4", "");
    fs.writeFileSync(path.join(WORK, "reels", `${id}.json`), JSON.stringify({ ...reel, why }, null, 2));
    console.log(`\n${reel.caption}\n\nFIRST COMMENT: ${reel.firstComment}`);

    const row: LedgerRow = {
      at: new Date().toISOString(), page, format: reel.format, topic: topic || "", title: reel.plan.title,
      videoUrl: reel.videoUrl, durationSec: reel.durationSec, published: false, why,
      clipIds: [...new Set(reel.plan.beats.flatMap((b) => b.shots.map((s) => s.clip)))],
    };
    if (publish) {
      const post = await publishHypeReel(reel, page);
      Object.assign(row, { published: true, videoId: post.videoId, postId: post.postId, youtubeId: post.youtubeId });
      console.log(`\nPOSTED ${JSON.stringify(post)}`);
      // A spare is used once; the night run makes the next one.
      if (fs.existsSync(sparePath(page)) && JSON.parse(fs.readFileSync(sparePath(page), "utf8")).r2Key === reel.r2Key) {
        fs.rmSync(sparePath(page));
      }
    }
    fs.appendFileSync(LEDGER, JSON.stringify(row) + "\n");
  } finally {
    fs.rmSync(LOCK, { force: true });
  }
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
