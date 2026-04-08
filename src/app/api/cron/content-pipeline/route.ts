/**
 * Content Pipeline Cron — Twice Daily
 *
 * GET /api/cron/content-pipeline
 * Auth: Bearer CRON_SECRET (Vercel Cron sends this automatically)
 *
 * Schedule: 05:00 UTC (07:00 SAST) + 13:00 UTC (15:00 SAST)
 *
 * Runs the full automated pipeline:
 * 1. Fetch trending topics from 4+ sources (Gemini, NewsAPI, Reddit, Google Trends)
 * 2. Smart niche-scored assignment — unique topics per page, no duplicates
 * 3. Trigger Brain Studio production (RunPod video + FAL audio/voiceover/captions)
 * 4. Poll assembly for in-progress productions from previous cycles
 * 5. Post completed videos to Facebook Reels + YouTube Shorts
 */

import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://genesis-studio.vercel.app";

  console.log("[CRON] Content pipeline starting...");

  try {
    const res = await fetch(`${appUrl}/api/dev/scheduler?action=full`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "no body");
      console.error(`[CRON] Scheduler returned ${res.status}: ${text}`);
      return NextResponse.json(
        { error: `Scheduler failed: ${res.status}`, details: text },
        { status: 502 },
      );
    }

    const data = await res.json();
    console.log("[CRON] Content pipeline complete:", JSON.stringify(data.steps || {}, null, 2));

    return NextResponse.json({
      success: true,
      pipeline: "content-pipeline",
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    console.error("[CRON] Content pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline failed" },
      { status: 500 },
    );
  }
}
