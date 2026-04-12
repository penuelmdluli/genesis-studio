// ============================================================
// CRON: Fetch Facebook Insights — runs every 6 hours
// Fetches real performance metrics for all posted videos
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchAllPageInsights, logFeedbackEvent } from "@/lib/intelligence";

export const maxDuration = 120;

const PAGE_IDS = [
  "tech_pulse_africa_dev",
  "ai_revolution_dev",
  "afrika_toons_dev",
  "world_news_animated_dev",
  "mzansi_baby_stars",
  "africa_2050_dev",
  "pop_culture_buzz_dev",
];

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { fetched: number; updated: number; locked: number; errors: number }> = {};
  let totalUpdated = 0;

  for (const pageId of PAGE_IDS) {
    try {
      const stats = await fetchAllPageInsights(pageId);
      results[pageId] = stats;
      totalUpdated += stats.updated;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results[pageId] = { fetched: 0, updated: 0, locked: 0, errors: 1 };
      await logFeedbackEvent("fetch_insights_error", pageId, {}, errMsg);
    }
  }

  await logFeedbackEvent("fetch_insights_complete", null, {
    totalUpdated,
    pageResults: results,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    totalUpdated,
    results,
  });
}
