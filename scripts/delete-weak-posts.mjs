/**
 * One-shot cleanup: delete low-quality / duplicate posts from
 * Tech Pulse Africa (page 100919755007786).
 *
 * Usage:
 *   node scripts/delete-weak-posts.mjs           # dry-run (lists)
 *   node scripts/delete-weak-posts.mjs --yes     # actually deletes
 *
 * Reads FB_PAGE_TOKEN_tech_news from .env.local.
 */

import fs from "node:fs";
import path from "node:path";

const DRY_RUN = !process.argv.includes("--yes");

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const token = env.FB_PAGE_TOKEN_tech_news;
if (!token) {
  console.error("❌ FB_PAGE_TOKEN_tech_news not found in .env.local");
  process.exit(1);
}

// The 6 posts to delete. Reasoning in comment next to each.
const targets = [
  { id: "1435121598627606", reason: "duplicate: AI jobs SA (#3 of 4)" },
  { id: "1435121878627578", reason: "duplicate: AI jobs SA (#4 of 4)" },
  { id: "1435122311960868", reason: "duplicate: AI jobs SA (#2 of 4)" },
  { id: "1435312981941801", reason: "duplicate: Artemis II (reposted)" },
  { id: "1435120218627744", reason: "off-theme: Call of Duty gaming news" },
  { id: "1435121075294325", reason: "off-theme: Valve Steam Link / Vision Pro" },
];

console.log(`${DRY_RUN ? "🔍 DRY RUN" : "🗑️  LIVE DELETE"} — ${targets.length} posts`);
console.log("");

const PAGE_ID = "100919755007786"; // Tech Pulse Africa

// For Reels, FB's singular-statuses delete (DELETE /{video_id}) is deprecated.
// The working approach: try several ID forms until one succeeds.
async function deletePost(videoId) {
  const attempts = [
    // Canonical post ID = {pageId}_{videoId}
    `${PAGE_ID}_${videoId}`,
    // Fallback: just the video ID (still valid for some video types)
    videoId,
  ];

  for (const id of attempts) {
    const url = `https://graph.facebook.com/v19.0/${id}?access_token=${encodeURIComponent(token)}`;
    try {
      const res = await fetch(url, { method: "DELETE" });
      const text = await res.text();
      if (res.ok) return { ok: true, id, body: text };
      // If permission-denied or doesn't-exist, try next form
      const parsed = JSON.parse(text);
      const code = parsed?.error?.code;
      // Stop on auth errors (no point trying other forms)
      if (code === 190 || code === 200) return { ok: false, id, body: text };
    } catch (err) {
      // Network error — try next form
    }
  }
  // All attempts failed — return last
  return { ok: false, id: attempts[attempts.length - 1], body: "all attempts failed" };
}

for (const t of targets) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would DELETE ${t.id} — ${t.reason}`);
    continue;
  }

  const result = await deletePost(t.id);
  if (result.ok) {
    console.log(`  ✅ ${t.id} (${result.id}) — deleted (${t.reason})`);
  } else {
    console.log(`  ❌ ${t.id} — ${result.body.slice(0, 220)}`);
  }

  // Gentle 1s pacing to avoid rate limits
  await new Promise((r) => setTimeout(r, 1000));
}

console.log("");
if (DRY_RUN) {
  console.log("Re-run with --yes to actually delete.");
}
