import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const sb = createSupabaseAdmin();
  const now = new Date();
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const week = new Date(now.getTime() - 7 * 86400000);

  const [
    usersR, jobsR, jobsTodayR, jobsFailedR,
    prodsR, videosR, creditsR,
    supportR, recentJobsR, modelStatsR,
  ] = await Promise.all([
    sb.from("users").select("id, plan, credit_balance, created_at", { count: "exact" }),
    sb.from("generation_jobs").select("id", { count: "exact", head: true }),
    sb.from("generation_jobs").select("id, status", { count: "exact" }).gte("created_at", today.toISOString()),
    sb.from("generation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", week.toISOString()),
    sb.from("productions").select("id", { count: "exact", head: true }),
    sb.from("videos").select("id", { count: "exact", head: true }),
    sb.from("credit_transactions").select("type, amount").gte("created_at", week.toISOString()),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("generation_jobs").select("id, user_id, status, model_id, credits_cost, created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("generation_jobs").select("model_id, status").gte("created_at", week.toISOString()),
  ]);

  // User stats
  const users = usersR.data || [];
  const planCounts: Record<string, number> = {};
  let totalCredits = 0;
  let newUsersWeek = 0;
  for (const u of users) {
    planCounts[u.plan || "free"] = (planCounts[u.plan || "free"] || 0) + 1;
    totalCredits += u.credit_balance || 0;
    if (new Date(u.created_at) >= week) newUsersWeek++;
  }

  // Jobs today
  const todayJobs = jobsTodayR.data || [];
  const todayCompleted = todayJobs.filter((j) => j.status === "completed").length;
  const todayFailed = todayJobs.filter((j) => j.status === "failed").length;
  const todayProcessing = todayJobs.filter((j) => j.status === "processing" || j.status === "queued").length;

  // Model success rates
  const modelJobs = modelStatsR.data || [];
  const modelStats: Record<string, { total: number; completed: number; failed: number }> = {};
  for (const j of modelJobs) {
    const m = j.model_id || "unknown";
    if (!modelStats[m]) modelStats[m] = { total: 0, completed: 0, failed: 0 };
    modelStats[m].total++;
    if (j.status === "completed") modelStats[m].completed++;
    if (j.status === "failed") modelStats[m].failed++;
  }

  // Credit flow this week
  const txs = creditsR.data || [];
  let refunded = 0;
  let debited = 0;
  for (const t of txs) {
    if (t.amount > 0) refunded += t.amount;
    else debited += Math.abs(t.amount);
  }

  return NextResponse.json({
    users: {
      total: usersR.count || 0,
      newThisWeek: newUsersWeek,
      byPlan: planCounts,
      totalCreditsOutstanding: totalCredits,
    },
    generation: {
      totalAllTime: jobsR.count || 0,
      today: { total: todayJobs.length, completed: todayCompleted, failed: todayFailed, processing: todayProcessing },
      failedThisWeek: jobsFailedR.count || 0,
      modelSuccessRates: Object.entries(modelStats).map(([model, s]) => ({
        model, total: s.total, completed: s.completed, failed: s.failed,
        rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      })),
    },
    content: {
      totalProductions: prodsR.count || 0,
      totalVideos: videosR.count || 0,
    },
    credits: {
      debitedThisWeek: debited,
      refundedThisWeek: refunded,
      netSpent: debited - refunded,
    },
    support: {
      openTickets: supportR.count || 0,
    },
    recentActivity: (recentJobsR.data || []).map((j) => ({
      id: j.id, userId: j.user_id, status: j.status,
      model: j.model_id, credits: j.credits_cost, created: j.created_at,
    })),
  });
}
