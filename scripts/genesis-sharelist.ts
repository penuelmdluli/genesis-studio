// Daily share list (Task Scheduler: "Genesis Share List", 08:00).
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-sharelist.ts
//
// Automated posting into Facebook groups is not possible through the API and
// scripted group drops get pages restricted, so the last step stays human:
// this picks each page's best reel from the last day, finds public groups
// where it genuinely fits (claude CLI + web search) and writes a different,
// non-spammy message for each. Output: GENESIS_WORK_DIR/reports/share-<date>.md
// — open it on the phone, share as the page/profile, ~2 minutes.

import fs from "node:fs";
import path from "node:path";
import { runClaude } from "../src/lib/genesis-news/claude-cli";
import { PAGES } from "../src/lib/genesis-news/pages";

const WORK = process.env.GENESIS_WORK_DIR || ".";
const day = new Date().toISOString().slice(0, 10);

interface Row { at: string; page: string; title: string; topic: string; videoUrl: string; published: boolean; videoId?: string; youtubeId?: string | null }

(async () => {
  const rows: Row[] = (() => {
    try {
      return fs.readFileSync(path.join(WORK, "reels", "ledger.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  })();
  const since = Date.now() - 36 * 3_600_000;

  // Each page's newest posted reel from the last 36 hours.
  const picks = Object.keys(PAGES)
    .map((page) => rows.filter((r) => r.page === page && r.published && r.videoId && Date.parse(r.at) > since)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0])
    .filter((r): r is Row => Boolean(r));

  if (!picks.length) {
    const out = path.join(WORK, "reports", `share-${day}.md`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `# Share list — ${day}\n\nNo reel was posted in the last 36 hours, so nothing to share today.\n`);
    return console.log(`saved ${out} (nothing posted recently)`);
  }

  const brief = picks
    .map((r) => `- Page "${PAGES[r.page].name}" — reel "${r.title}" (topic: ${r.topic}). Facebook: https://www.facebook.com/reel/${r.videoId}${r.youtubeId ? ` · YouTube: https://youtube.com/shorts/${r.youtubeId}` : ""}`)
    .join("\n");

  const prompt = `Today is ${day}. The owner shares their pages' best reels into relevant PUBLIC Facebook groups by hand each morning (about 2 minutes). Build today's list.

Reels to share:
${brief}

For EACH reel:
1. Use web search to find 6-8 public Facebook groups where this reel genuinely fits the group's topic (South African football fan groups for football reels — Kaizer Chiefs / Amakhosi fans, PSL fans, Bafana supporters; South African travel, nature, "proudly South African", Mzansi community groups for the Mzansi Daily News reels). Only list a group if you found its facebook.com/groups/... URL in your results. Include the member count if the result shows it. Prefer large, active groups. Never list a group about something unrelated.
2. For each group write a SHORT share message (1-2 lines) in a fan's/community member's voice that fits that group — each one different, no hashtags spam, no "follow our page" begging, no ALL CAPS. A question that invites replies works best ("Which one was your favourite?").
3. YOUR PROFILE: pick the single best reel of all of them and write a short personal caption (1-2 lines, first person, warm, proudly South African, no hashtag spam) for the owner to share it from the page to their own personal profile. Put it first, under "## Share to your profile".
4. Add one line of advice: share as the page where groups allow it, otherwise from the owner's profile; skip any group whose rules forbid video links; no more than ~10 groups a day in total so it never looks like spam.

Reply in Markdown, ready to read on a phone:
## <page> — <reel title>
<reel link>
1. **<group name>** (<members>) — <group url>
   > <message>
...
Keep it tight. No preamble.`;

  const md = await runClaude(prompt, { tools: ["WebSearch", "WebFetch"], timeoutMs: 10 * 60_000 });
  const out = path.join(WORK, "reports", `share-${day}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `# Share list — ${day}\n\n${md.trim()}\n`);
  console.log(`saved ${out}\n\n${md}`);
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
