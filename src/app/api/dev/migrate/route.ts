import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const results: Record<string, string> = {};

  // Table 1: dev_trending_topics
  try {
    // Check if exists
    const { error: checkErr } = await supabase.from("dev_trending_topics").select("id").limit(1);
    if (checkErr && checkErr.message.includes("does not exist")) {
      // Create via raw insert approach - we need to use the SQL editor
      // Since we can't run DDL via PostgREST, create a workaround:
      // Use the Supabase Management API
      results.dev_trending_topics = "NEEDS_MANUAL_CREATION";
    } else {
      results.dev_trending_topics = "EXISTS";
    }
  } catch (e) {
    results.dev_trending_topics = `ERROR: ${e}`;
  }

  // Table 2: dev_content_queue
  try {
    const { error: checkErr } = await supabase.from("dev_content_queue").select("id").limit(1);
    if (checkErr && checkErr.message.includes("does not exist")) {
      results.dev_content_queue = "NEEDS_MANUAL_CREATION";
    } else {
      results.dev_content_queue = "EXISTS";
    }
  } catch (e) {
    results.dev_content_queue = `ERROR: ${e}`;
  }

  // Table 3: dev_generation_costs
  try {
    const { error: checkErr } = await supabase.from("dev_generation_costs").select("id").limit(1);
    if (checkErr && checkErr.message.includes("does not exist")) {
      results.dev_generation_costs = "NEEDS_MANUAL_CREATION";
    } else {
      results.dev_generation_costs = "EXISTS";
    }
  } catch (e) {
    results.dev_generation_costs = `ERROR: ${e}`;
  }

  return NextResponse.json({
    message: "Migration check complete",
    tables: results,
    sql_to_run: `Copy and paste the SQL from src/lib/dev-schema.sql into the Supabase SQL Editor at https://supabase.com/dashboard`,
  });
}
