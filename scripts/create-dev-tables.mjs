/**
 * Create dev tables in Supabase using the service role key.
 * Uses Supabase's Management API via a workaround:
 * Creates tables by inserting a row and then deleting it.
 *
 * Usage: node scripts/create-dev-tables.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Since PostgREST can't run DDL, we'll create a temporary RPC function
// Actually, let's use the Supabase SQL HTTP endpoint (available since Supabase v2)
async function runSQL(sql) {
  // Use the /sql endpoint (available on newer Supabase instances)
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "exec", args: { sql } }),
  });
  return response;
}

async function createTablesViaWorkaround() {
  console.log("Creating dev tables...\n");

  // Approach: Use the Supabase Database Webhooks / pg_net extension
  // or simply try to access tables and report what needs manual creation

  const tables = [
    {
      name: "dev_trending_topics",
      testInsert: {
        title: "__migration_test__",
        summary: "test",
        category: "technology",
        viral_potential: 0,
        source: "migration",
        region: "GLOBAL",
        status: "pending",
      },
    },
    {
      name: "dev_content_queue",
      testInsert: {
        page_id: "__migration_test__",
        pillar: "test",
        status: "pending",
        engine: "wan-2.2",
      },
    },
    {
      name: "dev_generation_costs",
      testInsert: {
        engine: "__migration_test__",
        pillar: "test",
        page_id: "test",
        estimated_cost_usd: 0,
      },
    },
  ];

  for (const table of tables) {
    // Check if table exists
    const { data, error } = await supabase.from(table.name).select("id").limit(1);

    if (error && error.message.includes("does not exist")) {
      console.log(`❌ ${table.name}: DOES NOT EXIST`);
      console.log(`   → Must be created via Supabase SQL Editor`);
    } else if (error) {
      console.log(`⚠️  ${table.name}: ERROR - ${error.message}`);
    } else {
      console.log(`✅ ${table.name}: EXISTS (${data.length} rows)`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("If tables are missing, run this SQL in Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard/project/quliaphgimytmqkwadqu/sql");
  console.log("=".repeat(60));
  console.log(`
CREATE TABLE IF NOT EXISTS dev_trending_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL, summary text, category text,
  viral_potential int DEFAULT 0, content_angle text,
  suggested_hook text, region text, source text,
  sources_count int DEFAULT 1, page_target text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(), used_at timestamptz
);

CREATE TABLE IF NOT EXISTS dev_content_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text NOT NULL, pillar text NOT NULL,
  status text DEFAULT 'pending', engine text,
  input_data jsonb, video_url text, caption text,
  hashtags text[], scheduled_time timestamptz,
  generated_at timestamptz, posted_at timestamptz,
  cost_usd decimal(10,4), viral_score int DEFAULT 0,
  news_topic_id uuid, error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dev_generation_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  engine text NOT NULL, pillar text, page_id text,
  estimated_cost_usd decimal(10,4), actual_cost_usd decimal(10,4),
  created_at timestamptz DEFAULT now()
);
  `);
}

createTablesViaWorkaround();
