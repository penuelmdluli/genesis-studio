/**
 * Trending Topics API
 *
 * GET  /api/dev/trending-topics — Returns top 20 unused topics from Supabase
 * POST /api/dev/trending-topics — Triggers a fresh fetch from all sources, saves to DB
 *
 * Protected by CRON_SECRET header or development environment.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { aggregateAllSources } from "@/lib/news/aggregator";

function isAuthorized(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  if (secret && secret === process.env.CRON_SECRET) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_trending_topics")
      .select("*")
      .eq("status", "pending")
      .order("viral_potential", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[TrendingTopics] Supabase query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch topics" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      topics: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TrendingTopics] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[TrendingTopics] Starting fresh fetch from all sources...");
    const items = await aggregateAllSources();

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No topics fetched from any source",
        timestamp: new Date().toISOString(),
      });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("dev_trending_topics")
      .upsert(
        items.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          category: item.category,
          viral_potential: item.viral_potential,
          content_angle: item.content_angle,
          suggested_hook: item.suggested_hook,
          region: item.region,
          source: item.source,
          sources_count: item.sources_count,
          page_target: item.page_target,
          status: item.status,
        })),
        { onConflict: "id" },
      );

    if (error) {
      console.error("[TrendingTopics] Supabase upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save topics" },
        { status: 500 },
      );
    }

    console.log(
      `[TrendingTopics] Saved ${items.length} topics to dev_trending_topics`,
    );

    return NextResponse.json({
      success: true,
      count: items.length,
      regions: [...new Set(items.map((i) => i.region))],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TrendingTopics] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
