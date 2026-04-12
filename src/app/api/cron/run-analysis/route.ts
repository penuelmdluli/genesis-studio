// ============================================================
// CRON: Run Intelligence Analysis — runs every 12 hours
// Analyzes all post performance data and extracts insights
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runFullAnalysis, logFeedbackEvent } from "@/lib/intelligence";

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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { insightsGenerated: number }> = {};
  let totalInsights = 0;

  for (const pageId of PAGE_IDS) {
    try {
      const result = await runFullAnalysis(pageId);
      results[pageId] = result;
      totalInsights += result.insightsGenerated;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results[pageId] = { insightsGenerated: 0 };
      await logFeedbackEvent("analysis_error", pageId, {}, errMsg);
    }
  }

  await logFeedbackEvent("analysis_all_complete", null, {
    totalInsights,
    pageResults: results,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    totalInsights,
    results,
  });
}
