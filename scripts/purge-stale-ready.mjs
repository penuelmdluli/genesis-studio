/**
 * One-shot cleanup: demote queue items stuck in status="ready" whose
 * underlying production is actually failed/cancelled. These jam handlePost's
 * round-robin selection and prevent fresh content from being posted.
 *
 * Usage:
 *   node scripts/purge-stale-ready.mjs            # dry-run
 *   node scripts/purge-stale-ready.mjs --yes      # apply
 */
import fs from "node:fs";

const DRY_RUN = !process.argv.includes("--yes");

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, init = {}) {
  const r = await fetch(`${SUPA}${path}`, {
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

// 1. Fetch all ready queue items
const ready = await sb(
  `/rest/v1/dev_content_queue?status=eq.ready&select=id,input_data,generated_at,page_id`
);
console.log(`Total ready items: ${ready.length}`);

// 2. Batch-fetch production statuses
const pids = [
  ...new Set(
    ready
      .map((r) => r.input_data?.production_id)
      .filter((x) => typeof x === "string" && x.length > 0)
  ),
];
const productionStatus = {}; // pid -> { status, hasFinal }
if (pids.length > 0) {
  // Supabase IN filter — batch in groups of 100 to avoid URL length limits
  const BATCH = 100;
  for (let i = 0; i < pids.length; i += BATCH) {
    const batch = pids.slice(i, i + BATCH);
    const rows = await sb(
      `/rest/v1/productions?id=in.(${batch.join(",")})&select=id,status,output_video_urls`
    );
    for (const p of rows) {
      let hasFinal = false;
      try {
        const urls =
          typeof p.output_video_urls === "string"
            ? JSON.parse(p.output_video_urls)
            : p.output_video_urls || {};
        hasFinal = !!(urls?.final || Object.keys(urls || {}).length > 0);
      } catch {
        /* ignore */
      }
      productionStatus[p.id] = { status: p.status, hasFinal };
    }
  }
}

// 3. Classify
const toDemote = []; // stale ready → failed
const toKeep = []; // production completed + hasFinal
const noProd = []; // missing production_id or prod record not found

for (const row of ready) {
  const pid = row.input_data?.production_id;
  if (!pid) {
    noProd.push(row);
    continue;
  }
  const ps = productionStatus[pid];
  if (!ps) {
    noProd.push(row);
    continue;
  }
  if (ps.status === "failed" || ps.status === "cancelled") {
    toDemote.push({ row, reason: `production ${ps.status}` });
  } else if (ps.status === "completed" && ps.hasFinal) {
    toKeep.push(row);
  } else if (ps.status === "completed" && !ps.hasFinal) {
    toDemote.push({ row, reason: "completed but no output_video_urls" });
  }
  // generating / assembling → leave alone
}

console.log(`\nClassification:`);
console.log(`  Keep (ready, actually completed):  ${toKeep.length}`);
console.log(`  Demote (stale, prod failed/cxl):  ${toDemote.length}`);
console.log(`  No prod record / orphan ready:    ${noProd.length}`);

if (DRY_RUN) {
  console.log("\n[dry-run] sample demotions:");
  for (const { row, reason } of toDemote.slice(0, 10)) {
    console.log(
      `  - ${row.id.slice(0, 8)} | ${reason} | "${(row.input_data?.topic_title || "").slice(0, 60)}"`
    );
  }
  console.log("\nRe-run with --yes to apply.");
  process.exit(0);
}

// 4. Apply — mark stale as failed
const ids = toDemote.map((d) => d.row.id);
if (ids.length > 0) {
  // Batch of 80 to avoid URL limit
  const BATCH = 80;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await sb(`/rest/v1/dev_content_queue?id=in.(${batch.join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error_message: "Stale ready item auto-purged (production was failed/cancelled)",
      }),
    });
  }
  console.log(`✅ Demoted ${ids.length} stale ready items to failed`);
}

// 5. Also mark orphan items (no prod record) as failed
const orphanIds = noProd.map((r) => r.id);
if (orphanIds.length > 0) {
  const BATCH = 80;
  for (let i = 0; i < orphanIds.length; i += BATCH) {
    const batch = orphanIds.slice(i, i + BATCH);
    await sb(`/rest/v1/dev_content_queue?id=in.(${batch.join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error_message: "Orphan ready item auto-purged (no production record)",
      }),
    });
  }
  console.log(`✅ Marked ${orphanIds.length} orphan ready items as failed`);
}

console.log(`\nhandlePost will now cleanly pick from ${toKeep.length} genuinely ready items.`);
