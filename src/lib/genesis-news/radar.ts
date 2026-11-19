// ============================================
// Trending radar — what South Africa is watching right now
// ============================================
// Facebook does not let an app read other pages' posts (that needs Page
// Public Content Access), and logged-in scraping is how accounts get banned.
// The same signal is public elsewhere, so the picker gets it from:
//   1. Google Trends daily searches, ZA (traffic numbers)
//   2. YouTube's most-popular chart, ZA (1 quota unit)
//   3. Google News ZA, per the page's own queries
//   4. our own page's best recent reels (metrics scoreboard)
// We take TOPICS from these, never footage: the reel is still built from
// Creative Commons clips.

import fs from "node:fs";
import path from "node:path";
import type { PageProfile } from "./pages";

const UA = { "User-Agent": "Mozilla/5.0 (genesis-news radar)" };

export interface RadarItem { source: "trends" | "youtube" | "news" | "ours"; title: string; signal: string; url?: string }

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

async function googleTrends(match: RegExp | null): Promise<RadarItem[]> {
  const xml = await (await fetch("https://trends.google.com/trending/rss?geo=ZA", { headers: UA })).text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => ({
      title: decode(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""),
      traffic: m[1].match(/<ht:approx_traffic>([^<]+)/)?.[1] || "",
      news: decode(m[1].match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] || ""),
    }))
    .filter((t) => t.title && (!match || match.test(`${t.title} ${t.news}`)))
    .slice(0, 12)
    .map((t) => ({ source: "trends" as const, title: t.title, signal: `${t.traffic} searches${t.news ? ` — "${t.news}"` : ""}` }));
}

async function youtubeChart(category: string): Promise<RadarItem[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const qs = new URLSearchParams({ part: "snippet,statistics", chart: "mostPopular", regionCode: "ZA", maxResults: "15", key });
  if (category) qs.set("videoCategoryId", category);
  const j = (await (await fetch(`https://www.googleapis.com/youtube/v3/videos?${qs}`)).json()) as {
    items?: { id: string; snippet: { title: string; channelTitle: string }; statistics: { viewCount?: string } }[];
  };
  return (j.items || []).map((v) => ({
    source: "youtube" as const,
    title: v.snippet.title,
    signal: `${Number(v.statistics.viewCount || 0).toLocaleString("en-ZA")} views · ${v.snippet.channelTitle}`,
    url: `https://youtu.be/${v.id}`,
  }));
}

async function googleNews(queries: string[]): Promise<RadarItem[]> {
  const out: RadarItem[] = [];
  for (const q of queries) {
    const xml = await (await fetch(`https://news.google.com/rss/search?${new URLSearchParams({ q: `${q} when:2d`, hl: "en-ZA", gl: "ZA", ceid: "ZA:en" })}`, { headers: UA })).text();
    for (const m of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 4)) {
      const title = decode(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const when = m[1].match(/<pubDate>([^<]+)/)?.[1] || "";
      if (title) out.push({ source: "news", title, signal: `${q} · ${when.slice(5, 22)}` });
    }
  }
  return out;
}

function ourBest(pageKey: string): RadarItem[] {
  const f = path.join(process.env.GENESIS_WORK_DIR || ".", "metrics", `latest-${pageKey}.md`);
  if (!fs.existsSync(f)) return [];
  const top = fs.readFileSync(f, "utf8").split("## Top reels")[1] || "";
  return top
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .slice(0, 5)
    .map((l) => ({ source: "ours" as const, title: l.slice(2).split(" · ").pop() || "", signal: l.slice(2).split(" · ").slice(0, 3).join(" · ") }));
}

/** Everything the radar sees for one page. Each source fails soft. */
export async function scanRadar(page: PageProfile): Promise<RadarItem[]> {
  const parts = await Promise.allSettled([
    googleTrends(page.radar.trendsMatch),
    youtubeChart(page.radar.ytCategory),
    googleNews(page.radar.newsQueries),
    Promise.resolve(ourBest(page.key)),
  ]);
  const items = parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  const dir = path.join(process.env.GENESIS_WORK_DIR || ".", "radar");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${page.key}-${new Date().toISOString().slice(0, 13)}.json`), JSON.stringify(items, null, 1));
  return items;
}

/** The radar as a prompt block for the picker. */
export function radarBrief(items: RadarItem[]): string {
  if (!items.length) return "";
  const block = (src: RadarItem["source"], head: string) => {
    const xs = items.filter((i) => i.source === src);
    return xs.length ? `${head}\n${xs.map((i) => `- ${i.title} (${i.signal})`).join("\n")}` : "";
  };
  return [
    "TRENDING RADAR — what South Africa is searching, watching and reading right now. Use it to choose a topic people are already talking about; it is a signal, not footage (we never reuse these videos):",
    block("trends", "Google searches in SA today:"),
    block("youtube", "Most-watched on YouTube in SA:"),
    block("news", "Latest SA headlines for this page:"),
    block("ours", "This page's own best recent reels:"),
  ].filter(Boolean).join("\n\n");
}
