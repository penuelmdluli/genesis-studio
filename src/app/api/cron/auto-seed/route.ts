import { isAutomationPaused } from "@/lib/automation-killswitch";
/**
 * AUTO-SEED CRON — keeps the content queue topped up with balanced seeds
 *
 * GET /api/cron/auto-seed
 * Auth: Bearer CRON_SECRET
 * Schedule: daily (06:00 UTC)
 *
 * Ensures tech_pulse_africa_dev always has at least 20 pending seed items
 * of the balanced mix (war / ai / sa / human). If pending count drops below
 * threshold, reloads the full 40-topic mix. No-op otherwise.
 *
 * Replaces manual `node scripts/preload-topics.js` runs.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { preloadSeeds } from "@/lib/content-seeds/balanced";

export const maxDuration = 60;

const PAGE_ID = "tech_pulse_africa_dev";
const PAGE_NAME = "Tech Pulse Africa";
const MIN_PENDING_SEEDS = 20;

export async function GET(req: Request) {
  if (isAutomationPaused()) return NextResponse.json({ paused: true, reason: "AUTOMATION_PAUSED=true" });
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data: pending } = await supabase
    .from("dev_content_queue")
    .select("id, input_data")
    .eq("page_id", PAGE_ID)
    .eq("status", "pending");

  const seedCount = (pending || []).filter(
    (r) => r.input_data?.provider === "balanced-recovery"
  ).length;

  console.log(`[AUTO-SEED] Seed items pending: ${seedCount}/${MIN_PENDING_SEEDS}`);

  if (seedCount >= MIN_PENDING_SEEDS) {
    return NextResponse.json({
      success: true,
      action: "skipped",
      seed_count: seedCount,
      min_required: MIN_PENDING_SEEDS,
    });
  }

  // Reload full 40-topic balanced mix
  const result = await preloadSeeds(PAGE_ID, PAGE_NAME);
  console.log(
    `[AUTO-SEED] Reloaded: cancelled ${result.cancelled}, queued ${result.queued}`
  );

  return NextResponse.json({
    success: true,
    action: "reloaded",
    seed_count_before: seedCount,
    cancelled: result.cancelled,
    queued: result.queued,
  });
}
