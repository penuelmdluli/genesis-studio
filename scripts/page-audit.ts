// Read-only history of a Facebook page: what grew it, when it died, what posts now.
//
//   npx dotenv-cli -e .env.local -- npx tsx scripts/page-audit.ts FB_PAGE_TOKEN_tech_news [more token env names...]
//
// Writes GENESIS_WORK_DIR/audits/<page-name>.json (every post + reel with
// engagement/plays) and prints a compact summary: profile, posts per month
// with average engagement, the top 12 posts ever, reels per month with
// average plays, the last 8 posts (what is posting now) and their times.

import fs from "node:fs";
import path from "node:path";

const G = "https://graph.facebook.com/v25.0";
const WORK = process.env.GENESIS_WORK_DIR || ".";

async function get<T>(url: string): Promise<T> {
  const j = (await (await fetch(url)).json()) as T & { error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j;
}

async function audit(tokenEnv: string) {
  const T = process.env[tokenEnv];
  if (!T) return console.log(`\n### ${tokenEnv}: not set`);
  const p = await get<{ id: string; name: string; username?: string; about?: string; category?: string; followers_count?: number }>(
    `${G}/me?fields=id,name,username,about,category,followers_count&access_token=${T}`
  );

  const posts: { at: string; type: string; eng: number; shares: number; msg: string }[] = [];
  let url: string | null = `${G}/${p.id}/published_posts?fields=created_time,message,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&limit=100&access_token=${T}`;
  while (url && posts.length < 4000) {
    const r: { data: any[]; paging?: { next?: string } } = await get(url);
    for (const x of r.data)
      posts.push({
        at: x.created_time, type: x.status_type || "",
        eng: (x.reactions?.summary?.total_count || 0) + (x.comments?.summary?.total_count || 0) + (x.shares?.count || 0),
        shares: x.shares?.count || 0, msg: String(x.message || "").replace(/\s+/g, " ").slice(0, 100),
      });
    url = r.paging?.next ?? null;
  }

  const reels: { at: string; plays: number; fol: number; msg: string }[] = [];
  try {
    let ru: string | null = `${G}/${p.id}/video_reels?fields=id,description,created_time&limit=100&access_token=${T}`;
    const raw: any[] = [];
    while (ru && raw.length < 300) {
      const r: { data: any[]; paging?: { next?: string } } = await get(ru);
      raw.push(...r.data);
      ru = r.paging?.next ?? null;
    }
    for (const v of raw) {
      let m: Record<string, number> = {};
      try {
        const i = await get<{ data: { name: string; values: { value: number }[] }[] }>(`${G}/${v.id}/video_insights?metric=fb_reels_total_plays,post_video_followers&access_token=${T}`);
        m = Object.fromEntries(i.data.map((d) => [d.name, d.values?.[0]?.value ?? 0]));
      } catch {}
      reels.push({ at: v.created_time, plays: m.fb_reels_total_plays || 0, fol: m.post_video_followers || 0, msg: String(v.description || "").replace(/\s+/g, " ").slice(0, 80) });
    }
  } catch {}

  fs.mkdirSync(path.join(WORK, "audits"), { recursive: true });
  fs.writeFileSync(path.join(WORK, "audits", `${p.name.trim().replace(/\W+/g, "_")}.json`), JSON.stringify({ profile: p, posts, reels }, null, 1));

  const month = <X extends { at: string }>(xs: X[], val: (x: X) => number) => {
    const m: Record<string, { n: number; v: number }> = {};
    for (const x of xs) {
      const k = x.at.slice(0, 7);
      m[k] = m[k] || { n: 0, v: 0 };
      m[k].n++;
      m[k].v += val(x);
    }
    return Object.entries(m).sort().map(([k, v]) => `${k} ${String(v.n).padStart(4)} ${String(Math.round(v.v / v.n)).padStart(7)}`);
  };
  console.log(`\n### ${p.name} (@${p.username || "-"}) — ${p.followers_count} followers — ${p.category}\nabout: ${(p.about || "").slice(0, 160)}`);
  console.log(`posts ${posts.length} (oldest ${posts.at(-1)?.at.slice(0, 10)}), reels ${reels.length}`);
  console.log("POSTS month n avg-eng\n" + month(posts, (x) => x.eng).join("\n"));
  console.log("TOP 12 POSTS EVER");
  for (const x of [...posts].sort((a, b) => b.eng - a.eng).slice(0, 12)) console.log(`  ${x.eng} eng ${x.shares} sh ${x.at.slice(0, 10)} ${x.type} | ${x.msg}`);
  if (reels.length) console.log("REELS month n avg-plays\n" + month(reels, (x) => x.plays).join("\n"));
  console.log("LAST 8 POSTS (what posts now)");
  for (const x of posts.slice(0, 8)) console.log(`  ${x.at.slice(0, 16)} ${x.eng} eng | ${x.msg.slice(0, 80)}`);
}

(async () => {
  for (const t of process.argv.slice(2)) {
    try {
      await audit(t);
    } catch (e) {
      console.log(`\n### ${t}: FAILED ${(e as Error).message}`);
    }
  }
})();
