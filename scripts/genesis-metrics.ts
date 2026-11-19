// Genesis News reel scoreboard: how the hype reels do against everything
// else the page posts. Run daily by Task Scheduler (scripts/run_genesis_metrics.cmd).
//
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.json scripts/genesis-metrics.ts [--page genesis_news] [--days 14]
//
// Appends one snapshot row per reel to GENESIS_WORK_DIR/metrics/snapshots.jsonl
// (so growth over 1h/24h/72h can be read later) and writes metrics/latest.md,
// a plain scoreboard: hype reels vs the page's other reels, per format.

import fs from "node:fs";
import path from "node:path";
import { FACEBOOK_PAGES, pageToken } from "../src/lib/facebook-reels";

const GRAPH = "https://graph.facebook.com/v25.0";
const WORK = process.env.GENESIS_WORK_DIR || ".";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

interface Snap {
  at: string;
  page: string;
  videoId: string;
  created: string;
  ageHours: number;
  ours: boolean;
  format: string;
  title: string;
  plays: number;
  avgWatchSec: number;
  viewTimeSec: number;
  reactions: number;
  comments: number;
  shares: number;
  followers: number;
  retention3s: number | null;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const j = (await res.json()) as T & { error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j;
}

(async () => {
  const page = arg("page") || "genesis_news";
  const days = Number(arg("days") || 14);
  const token = pageToken(page);
  if (!token) throw new Error(`no token for ${page}`);
  const pageId = FACEBOOK_PAGES[page]?.pageId || (await get<{ id: string }>(`${GRAPH}/me?fields=id&access_token=${token}`)).id;

  const ledger: { videoId?: string; format: string; title: string }[] = (() => {
    try {
      return fs.readFileSync(path.join(WORK, "reels", "ledger.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  })();
  const ours = new Map(ledger.filter((r) => r.videoId).map((r) => [r.videoId!, r]));

  const since = Date.now() - days * 86_400_000;
  const reels: { id: string; description?: string; created_time: string }[] = [];
  let url: string | null = `${GRAPH}/${pageId}/video_reels?fields=id,description,created_time&limit=50&access_token=${token}`;
  while (url) {
    const r: { data: typeof reels; paging?: { next?: string } } = await get(url);
    reels.push(...r.data);
    const oldest = r.data.at(-1);
    url = oldest && Date.parse(oldest.created_time) > since ? r.paging?.next ?? null : null;
  }

  const now = new Date().toISOString();
  const snaps: Snap[] = [];
  for (const v of reels.filter((x) => Date.parse(x.created_time) > since)) {
    let m: Record<string, unknown> = {};
    try {
      const ins = await get<{ data: { name: string; values: { value: unknown }[] }[] }>(`${GRAPH}/${v.id}/video_insights?access_token=${token}`);
      m = Object.fromEntries(ins.data.map((d) => [d.name, d.values?.[0]?.value]));
    } catch (e) {
      console.warn(`insights ${v.id}: ${(e as Error).message}`);
    }
    const n = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : 0);
    const obj = (k: string) => (m[k] && typeof m[k] === "object" ? (m[k] as Record<string, number>) : {});
    const mine = ours.get(v.id);
    const firstLine = (v.description || "").split("\n")[0].slice(0, 60);
    snaps.push({
      at: now, page, videoId: v.id, created: v.created_time,
      ageHours: Math.round((Date.now() - Date.parse(v.created_time)) / 3_600_000),
      ours: Boolean(mine),
      format: mine?.format || "other",
      title: mine?.title || firstLine,
      plays: n("fb_reels_total_plays") || n("blue_reels_play_count"),
      avgWatchSec: Math.round(n("post_video_avg_time_watched") / 100) / 10,
      viewTimeSec: Math.round(n("post_video_view_time") / 1000),
      reactions: Object.values(obj("post_video_likes_by_reaction_type")).reduce((a, b) => a + b, 0),
      comments: obj("post_video_social_actions").COMMENT || 0,
      shares: obj("post_video_social_actions").SHARE || 0,
      followers: n("post_video_followers"),
      retention3s: (obj("post_video_retention_graph")["3"] as number | undefined) ?? null,
    });
  }

  const dir = path.join(WORK, "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "snapshots.jsonl"), snaps.map((s) => JSON.stringify(s)).join("\n") + (snaps.length ? "\n" : ""));

  // Scoreboard. Only reels at least 24h old are compared, so a reel posted
  // an hour ago does not drag its group down.
  const settled = snaps.filter((s) => s.ageHours >= 24);
  const groups = new Map<string, Snap[]>();
  for (const s of settled) {
    const key = s.ours ? `hype:${s.format}` : "other reels";
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const rows = [...groups.entries()]
    .map(([k, xs]) => ({ k, n: xs.length, plays: avg(xs.map((x) => x.plays)), watch: avg(xs.map((x) => x.avgWatchSec)), eng: avg(xs.map((x) => x.reactions + x.comments + x.shares)), fol: xs.reduce((a, x) => a + x.followers, 0) }))
    .sort((a, b) => b.plays - a.plays);
  const top = [...snaps].sort((a, b) => b.plays - a.plays).slice(0, 8);
  const md = [
    `# ${page} reel scoreboard — ${now.slice(0, 16).replace("T", " ")} UTC (last ${days} days)`,
    "",
    "| group | reels (24h+) | avg plays | avg watch (s) | avg reactions+comments+shares | followers gained |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.k} | ${r.n} | ${Math.round(r.plays)} | ${r.watch.toFixed(1)} | ${r.eng.toFixed(1)} | ${r.fol} |`),
    "",
    "## Top reels",
    ...top.map((s) => `- ${s.plays} plays · ${s.avgWatchSec}s avg watch · ${s.reactions + s.comments + s.shares} eng · ${s.ours ? `HYPE/${s.format}` : "other"} · ${s.title} (${s.ageHours}h old)`),
  ].join("\n");
  fs.writeFileSync(path.join(dir, `latest-${page}.md`), md);
  console.log(md);
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
