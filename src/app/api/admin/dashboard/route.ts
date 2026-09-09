import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const sb = getDb();
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
  const todayCompleted = todayJobs.filter((j: any) => j.status === "completed").length;
  const todayFailed = todayJobs.filter((j: any) => j.status === "failed").length;
  const todayProcessing = todayJobs.filter((j: any) => j.status === "processing" || j.status === "queued").length;

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

  // System health checks
  const health: Record<string, { status: string; detail?: string }> = {};

  // Sentry
  health.sentry = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? { status: "ok", detail: "DSN configured" }
    : { status: "error", detail: "NEXT_PUBLIC_SENTRY_DSN not set" };

  // Plausible
  health.plausible = { status: "ok", detail: "Script in layout.tsx" };

  // Email (Resend)
  health.email = process.env.RESEND_API_KEY
    ? { status: "ok", detail: "Resend API key set" }
    : { status: "error", detail: "RESEND_API_KEY not set" };

  // R2 Storage
  health.r2 = process.env.R2_PUBLIC_URL
    ? { status: "ok", detail: process.env.R2_PUBLIC_URL.slice(0, 40) }
    : { status: "error", detail: "R2_PUBLIC_URL not set" };

  // FAL AI
  health.fal = process.env.FAL_KEY
    ? { status: "ok", detail: "FAL_KEY configured" }
    : { status: "error", detail: "FAL_KEY not set" };

  // Yoco Payments
  health.yoco = process.env.YOCO_SECRET_KEY?.startsWith("sk_live_")
    ? { status: "ok", detail: "Live keys" }
    : process.env.YOCO_SECRET_KEY
      ? { status: "warn", detail: "Test keys" }
      : { status: "error", detail: "Not configured" };

  // Claude AI (chat)
  health.claude = (process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY)
    ? { status: "ok", detail: "API key set" }
    : { status: "error", detail: "No Claude key" };

  // Facebook
  health.facebook = process.env.FB_MBS_PAGE_ACCESS_TOKEN
    ? { status: "ok", detail: "Page tokens set" }
    : { status: "error", detail: "No FB tokens" };

  // Clerk webhook
  health.clerk_webhook = { status: "ok", detail: "Route: /api/webhooks/clerk" };

  // Automation
  health.automation = process.env.AUTOMATION_PAUSED === "true"
    ? { status: "warn", detail: "PAUSED" }
    : { status: "ok", detail: "Running" };

  // Webhook processing
  const { count: webhookCount } = await sb.from("webhook_events").select("id", { count: "exact", head: true });
  health.webhooks = (webhookCount || 0) > 0
    ? { status: "ok", detail: `${webhookCount} processed` }
    : { status: "warn", detail: "0 events — no payments yet" };

  // ── Phase 4 metrics ──────────────────────────────────────────────────
  // Raw SQL rather than the query builder: these are aggregations and
  // cohort joins, and pulling every row into the Worker to count it in JS
  // is what makes an admin page slow enough that nobody opens it.
  const { getD1 } = await import("@/lib/d1");
  const d1 = getD1();

  const one = async <T,>(sql: string, ...binds: unknown[]) =>
    (await d1.prepare(sql).bind(...binds).first<T>()) ?? null;
  const many = async <T,>(sql: string, ...binds: unknown[]) =>
    ((await d1.prepare(sql).bind(...binds).all<T>()).results ?? []) as T[];

  const [reliability, byErrorCode, byProvider, funnel, firstFailed, liability, spendByModel] =
    await Promise.all([
      // Success rate over three windows.
      one<{ d_t: number; d_c: number; w_t: number; w_c: number; m_t: number; m_c: number }>(
        `SELECT
           SUM(CASE WHEN created_at >= date('now') THEN 1 ELSE 0 END) d_t,
           SUM(CASE WHEN created_at >= date('now') AND status='completed' THEN 1 ELSE 0 END) d_c,
           SUM(CASE WHEN created_at >= datetime('now','-7 day') THEN 1 ELSE 0 END) w_t,
           SUM(CASE WHEN created_at >= datetime('now','-7 day') AND status='completed' THEN 1 ELSE 0 END) w_c,
           SUM(CASE WHEN created_at >= datetime('now','-30 day') THEN 1 ELSE 0 END) m_t,
           SUM(CASE WHEN created_at >= datetime('now','-30 day') AND status='completed' THEN 1 ELSE 0 END) m_c
         FROM generation_jobs`
      ),

      // Failures grouped by error_code, falling back to the message for jobs
      // that predate the column.
      many<{ code: string; n: number }>(
        `SELECT COALESCE(error_code, substr(COALESCE(error_message,'unknown'),1,40)) code, COUNT(*) n
           FROM generation_jobs WHERE status='failed'
          GROUP BY code ORDER BY n DESC LIMIT 12`
      ),

      // Per-provider reliability and latency. provider is only populated for
      // jobs submitted after migration 0006, so this fills in over time.
      many<{ provider: string; total: number; completed: number; p50: number; p95: number }>(
        `WITH t AS (
           SELECT provider, status,
                  (julianday(completed_at) - julianday(created_at)) * 86400 secs
             FROM generation_jobs
            WHERE provider IS NOT NULL AND created_at >= datetime('now','-30 day')
         )
         SELECT provider,
                COUNT(*) total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
                CAST(AVG(CASE WHEN status='completed' THEN secs END) AS INT) p50,
                CAST(MAX(CASE WHEN status='completed' THEN secs END) AS INT) p95
           FROM t GROUP BY provider`
      ),

      // The funnel that matters: how far does a signup actually get?
      one<{ signups: number; started: number; completed: number; purchased: number }>(
        `SELECT
           (SELECT COUNT(*) FROM users) signups,
           (SELECT COUNT(DISTINCT user_id) FROM generation_jobs) started,
           (SELECT COUNT(DISTINCT user_id) FROM generation_jobs WHERE status='completed') completed,
           (SELECT COUNT(DISTINCT user_id) FROM credit_transactions WHERE type='pack_purchase') purchased`
      ),

      // Users whose FIRST generation failed — the churn cohort, and the list
      // worth sending a recovery email to.
      many<{ email: string; plan: string; created_at: string }>(
        `SELECT u.email, u.plan, j.created_at
           FROM users u
           JOIN generation_jobs j ON j.id = (
             SELECT id FROM generation_jobs WHERE user_id = u.id
              ORDER BY created_at ASC LIMIT 1
           )
          WHERE j.status = 'failed'
          ORDER BY j.created_at DESC LIMIT 50`
      ),

      // Outstanding credit liability — credits reserved but not yet settled.
      one<{ held_n: number; held_amt: number; captured_amt: number; released_amt: number }>(
        `SELECT
           SUM(CASE WHEN status='held' THEN 1 ELSE 0 END) held_n,
           COALESCE(SUM(CASE WHEN status='held' THEN amount END),0) held_amt,
           COALESCE(SUM(CASE WHEN status='captured' THEN amount END),0) captured_amt,
           COALESCE(SUM(CASE WHEN status='released' THEN amount END),0) released_amt
         FROM credit_holds`
      ),

      // What we actually spent, where the provider reported it.
      many<{ model_id: string; completed: number; credits: number; usd: number }>(
        `SELECT model_id,
                COUNT(*) completed,
                COALESCE(SUM(credits_cost),0) credits,
                COALESCE(SUM(cost_usd),0) usd
           FROM generation_jobs
          WHERE status='completed' AND created_at >= datetime('now','-30 day')
          GROUP BY model_id ORDER BY completed DESC`
      ),
    ]);

  const rate = (c?: number, t?: number) => (t && t > 0 ? Math.round(((c ?? 0) / t) * 100) : null);

  return NextResponse.json({
    health,
    reliability: {
      today: { total: reliability?.d_t ?? 0, completed: reliability?.d_c ?? 0, successRate: rate(reliability?.d_c, reliability?.d_t) },
      week: { total: reliability?.w_t ?? 0, completed: reliability?.w_c ?? 0, successRate: rate(reliability?.w_c, reliability?.w_t) },
      month: { total: reliability?.m_t ?? 0, completed: reliability?.m_c ?? 0, successRate: rate(reliability?.m_c, reliability?.m_t) },
      byErrorCode,
      byProvider: byProvider.map((p) => ({ ...p, successRate: rate(p.completed, p.total) })),
    },
    funnel: {
      signups: funnel?.signups ?? 0,
      startedGeneration: funnel?.started ?? 0,
      completedGeneration: funnel?.completed ?? 0,
      purchased: funnel?.purchased ?? 0,
      activationRate: rate(funnel?.completed, funnel?.signups),
    },
    // Everyone whose first impression of the product was a failure.
    firstGenerationFailed: firstFailed,
    creditLiability: {
      outstandingHolds: liability?.held_n ?? 0,
      outstandingCredits: liability?.held_amt ?? 0,
      capturedAllTime: liability?.captured_amt ?? 0,
      releasedAllTime: liability?.released_amt ?? 0,
    },
    spendByModel,
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
    recentActivity: (recentJobsR.data || []).map((j: any) => ({
      id: j.id, userId: j.user_id, status: j.status,
      model: j.model_id, credits: j.credits_cost, created: j.created_at,
    })),
  });
}
