// Permanent page tokens for EVERY page the owner controls, from one user token.
//
//   1. Graph API Explorer, logged in as the account that controls the pages
//      (or a Business Manager admin): Get User Access Token with
//      pages_show_list, pages_manage_posts, pages_manage_metadata,
//      pages_read_engagement, read_insights, business_management.
//   2. npx dotenv-cli -e .env.local -- npx tsx scripts/fb-all-page-tokens.ts <USER_TOKEN>
//
// It exchanges the token for a long-lived one (FB_APP_SECRET + the app id
// read from the token itself), lists every page — direct roles AND pages
// owned by / shared with the user's businesses — fetches each page's token
// (a page token minted from a long-lived user token does not expire) and
// writes them to .env.local. An existing FB_PAGE_TOKEN_* key that already
// belongs to a page is updated in place; new pages get
// FB_PAGE_TOKEN_<slug of page name>. Tokens are never printed.

import fs from "node:fs";
import path from "node:path";

const G = "https://graph.facebook.com/v25.0";
const ENV = path.join(process.cwd(), ".env.local");

async function get<T>(url: string): Promise<T> {
  const j = (await (await fetch(url)).json()) as T & { error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

(async () => {
  const input = process.argv[2] || process.env.FB_OWNER_USER_TOKEN;
  if (!input) throw new Error("pass the user token as the first argument");
  const secret = process.env.FB_APP_SECRET;

  // 1. long-lived user token
  const dbg = await get<{ data: { app_id: string; type: string; expires_at: number; scopes: string[] } }>(
    `${G}/debug_token?input_token=${input}&access_token=${input}`
  );
  if (dbg.data.type !== "USER") throw new Error(`that is a ${dbg.data.type} token — a USER token is needed`);
  let user = input;
  if (secret && dbg.data.expires_at !== 0) {
    const ex = await get<{ access_token: string }>(
      `${G}/oauth/access_token?grant_type=fb_exchange_token&client_id=${dbg.data.app_id}&client_secret=${secret}&fb_exchange_token=${input}`
    );
    user = ex.access_token;
  }
  const scopes = dbg.data.scopes;
  const missing = ["pages_show_list", "pages_manage_posts", "pages_manage_metadata", "pages_read_engagement", "read_insights", "business_management"].filter((s) => !scopes.includes(s));
  const me = await get<{ name: string }>(`${G}/me?fields=name&access_token=${user}`);
  console.log(`user: ${me.name}${missing.length ? `  (missing scopes: ${missing.join(", ")})` : ""}`);

  // 2. every page: direct roles + business-owned + business client pages
  const pages = new Map<string, { name: string; token?: string; via: string }>();
  let url: string | null = `${G}/me/accounts?fields=id,name,access_token&limit=100&access_token=${user}`;
  while (url) {
    const r: { data: { id: string; name: string; access_token: string }[]; paging?: { next?: string } } = await get(url);
    for (const p of r.data) pages.set(p.id, { name: p.name, token: p.access_token, via: "direct" });
    url = r.paging?.next ?? null;
  }
  try {
    const biz = await get<{ data: { id: string; name: string }[] }>(`${G}/me/businesses?fields=id,name&access_token=${user}`);
    for (const b of biz.data) {
      for (const edge of ["owned_pages", "client_pages"]) {
        try {
          const r = await get<{ data: { id: string; name: string; access_token?: string }[] }>(`${G}/${b.id}/${edge}?fields=id,name,access_token&limit=100&access_token=${user}`);
          for (const p of r.data) if (!pages.has(p.id)) pages.set(p.id, { name: p.name, token: p.access_token, via: `${b.name} (${edge})` });
        } catch {}
      }
    }
  } catch (e) {
    console.log(`businesses: ${(e as Error).message}`);
  }
  for (const [id, p] of pages) {
    if (p.token) continue;
    try {
      p.token = (await get<{ access_token?: string }>(`${G}/${id}?fields=access_token&access_token=${user}`)).access_token;
    } catch {}
  }

  // 3. match to existing env keys by page id, else a new key
  let env = fs.readFileSync(ENV, "utf8");
  const existing = new Map<string, string>();
  for (const m of env.matchAll(/^(FB_PAGE_TOKEN_[A-Za-z0-9_]+)=(.+)$/gm)) {
    try {
      const j = await get<{ id: string }>(`${G}/me?fields=id&access_token=${m[2].trim().replace(/^"|"$/g, "")}`);
      if (!existing.has(j.id)) existing.set(j.id, m[1]);
    } catch {}
  }
  const setKey = (key: string, val: string) => {
    const re = new RegExp(`^${key}=.*$`, "m");
    env = re.test(env) ? env.replace(re, `${key}=${val}`) : `${env.trimEnd()}\n${key}=${val}\n`;
  };
  setKey("FB_OWNER_USER_TOKEN", user);
  console.log("\npage | id | env key | via");
  for (const [id, p] of pages) {
    if (!p.token) {
      console.log(`${p.name} | ${id} | (no token — no page task for this user) | ${p.via}`);
      continue;
    }
    const key = existing.get(id) || `FB_PAGE_TOKEN_${slug(p.name)}`;
    setKey(key, p.token);
    console.log(`${p.name} | ${id} | ${key} | ${p.via}`);
  }
  fs.writeFileSync(ENV, env);
  console.log(`\n${pages.size} pages; tokens written to .env.local (never printed).`);
})().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
