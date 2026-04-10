/**
 * Dev Dashboard — Content pipeline status overview
 * Only accessible in dev/preview environments.
 */

import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";

// Only show in dev/preview (not production)
const isProduction =
  process.env.VERCEL_ENV === "production" &&
  process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchTrendingTopics() {
  try {
    const supabase = createSupabaseAdmin();
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("dev_trending_topics")
      .select("*")
      .gte("created_at", twentyFourHoursAgo)
      .order("viral_potential", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[DEV] Dashboard trending topics error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[DEV] Dashboard trending topics fetch failed:", err);
    return [];
  }
}

async function fetchQueueStatusCounts() {
  try {
    const supabase = createSupabaseAdmin();
    const statuses = ["pending", "generating", "ready", "posted", "failed"];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count, error } = await supabase
        .from("dev_content_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", status);

      if (error) {
        console.error(`[DEV] Dashboard queue count error (${status}):`, error.message);
        counts[status] = 0;
      } else {
        counts[status] = count ?? 0;
      }
    }

    return counts;
  } catch (err) {
    console.error("[DEV] Dashboard queue counts fetch failed:", err);
    return { pending: 0, generating: 0, ready: 0, posted: 0, failed: 0 };
  }
}

async function fetchRecentGenerations() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, status, engine, cost_usd, created_at, generated_at, error_message")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error("[DEV] Dashboard recent generations error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[DEV] Dashboard recent generations fetch failed:", err);
    return [];
  }
}

async function fetchCostTotals() {
  try {
    const supabase = createSupabaseAdmin();
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay()
    ).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const fetchSum = async (since: string) => {
      const { data, error } = await supabase
        .from("dev_generation_costs")
        .select("estimated_cost_usd, actual_cost_usd")
        .gte("created_at", since);

      if (error || !data) return { estimated: 0, actual: 0 };
      return data.reduce(
        (acc, row) => ({
          estimated: acc.estimated + (Number(row.estimated_cost_usd) || 0),
          actual: acc.actual + (Number(row.actual_cost_usd) || 0),
        }),
        { estimated: 0, actual: 0 }
      );
    };

    const [today, week, month] = await Promise.all([
      fetchSum(todayStart),
      fetchSum(weekStart),
      fetchSum(monthStart),
    ]);

    return { today, week, month };
  } catch (err) {
    console.error("[DEV] Dashboard cost totals fetch failed:", err);
    return {
      today: { estimated: 0, actual: 0 },
      week: { estimated: 0, actual: 0 },
      month: { estimated: 0, actual: 0 },
    };
  }
}

async function fetchEngineUsage() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("engine");

    if (error || !data) return {};

    const usage: Record<string, number> = {};
    for (const row of data) {
      const engine = row.engine ?? "unknown";
      usage[engine] = (usage[engine] || 0) + 1;
    }
    return usage;
  } catch (err) {
    console.error("[DEV] Dashboard engine usage fetch failed:", err);
    return {};
  }
}

async function fetchPageStatuses() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("page_id, status, posted_at")
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    // Group by page_id
    const pageMap: Record<
      string,
      { total: number; posted: number; pending: number; failed: number; lastPosted: string | null }
    > = {};

    for (const row of data) {
      if (!pageMap[row.page_id]) {
        pageMap[row.page_id] = { total: 0, posted: 0, pending: 0, failed: 0, lastPosted: null };
      }
      const p = pageMap[row.page_id];
      p.total++;
      if (row.status === "posted") {
        p.posted++;
        if (!p.lastPosted || (row.posted_at && row.posted_at > p.lastPosted)) {
          p.lastPosted = row.posted_at;
        }
      }
      if (row.status === "pending" || row.status === "generating") p.pending++;
      if (row.status === "failed") p.failed++;
    }

    return Object.entries(pageMap).map(([pageId, stats]) => ({
      pageId,
      ...stats,
    }));
  } catch (err) {
    console.error("[DEV] Dashboard page statuses fetch failed:", err);
    return [];
  }
}

async function fetchRecentErrors() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, engine, error_message, created_at")
      .eq("status", "failed")
      .not("error_message", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[DEV] Dashboard errors fetch error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[DEV] Dashboard errors fetch failed:", err);
    return [];
  }
}

interface PerformancePost {
  id: string;
  page_id: string;
  pillar: string;
  topic_title: string;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  performance_tier: "top" | "mid" | "low" | "unranked";
}

interface PillarAggregate {
  key: string;
  samples: number;
  mean_engagement: number;
  total_views: number;
}

/**
 * Pull the last 30 days of posted items that have latest_metrics,
 * return top-posts list + per-pillar and per-page aggregates.
 */
async function fetchEngagementInsights(): Promise<{
  posts: PerformancePost[];
  byPillar: PillarAggregate[];
  byPage: PillarAggregate[];
}> {
  try {
    const supabase = createSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, posted_at, input_data")
      .eq("status", "posted")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(200);

    if (error || !data) return { posts: [], byPillar: [], byPage: [] };

    const posts: PerformancePost[] = [];
    const pillarBuckets: Record<
      string,
      { engagement: number[]; views: number[] }
    > = {};
    const pageBuckets: Record<
      string,
      { engagement: number[]; views: number[] }
    > = {};

    for (const row of data) {
      const input = (row.input_data as Record<string, unknown>) || {};
      const latest = input.latest_metrics as
        | {
            combined?: {
              views?: number;
              likes?: number;
              comments?: number;
              shares?: number;
              engagement_rate?: number;
            };
          }
        | undefined;
      const combined = latest?.combined;
      if (!combined) continue;

      const views = Number(combined.views || 0);
      const likes = Number(combined.likes || 0);
      const comments = Number(combined.comments || 0);
      const shares = Number(combined.shares || 0);
      const er = Number(combined.engagement_rate || 0);
      const tier =
        (input.performance_tier as PerformancePost["performance_tier"]) ||
        "unranked";

      posts.push({
        id: row.id as string,
        page_id: row.page_id as string,
        pillar: row.pillar as string,
        topic_title: (input.topic_title as string) || "(untitled)",
        posted_at: row.posted_at as string | null,
        views,
        likes,
        comments,
        shares,
        engagement_rate: er,
        performance_tier: tier,
      });

      const pillarKey = (row.pillar as string) || "unknown";
      (pillarBuckets[pillarKey] ||= { engagement: [], views: [] }).engagement.push(er);
      pillarBuckets[pillarKey].views.push(views);

      const pageKey = (row.page_id as string) || "unknown";
      (pageBuckets[pageKey] ||= { engagement: [], views: [] }).engagement.push(er);
      pageBuckets[pageKey].views.push(views);
    }

    const toAggregate = (
      buckets: Record<string, { engagement: number[]; views: number[] }>,
    ): PillarAggregate[] =>
      Object.entries(buckets)
        .map(([key, b]) => ({
          key,
          samples: b.engagement.length,
          mean_engagement:
            b.engagement.reduce((a, c) => a + c, 0) / (b.engagement.length || 1),
          total_views: b.views.reduce((a, c) => a + c, 0),
        }))
        .sort((a, b) => b.mean_engagement - a.mean_engagement);

    return {
      posts: posts.sort((a, b) => b.engagement_rate - a.engagement_rate),
      byPillar: toAggregate(pillarBuckets),
      byPage: toAggregate(pageBuckets),
    };
  } catch (err) {
    console.error("[DEV] Dashboard engagement insights fetch failed:", err);
    return { posts: [], byPillar: [], byPage: [] };
  }
}

async function fetchStuckItems(): Promise<
  Array<{ id: string; page_id: string; pillar: string; minutes_stuck: number }>
> {
  try {
    const supabase = createSupabaseAdmin();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, pillar, created_at")
      .eq("status", "generating")
      .lt("created_at", thirtyMinAgo)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      page_id: r.page_id as string,
      pillar: r.pillar as string,
      minutes_stuck: Math.round(
        (Date.now() - new Date(r.created_at as string).getTime()) / 60000,
      ),
    }));
  } catch (err) {
    console.error("[DEV] Dashboard stuck items fetch failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-500/20 text-yellow-400";
    case "generating":
      return "bg-blue-500/20 text-blue-400";
    case "ready":
      return "bg-green-500/20 text-green-400";
    case "posted":
      return "bg-purple-500/20 text-purple-400";
    case "failed":
      return "bg-red-500/20 text-red-400";
    default:
      return "bg-zinc-500/20 text-zinc-400";
  }
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DevDashboardPage() {
  if (isProduction) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="mb-2 text-xl font-bold text-zinc-200">
            Dev Dashboard
          </h1>
          <p className="text-zinc-500">Not available in production</p>
        </div>
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    trendingTopics,
    queueCounts,
    recentGenerations,
    costTotals,
    engineUsage,
    pageStatuses,
    recentErrors,
    engagement,
    stuckItems,
  ] = await Promise.all([
    fetchTrendingTopics(),
    fetchQueueStatusCounts(),
    fetchRecentGenerations(),
    fetchCostTotals(),
    fetchEngineUsage(),
    fetchPageStatuses(),
    fetchRecentErrors(),
    fetchEngagementInsights(),
    fetchStuckItems(),
  ]);

  const totalEngineUsage = Object.values(engineUsage).reduce(
    (sum, v) => sum + v,
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dev Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Content pipeline status — {new Date().toLocaleDateString("en-ZA")}
          </p>
        </div>
        <a
          href="/dev-dashboard"
          className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Refresh
        </a>
      </div>

      {/* Stuck Items Banner — surfaces reconciler-worthy state */}
      {stuckItems.length > 0 && (
        <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-amber-300">
                ⚠ {stuckItems.length} production
                {stuckItems.length === 1 ? "" : "s"} stuck &gt; 30 min
              </h2>
              <p className="mt-1 text-xs text-amber-200/70">
                Run{" "}
                <code className="rounded bg-amber-900/40 px-1 py-0.5">
                  ?action=reconcile
                </code>{" "}
                on the scheduler to reset them back to pending.
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {stuckItems.slice(0, 8).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between text-amber-100/80"
              >
                <span className="truncate">
                  <span className="font-mono text-amber-300">{s.page_id}</span>{" "}
                  / {s.pillar}
                </span>
                <span className="ml-4 shrink-0 text-amber-200/60">
                  {s.minutes_stuck}m
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Queue Status Counts */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Content Queue
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {Object.entries(queueCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <p className="text-sm capitalize text-zinc-500">{status}</p>
              <p className="text-2xl font-bold text-zinc-100">{count}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(status)}`}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Cost Tracker */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Cost Tracker
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Today", data: costTotals.today },
            { label: "This Week", data: costTotals.week },
            { label: "This Month", data: costTotals.month },
          ].map(({ label, data }) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="text-xl font-bold text-zinc-100">
                {formatCost(data.estimated)}
              </p>
              <p className="text-xs text-zinc-500">
                Actual: {formatCost(data.actual)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Engine Usage */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Engine Usage
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          {totalEngineUsage === 0 ? (
            <p className="text-sm text-zinc-500">No generations yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(engineUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([engine, count]) => {
                  const pct =
                    totalEngineUsage > 0
                      ? Math.round((count / totalEngineUsage) * 100)
                      : 0;
                  return (
                    <div key={engine} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-zinc-300">
                        {engine}
                      </span>
                      <div className="flex-1">
                        <div className="h-3 w-full rounded-full bg-zinc-800">
                          <div
                            className="h-3 rounded-full bg-blue-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm text-zinc-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>

      {/* Engagement Insights (Learn & Adapt) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Engagement Insights{" "}
          <span className="ml-2 text-xs font-normal text-zinc-500">
            last 30 days · learn-and-adapt
          </span>
        </h2>
        {engagement.posts.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500">
              No metrics yet — posted content will appear here once{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5">
                ?action=pull_metrics
              </code>{" "}
              runs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Top pillars */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-sm font-semibold text-zinc-300">
                Winning Pillars
              </p>
              <div className="space-y-2">
                {engagement.byPillar.slice(0, 6).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-zinc-200">{row.key}</span>
                    <span className="ml-4 shrink-0 font-mono text-zinc-400">
                      {(row.mean_engagement * 100).toFixed(2)}% ·{" "}
                      {row.total_views.toLocaleString()} views ·{" "}
                      {row.samples} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top pages */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-sm font-semibold text-zinc-300">
                Winning Pages
              </p>
              <div className="space-y-2">
                {engagement.byPage.slice(0, 6).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate font-mono text-zinc-200">
                      {row.key}
                    </span>
                    <span className="ml-4 shrink-0 font-mono text-zinc-400">
                      {(row.mean_engagement * 100).toFixed(2)}% ·{" "}
                      {row.total_views.toLocaleString()} views ·{" "}
                      {row.samples} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top posts */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 lg:col-span-2">
              <p className="mb-3 text-sm font-semibold text-zinc-300">
                Top 10 Posts by Engagement
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-2 font-medium">Title</th>
                      <th className="px-2 py-2 font-medium">Page</th>
                      <th className="px-2 py-2 font-medium">Tier</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Views
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Likes
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        ER
                      </th>
                      <th className="px-2 py-2 font-medium">Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagement.posts.slice(0, 10).map((post) => (
                      <tr
                        key={post.id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="max-w-xs truncate px-2 py-2 text-zinc-200">
                          {post.topic_title}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs text-zinc-400">
                          {post.page_id}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              post.performance_tier === "top"
                                ? "bg-green-500/20 text-green-400"
                                : post.performance_tier === "low"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                            }`}
                          >
                            {post.performance_tier}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">
                          {post.views.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">
                          {post.likes.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">
                          {(post.engagement_rate * 100).toFixed(2)}%
                        </td>
                        <td className="px-2 py-2 text-xs text-zinc-500">
                          {formatDate(post.posted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Trending Topics Feed */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Trending Topics (24h)
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          {trendingTopics.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">
              No trending topics in the last 24 hours
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Viral</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trendingTopics.map((topic: Record<string, unknown>) => (
                    <tr
                      key={topic.id as string}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="max-w-xs truncate px-4 py-3 text-zinc-200">
                        {topic.title as string}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {(topic.category as string) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {(topic.source as string) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {(topic.region as string) ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {(topic.viral_potential as number) ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(
                            (topic.status as string) ?? "pending"
                          )}`}
                        >
                          {(topic.status as string) ?? "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Per-Page Status */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Per-Page Status
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          {pageStatuses.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No pages tracked yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-3 font-medium">Page ID</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Posted</th>
                    <th className="px-4 py-3 font-medium">Pending</th>
                    <th className="px-4 py-3 font-medium">Failed</th>
                    <th className="px-4 py-3 font-medium">Last Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {pageStatuses.map(
                    (page: {
                      pageId: string;
                      total: number;
                      posted: number;
                      pending: number;
                      failed: number;
                      lastPosted: string | null;
                    }) => (
                      <tr
                        key={page.pageId}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 font-mono text-zinc-200">
                          {page.pageId}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {page.total}
                        </td>
                        <td className="px-4 py-3 text-green-400">
                          {page.posted}
                        </td>
                        <td className="px-4 py-3 text-yellow-400">
                          {page.pending}
                        </td>
                        <td className="px-4 py-3 text-red-400">
                          {page.failed}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {formatDate(page.lastPosted)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Recent Generations */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Recent Generations
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          {recentGenerations.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No generations yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-3 font-medium">Page</th>
                    <th className="px-4 py-3 font-medium">Pillar</th>
                    <th className="px-4 py-3 font-medium">Engine</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGenerations.map(
                    (gen: Record<string, unknown>) => (
                      <tr
                        key={gen.id as string}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 font-mono text-zinc-200">
                          {gen.page_id as string}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {gen.pillar as string}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {(gen.engine as string) ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(
                              (gen.status as string) ?? "pending"
                            )}`}
                          >
                            {(gen.status as string) ?? "pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {gen.cost_usd
                            ? formatCost(Number(gen.cost_usd))
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {formatDate(gen.created_at as string)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Error Log */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          Error Log
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          {recentErrors.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No recent errors</p>
          ) : (
            <div className="space-y-2 p-4">
              {recentErrors.map((err: Record<string, unknown>) => (
                <div
                  key={err.id as string}
                  className="rounded-md border border-red-900/30 bg-red-950/20 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-400">
                      {err.page_id as string} / {err.pillar as string}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatDate(err.created_at as string)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    Engine: {(err.engine as string) ?? "unknown"}
                  </p>
                  <p className="mt-1 text-sm text-red-300/80">
                    {(err.error_message as string) ?? "No error message"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
