// Re-render a saved reel with the current renderer (no re-pick, no re-edit, no post).
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-rerender.ts <reel id or path to reels/<id>.json>
import fs from "node:fs";
import path from "node:path";
import { rerenderHypeReel, type HypeReel } from "../src/lib/genesis-news/hype";

const arg = process.argv[2];
const file = arg?.endsWith(".json") ? arg : path.join(process.env.GENESIS_WORK_DIR || ".", "reels", `${arg}.json`);
const saved = JSON.parse(fs.readFileSync(file, "utf8")) as HypeReel;
rerenderHypeReel(saved, (s) => console.log(`[rerender] ${s}`))
  .then((r) => {
    const id = r.r2Key.split("/").pop()!.replace(".mp4", "");
    fs.writeFileSync(path.join(path.dirname(file), `${id}.json`), JSON.stringify(r, null, 2));
    console.log(`\nREEL ${r.videoUrl}  (${r.durationSec.toFixed(1)}s)`);
  })
  .catch((e) => {
    console.error("FAILED:", (e as Error).message);
    process.exit(1);
  });
