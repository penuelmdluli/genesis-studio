import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendCreditsExpiryEmail, sendWinBackEmail, sendWeeklyDigestEmail } from "@/lib/email-retention";

/**
 * Cron job: Retention campaigns.
 * - Credits expiry warnings (7 days before month end)
 * - Win-back for users inactive 14+ days
 * - Weekly digest for active users (run on Mondays)
 *
 * GET /api/cron/retention?secret=xxx
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const results = { expiryEmails: 0, winBackEmails: 0, digestEmails: 0 };

  try {
    // 1. Credits expiry: users with credits > 0 who haven't generated in 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: expiryUsers } = await supabase
      .from("users")
      .select("id, email, name, credit_balance")
      .gt("credit_balance", 10)
      .lt("updated_at", sevenDaysAgo)
      .limit(50);

    for (const user of expiryUsers || []) {
      if (user.email) {
        sendCreditsExpiryEmail(user.email, user.name || "Creator", user.credit_balance, 7).catch(() => {});
        results.expiryEmails++;
      }
    }

    // 2. Win-back: users inactive for 14+ days with free plan
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: inactiveUsers } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("plan", "free")
      .lt("updated_at", fourteenDaysAgo)
      .limit(20);

    for (const user of inactiveUsers || []) {
      if (user.email) {
        // Grant 25 bonus credits
        await supabase
          .from("users")
          .update({ credit_balance: 25 })
          .eq("id", user.id)
          .eq("credit_balance", 0); // Only if they have 0 credits
        sendWinBackEmail(user.email, user.name || "Creator", 25).catch(() => {});
        results.winBackEmails++;
      }
    }

    // 3. Weekly digest (only on Mondays)
    const today = new Date();
    if (today.getDay() === 1) {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: activeUsers } = await supabase
        .from("users")
        .select("id, email, name, credit_balance")
        .gte("updated_at", weekAgo)
        .limit(100);

      for (const user of activeUsers || []) {
        if (!user.email) continue;

        // Get their weekly stats
        const { data: weekJobs } = await supabase
          .from("generation_jobs")
          .select("model_id, credits_cost")
          .eq("user_id", user.id)
          .gte("created_at", weekAgo);

        if (!weekJobs || weekJobs.length === 0) continue;

        const videosCreated = weekJobs.length;
        const creditsUsed = weekJobs.reduce((s, j) => s + (j.credits_cost || 0), 0);

        // Find top model
        const modelCounts: Record<string, number> = {};
        for (const j of weekJobs) {
          modelCounts[j.model_id] = (modelCounts[j.model_id] || 0) + 1;
        }
        const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

        sendWeeklyDigestEmail(user.email, user.name || "Creator", {
          videosCreated,
          creditsUsed,
          creditsRemaining: user.credit_balance || 0,
          topModel,
        }).catch(() => {});
        results.digestEmails++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Retention error:", error);
    return NextResponse.json({ error: "Retention processing failed" }, { status: 500 });
  }
}
