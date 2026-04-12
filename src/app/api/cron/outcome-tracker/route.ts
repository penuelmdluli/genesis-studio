// ============================================================
// CRON: Outcome Tracker — runs every 24 hours
// Measures whether AI decisions improved performance
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { logFeedbackEvent } from "@/lib/intelligence";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Find decisions older than 48 hours without outcomes
  const { data: pendingDecisions } = await supabase
    .from("ai_decisions")
    .select("*")
    .is("outcome_score", null)
    .lt("created_at", twoDaysAgo)
    .limit(50);

  if (!pendingDecisions?.length) {
    return NextResponse.json({ success: true, evaluated: 0 });
  }

  let evaluated = 0;
  let correct = 0;

  for (const decision of pendingDecisions) {
    const pageId = decision.page_id;
    if (!pageId) continue;

    // Get page average performance score
    const { data: avgData } = await supabase
      .from("post_performance")
      .select("performance_score")
      .eq("page_id", pageId)
      .eq("metrics_locked", true);

    if (!avgData?.length) continue;

    const pageAvg = avgData.reduce((s, p) => s + (p.performance_score || 0), 0) / avgData.length;

    // Find the next post made after this decision
    const { data: nextPosts } = await supabase
      .from("post_performance")
      .select("performance_score")
      .eq("page_id", pageId)
      .gt("posted_at", decision.created_at)
      .eq("metrics_locked", true)
      .order("posted_at", { ascending: true })
      .limit(3);

    if (!nextPosts?.length) continue;

    const postAvg = nextPosts.reduce((s, p) => s + (p.performance_score || 0), 0) / nextPosts.length;
    const improvement = postAvg - pageAvg;
    const wasCorrect = improvement > 0;

    await supabase
      .from("ai_decisions")
      .update({
        outcome_score: Math.round(improvement * 10) / 10,
        was_correct: wasCorrect,
      })
      .eq("id", decision.id);

    evaluated++;
    if (wasCorrect) correct++;
  }

  await logFeedbackEvent("outcome_tracking_complete", null, {
    evaluated,
    correct,
    accuracy: evaluated > 0 ? Math.round((correct / evaluated) * 100) : 0,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    evaluated,
    correct,
    accuracy: evaluated > 0 ? Math.round((correct / evaluated) * 100) : 0,
  });
}
