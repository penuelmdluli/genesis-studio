import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getProviderHealthStatus } from "@/lib/vendor-failover";
import { getBudgetSummary } from "@/lib/api-budget";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    // Run all queries in parallel
    const [
      usersResult,
      jobsResult,
      videosResult,
      recentJobsResult,
      creditsResult,
      planDistResult,
      jobStatusResult,
      recentUsersResult,
      dailyJobsResult,
      // New: credit & subscription data
      recentTransactionsResult,
      lowBalanceUsersResult,
      topSpendersResult,
      packPurchasesResult,
      refundsResult,
      failedJobsRecentResult,
      subscriptionUsersResult,
    ] = await Promise.all([
      // Total users
      supabase.from("users").select("*", { count: "exact", head: true }),
      // Total jobs
      supabase.from("generation_jobs").select("*", { count: "exact", head: true }),
      // Total videos
      supabase.from("videos").select("*", { count: "exact", head: true }),
      // Recent 50 jobs
      supabase
        .from("generation_jobs")
        .select("id, user_id, model_id, status, resolution, duration, credits_cost, gpu_time, created_at, completed_at, error_message")
        .order("created_at", { ascending: false })
        .limit(50),
      // Total credits spent (sum of generation debits)
      supabase
        .from("credit_transactions")
        .select("amount")
        .eq("type", "generation_debit"),
      // Plan distribution
      supabase.from("users").select("plan"),
      // Job status distribution
      supabase.from("generation_jobs").select("status"),
      // Recent users
      supabase
        .from("users")
        .select("id, email, name, plan, credit_balance, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      // Jobs in last 7 days
      supabase
        .from("generation_jobs")
        .select("created_at, status, credits_cost, model_id")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // --- New queries ---

      // Recent credit transactions (last 50)
      supabase
        .from("credit_transactions")
        .select("id, user_id, type, amount, balance, description, created_at")
        .order("created_at", { ascending: false })
        .limit(50),

      // Users with low credit balance (< 20 credits, non-free plans)
      supabase
        .from("users")
        .select("id, email, name, plan, credit_balance, monthly_credits_used, monthly_credits_limit")
        .lt("credit_balance", 20)
        .neq("plan", "free")
        .order("credit_balance", { ascending: true })
        .limit(20),

      // Top spenders (last 30 days) — users who consumed most credits
      supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("type", "generation_debit")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Credit pack purchases (last 30 days)
      supabase
        .from("credit_transactions")
        .select("id, user_id, amount, description, created_at")
        .eq("type", "pack_purchase")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false }),

      // Refunds (last 7 days)
      supabase
        .from("credit_transactions")
        .select("id, user_id, amount, description, created_at")
        .eq("type", "generation_refund")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false }),

      // Failed jobs (last 24h) — for issues monitoring
      supabase
        .from("generation_jobs")
        .select("id, user_id, model_id, error_message, credits_cost, created_at")
        .eq("status", "failed")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(30),

      // Paid subscribers — users with non-free plans
      supabase
        .from("users")
        .select("id, email, name, plan, credit_balance, monthly_credits_used, monthly_credits_limit, stripe_customer_id, created_at")
        .neq("plan", "free")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Calculate plan distribution
    const planDist: Record<string, number> = { free: 0, creator: 0, pro: 0, studio: 0 };
    (planDistResult.data || []).forEach((u: { plan: string }) => {
      planDist[u.plan] = (planDist[u.plan] || 0) + 1;
    });

    // Calculate job status distribution
    const jobStatusDist: Record<string, number> = {};
    (jobStatusResult.data || []).forEach((j: { status: string }) => {
      jobStatusDist[j.status] = (jobStatusDist[j.status] || 0) + 1;
    });

    // Calculate total credits spent
    const totalCreditsSpent = (creditsResult.data || []).reduce(
      (sum: number, t: { amount: number }) => sum + Math.abs(t.amount),
      0
    );

    // Calculate model usage from recent week
    const modelUsage: Record<string, number> = {};
    const dailyStats: Record<string, { jobs: number; credits: number }> = {};
    (dailyJobsResult.data || []).forEach((j: { created_at: string; credits_cost: number; model_id: string }) => {
      modelUsage[j.model_id] = (modelUsage[j.model_id] || 0) + 1;
      const day = j.created_at.split("T")[0];
      if (!dailyStats[day]) dailyStats[day] = { jobs: 0, credits: 0 };
      dailyStats[day].jobs++;
      dailyStats[day].credits += j.credits_cost;
    });

    // Calculate avg GPU time for completed jobs
    const completedJobs = (recentJobsResult.data || []).filter(
      (j: { status: string; gpu_time?: number }) => j.status === "completed" && j.gpu_time
    );
    const avgGpuTime =
      completedJobs.length > 0
        ? completedJobs.reduce((sum: number, j: { gpu_time: number }) => sum + j.gpu_time, 0) / completedJobs.length
        : 0;

    // Revenue estimate (total credits spent * $0.03 per credit)
    const estimatedRevenue = totalCreditsSpent * 0.03;

    // --- New: Top spenders aggregation ---
    const spenderMap = new Map<string, number>();
    (topSpendersResult.data || []).forEach((t: { user_id: string; amount: number }) => {
      spenderMap.set(t.user_id, (spenderMap.get(t.user_id) || 0) + Math.abs(t.amount));
    });
    const topSpenders = Array.from(spenderMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, totalSpent]) => ({ userId, totalSpent }));

    // --- New: Credit flow summary (last 7 days) ---
    const recentTxns = recentTransactionsResult.data || [];
    const creditFlow = {
      totalDebits: 0,
      totalRefunds: 0,
      totalGrants: 0,
      totalPurchases: 0,
    };
    recentTxns.forEach((t: { type: string; amount: number }) => {
      if (t.type === "generation_debit") creditFlow.totalDebits += Math.abs(t.amount);
      if (t.type === "generation_refund") creditFlow.totalRefunds += Math.abs(t.amount);
      if (t.type === "subscription_grant") creditFlow.totalGrants += Math.abs(t.amount);
      if (t.type === "pack_purchase") creditFlow.totalPurchases += Math.abs(t.amount);
    });

    // --- New: Subscription revenue estimate ---
    const paidUsers = subscriptionUsersResult.data || [];
    const planPrices: Record<string, number> = { creator: 15, pro: 39, studio: 99 };
    const monthlyRecurring = paidUsers.reduce((sum: number, u: { plan: string }) => {
      return sum + (planPrices[u.plan] || 0);
    }, 0);

    // Provider health + API budgets
    const providerHealth = getProviderHealthStatus();
    const apiBudgets = getBudgetSummary();

    return NextResponse.json({
      overview: {
        totalUsers: usersResult.count || 0,
        totalJobs: jobsResult.count || 0,
        totalVideos: videosResult.count || 0,
        totalCreditsSpent,
        estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
        avgGpuTime: Math.round(avgGpuTime * 10) / 10,
        monthlyRecurring,
        paidSubscribers: paidUsers.length,
      },
      planDistribution: planDist,
      jobStatusDistribution: jobStatusDist,
      modelUsage,
      dailyStats,
      recentJobs: recentJobsResult.data || [],
      recentUsers: recentUsersResult.data || [],
      // New data
      creditFlow,
      recentTransactions: recentTxns,
      lowBalanceUsers: lowBalanceUsersResult.data || [],
      topSpenders,
      packPurchases: packPurchasesResult.data || [],
      refunds: refundsResult.data || [],
      failedJobsRecent: failedJobsRecentResult.data || [],
      subscribers: paidUsers,
      providerHealth,
      apiBudgets,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
