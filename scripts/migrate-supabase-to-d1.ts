#!/usr/bin/env npx tsx
// ============================================
// GENESIS STUDIO — Supabase → D1 Data Migration
// ============================================
// Reads all tables from Supabase and inserts into D1.
// Run with: npx tsx scripts/migrate-supabase-to-d1.ts
//
// Prerequisites:
//   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
//   - D1 database created: npx wrangler d1 create genesis-studio
//   - Schema applied: npx wrangler d1 execute genesis-studio --file=migrations/0001_init.sql

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const D1_DB_NAME = "genesis-studio";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Tables in foreign-key-safe order
const TABLES = [
  "users",
  "generation_jobs",
  "videos",
  "credit_transactions",
  "api_keys",
  "productions",
  "production_scenes",
  "production_templates",
  "referral_codes",
  "referrals",
  "explore_videos",
  "explore_likes",
  "share_events",
  "referral_signups",
  "webhook_events",
  "signup_attribution",
  "comfyui_jobs",
  "mbs_characters",
  "mbs_jobs",
  "mbs_engagement",
  "mbs_source_creators",
  "mbs_watched_tags",
  "mbs_candidates",
  "mbs_posting_schedule",
  "mbs_config",
  "mimic_jobs",
  "dev_trending_topics",
  "dev_content_queue",
  "dev_generation_costs",
  "studio_pages",
  "studio_trends",
  "studio_videos",
  "studio_posts",
  "post_performance",
  "content_intelligence",
  "ai_decisions",
  "viral_formulas",
  "feedback_system_logs",
  "support_tickets",
  "collections",
  "collection_videos",
  "explore_favorites",
  "sessions",
];

async function fetchTable(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    });

    if (!res.ok) {
      // Table might not exist — skip it
      if (res.status === 404 || res.status === 400) {
        console.log(`  ⚠ Table ${table} not found, skipping`);
        return [];
      }
      throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    rows.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return rows;
}

function transformRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === "boolean") {
      result[key] = value ? 1 : 0;
    } else if (Array.isArray(value)) {
      // PostgreSQL arrays → JSON string
      result[key] = JSON.stringify(value);
    } else if (typeof value === "object") {
      // JSONB → JSON string
      result[key] = JSON.stringify(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function generateInsertSQL(
  table: string,
  rows: Record<string, unknown>[]
): { sql: string; params: unknown[] }[] {
  if (rows.length === 0) return [];

  const statements: { sql: string; params: unknown[] }[] = [];
  const cols = Object.keys(rows[0]);
  const colNames = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");

  for (const row of rows) {
    const transformed = transformRow(row);
    const params = cols.map((c) => transformed[c] ?? null);
    statements.push({
      sql: `INSERT OR IGNORE INTO "${table}" (${colNames}) VALUES (${placeholders})`,
      params,
    });
  }

  return statements;
}

async function main() {
  console.log("=== Genesis Studio: Supabase → D1 Migration ===\n");
  console.log(`Source: ${SUPABASE_URL}`);
  console.log(`Target: D1 database "${D1_DB_NAME}"\n`);

  const allStatements: string[] = [];

  for (const table of TABLES) {
    process.stdout.write(`Migrating ${table}...`);
    try {
      const rows = await fetchTable(table);
      if (rows.length === 0) {
        console.log(" 0 rows");
        continue;
      }

      const stmts = generateInsertSQL(table, rows);
      console.log(` ${rows.length} rows`);

      // Generate SQL file for wrangler d1 execute
      for (const stmt of stmts) {
        // Escape values for SQL
        const escapedParams = stmt.params.map((p) => {
          if (p === null) return "NULL";
          if (typeof p === "number") return String(p);
          return `'${String(p).replace(/'/g, "''")}'`;
        });
        allStatements.push(
          stmt.sql.replace(/\?/g, () => escapedParams.shift()!)
        );
      }
    } catch (err) {
      console.log(` ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Write to file
  const output = allStatements.join(";\n") + ";\n";
  const fs = await import("fs");
  const outPath = "migrations/0002_data.sql";
  fs.writeFileSync(outPath, output);
  console.log(`\n✓ Migration SQL written to ${outPath}`);
  console.log(`  Total statements: ${allStatements.length}`);
  console.log(`\nTo apply: npx wrangler d1 execute ${D1_DB_NAME} --file=${outPath}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
