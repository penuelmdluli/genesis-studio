/**
 * Genesis Studio Audit — Table Inventory
 * Lists every Supabase table with row counts.
 *
 * Usage: npx tsx audit/scripts/inventory-tables.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== GENESIS STUDIO TABLE INVENTORY ===\n");
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log("");

  // Known tables from code analysis
  const knownTables = [
    "users",
    "generation_jobs",
    "videos",
    "credit_transactions",
    "api_keys",
    "productions",
    "production_scenes",
    "production_templates",
    "explore_videos",
    "explore_likes",
    "share_events",
    "referral_signups",
    "referral_codes",
    "referrals",
    "post_performance",
    "content_intelligence",
    "ai_decisions",
    "viral_formulas",
    "feedback_system_logs",
    "dev_trending_topics",
    "dev_content_queue",
    "dev_generation_costs",
    "studio_pages",
    "studio_trends",
    "studio_videos",
    "studio_posts",
    "dunning_records",
    "webhook_events",
    "affiliate_referrals",
    "affiliate_payouts",
    "video_collections",
    "video_collection_items",
    "video_favorites",
    "video_ratings",
    "analytics_events",
    "payfast_transactions",
    "scheduled_generations",
    "uploads",
  ];

  console.log("| Table | Row Count | Status |");
  console.log("|-------|-----------|--------|");

  for (const table of knownTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`| ${table} | ERROR | ${error.message.slice(0, 50)} |`);
      } else {
        console.log(`| ${table} | ${count} | OK |`);
      }
    } catch (err) {
      console.log(`| ${table} | ERROR | ${err instanceof Error ? err.message.slice(0, 50) : "Unknown"} |`);
    }
  }
}

main().catch(console.error);
