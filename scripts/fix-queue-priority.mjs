/**
 * One-shot queue cleanup:
 * 1. Cancel all PENDING items on tech_pulse_africa_dev that are NOT from
 *    our 'ai-apocalypse-pulse' seed (NewsAPI / Reddit / etc source a lot of
 *    tangential topics tagged ai_disruption — like "Marjorie Taylor Greene").
 * 2. Boost niche_score on seed items to 50+ so they beat future NewsAPI scores.
 * 3. Cancel the current off-topic GENERATING production so it doesn't post.
 */
import fs from "node:fs";
import path from "node:path";

const envText = fs.readFileSync(path.resolve(".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// 1. Cancel all PENDING that are NOT from ai-apocalypse-pulse seed
const allPending = await sb(
  `/rest/v1/dev_content_queue?page_id=eq.tech_pulse_africa_dev&status=eq.pending&select=id,input_data`
);
const offTheme = allPending.filter((r) => (r.input_data?.provider || "") !== "ai-apocalypse-pulse");
console.log(`Pending on tech_pulse_africa_dev: ${allPending.length}`);
console.log(`  Off-theme (non-seed): ${offTheme.length}`);
console.log(`  Seed (ai-apocalypse-pulse): ${allPending.length - offTheme.length}`);

if (offTheme.length > 0) {
  const ids = offTheme.map((r) => r.id);
  await sb(
    `/rest/v1/dev_content_queue?id=in.(${ids.join(",")})`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  console.log(`✅ Cancelled ${offTheme.length} off-theme pending items`);
}

// 2. Boost niche_score on seed items to 50-60 so they always beat NewsAPI (30-40).
// Existing niche_score 10 → 60, 9 → 58, 8 → 56, 7 → 54.
const seeds = allPending.filter((r) => (r.input_data?.provider || "") === "ai-apocalypse-pulse");
for (const row of seeds) {
  const oldScore = row.input_data?.niche_score || 0;
  const newScore = 50 + oldScore; // 7 → 57, 10 → 60
  const newInput = { ...row.input_data, niche_score: newScore };
  await sb(
    `/rest/v1/dev_content_queue?id=eq.${row.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ input_data: newInput }),
    }
  );
}
console.log(`✅ Boosted niche_score on ${seeds.length} seed items (+50)`);

// 3. Cancel the current off-topic generating production
const gen = await sb(
  `/rest/v1/dev_content_queue?page_id=eq.tech_pulse_africa_dev&status=eq.generating&select=id,input_data`
);
const offGenerating = gen.filter((r) => (r.input_data?.provider || "") !== "ai-apocalypse-pulse");
if (offGenerating.length > 0) {
  const ids = offGenerating.map((r) => r.id);
  await sb(
    `/rest/v1/dev_content_queue?id=in.(${ids.join(",")})`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  console.log(`✅ Cancelled ${offGenerating.length} off-topic running production(s):`);
  for (const r of offGenerating) {
    console.log(`     - "${(r.input_data?.topic_title || "").slice(0, 70)}"`);
  }

  // Also mark the underlying productions as cancelled so recover-scenes doesn't try to post them.
  for (const r of offGenerating) {
    const pid = r.input_data?.production_id;
    if (!pid) continue;
    try {
      await sb(
        `/rest/v1/productions?id=eq.${pid}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", error_message: "Off-topic for new AI-apocalypse strategy" }),
        }
      );
      console.log(`     ✅ production ${pid.substring(0, 8)} marked cancelled`);
    } catch (e) {
      console.log(`     ⚠ couldn't cancel production ${pid.substring(0, 8)}: ${e.message}`);
    }
  }
}

console.log("\n✅ Queue now cleaned and prioritised. Seed items will beat NewsAPI on the next produce cycle.");
