// Give an already-posted hype reel a proper cover: 3 candidates from its own
// clips, Claude picks the best, set on the Facebook reel (and the YouTube
// Short when --youtube is given). Needs the reel's clips still in genesis-work/src.
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-cover.ts \
//     --reel <reels/xxx.json> --video <facebook video id> --page <page> [--youtube <id>] [--dry]

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makeCover, setReelCover, type HypeReel } from "../src/lib/genesis-news/hype";
import { pageProfile } from "../src/lib/genesis-news/pages";
import { pageToken } from "../src/lib/facebook-reels";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

(async () => {
  const WORK = process.env.GENESIS_WORK_DIR || ".";
  const reelFile = arg("reel");
  const pageKey = arg("page") || "genesis_news";
  if (!reelFile) throw new Error("--reel required");
  const reel = JSON.parse(fs.readFileSync(reelFile, "utf8")) as HypeReel;
  const missing = reel.clips.filter((c) => !fs.existsSync(path.join(WORK, "src", `${c.id}.mp4`)));
  const clips = reel.clips.filter((c) => !missing.includes(c));
  if (!clips.length) throw new Error("none of this reel's clips are on disk any more");
  const cover = await makeCover(reel.plan, clips, reel.r2Key, pageProfile(pageKey));
  if (!cover.thumbFile) throw new Error("no cover could be made");
  console.log(`cover: ${cover.thumbUrl}`);
  fs.writeFileSync(reelFile, JSON.stringify({ ...reel, ...cover }, null, 2));
  if (process.argv.includes("--dry")) return;

  const video = arg("video");
  if (video) console.log(`facebook cover set: ${await setReelCover(video, path.join(WORK, cover.thumbFile), pageToken(pageKey) || "")}`);
  const yt = arg("youtube");
  if (yt) {
    const out = execFileSync(process.env.GENESIS_PYTHON || "python",
      [path.join(process.cwd(), "scripts", "genesis_youtube.py"), "--thumb", yt, path.join(WORK, cover.thumbFile), "sa_pulse"], { encoding: "utf8" });
    console.log(`youtube: ${out.trim()}`);
  }
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
