// Nightly footage harvest (Task Scheduler: "Genesis Footage Library", 01:30).
//
// A slot must never die because today's story has no footage of its own
// (2026-11-20: three Chiefs news stories in a row had none). So every night
// each page's library grows with Creative Commons clips on its core subjects:
//   - search: yt-dlp over YouTube's own Creative Commons filter — no API quota
//   - licence: re-read per video from the YouTube API (1 unit per 50 videos);
//     only `creativeCommon` is kept. Nothing else is ever downloaded.
//   - downloaded, frame sheets drawn, smart-cropped; clips with overlays over
//     the middle of the picture are blocklisted.
// Kept in reels/footage-library-<page>.json. When a story's own search is
// thin, the slot adds the library clips whose titles match the story.
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-harvest.ts [--page p] [--max 12]

import fs from "node:fs";
import { findClips, prepareClips, smartCrop, readBlocklist, libraryFile, type HypeClip } from "../src/lib/genesis-news/hype";
import { notifyPhone } from "../src/lib/genesis-news/notify";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Subjects each page always needs footage for. Chiefs first on Genesis News. */
const SUBJECTS: Record<string, string[]> = {
  genesis_news: [
    "Kaizer Chiefs goals", "Kaizer Chiefs highlights", "Kaizer Chiefs skills", "Kaizer Chiefs fans",
    "Amakhosi Kaizer Chiefs", "Kaizer Chiefs vs Orlando Pirates", "Kaizer Chiefs vs Mamelodi Sundowns",
    "Bafana Bafana goals", "Bafana Bafana highlights", "Bafana Bafana fans",
    "Orlando Pirates goals", "Mamelodi Sundowns goals", "Soweto Derby highlights",
    "Betway Premiership highlights", "PSL best goals", "DStv Premiership goals", "FNB Stadium",
    "South African football skills", "Carling Knockout highlights", "Nedbank Cup highlights",
  ],
  mzansi_daily_news: [
    "South Africa drone", "Johannesburg city", "Cape Town drone", "Durban beach", "Soweto streets",
    "Kruger National Park wildlife", "South Africa thunderstorm", "South Africa township life",
    "Table Mountain", "South Africa road trip", "Pretoria city", "South Africa protest",
    "South African food", "Drakensberg", "Garden Route",
  ],
  pawsome_daily: [
    "funny dogs", "funny cats", "cute puppies", "dog rescue", "cat rescue", "animals acting like humans",
    "dog reunion with owner", "funny animals compilation", "smart dog tricks", "cute kittens",
  ],
};

(async () => {
  const pages = arg("page") ? [arg("page")!] : Object.keys(SUBJECTS);
  const maxNew = Number(arg("max") || 12);
  const summary: string[] = [];
  for (const page of pages) {
    const file = libraryFile(page);
    const lib: Record<string, HypeClip & { harvested?: string }> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    const avoid = [...Object.keys(lib), ...readBlocklist()];
    // A different slice of the subject list each night, so the whole list
    // is covered every few days without a long run.
    const day = Math.floor(Date.now() / 86_400_000);
    const subjects = SUBJECTS[page].map((s, i) => ({ s, k: (i + day * 5) % SUBJECTS[page].length })).sort((a, b) => a.k - b.k).slice(0, 6).map((x) => x.s);
    const found: HypeClip[] = [];
    for (const s of subjects) {
      if (found.length >= maxNew) break;
      try {
        const got = await findClips([s], 3, { avoid: [...avoid, ...found.map((c) => c.id)], quotaFree: true });
        found.push(...got.filter((c) => c.durationSec >= 30 && c.durationSec <= 15 * 60));
      } catch (e) {
        console.log(`[harvest] ${page} "${s}": ${(e as Error).message.slice(0, 120)}`);
      }
    }
    const batch = found.slice(0, maxNew);
    console.log(`[harvest] ${page}: ${batch.length} new Creative Commons clips to check`);
    let added = 0;
    // Small batches: the service downloads a batch in parallel.
    for (let i = 0; i < batch.length; i += 3) {
      try {
        const ready = await prepareClips(batch.slice(i, i + 3), (s) => console.log(`[harvest] ${s}`));
        const clean = await smartCrop(ready.filter((c) => c.creator), (s) => console.log(`[harvest] ${s}`));
        for (const c of clean) {
          lib[c.id] = { ...c, sheets: undefined, harvested: new Date().toISOString() };
          added++;
        }
        fs.writeFileSync(file, JSON.stringify(lib, null, 1));
      } catch (e) {
        console.log(`[harvest] batch failed: ${(e as Error).message.slice(0, 160)}`);
      }
    }
    const line = `${page}: +${added} clips (library ${Object.keys(lib).length})`;
    console.log(`[harvest] ${line}`);
    summary.push(line);
  }
  await notifyPhone("Footage library grew overnight", summary.join("\n"), { priority: 1, tags: "film_frames" });
})().catch(async (e) => {
  console.error("FAILED:", (e as Error).message);
  await notifyPhone("Footage harvest FAILED", (e as Error).message.slice(0, 400), { priority: 3, tags: "warning" });
  process.exit(1);
});
