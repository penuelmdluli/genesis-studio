"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { formatRelativeTime } from "@/lib/utils";
import {
  Users,
  Zap,
  Film,
  DollarSign,
  Activity,
  Clock,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  Cpu,
} from "lucide-react";

interface AdminStats {
  overview: {
    totalUsers: number;
    totalJobs: number;
    totalVideos: number;
    totalCreditsSpent: number;
    estimatedRevenue: number;
    avgGpuTime: number;
  };
  planDistribution: Record<string, number>;
  jobStatusDistribution: Record<string, number>;
  modelUsage: Record<string, number>;
  dailyStats: Record<string, { jobs: number; credits: number }>;
  recentJobs: Array<{
    id: string;
    user_id: string;
    model_id: string;
    status: string;
    resolution: string;
    duration: number;
    credits_cost: number;
    gpu_time?: number;
    created_at: string;
    completed_at?: string;
    error_message?: string;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    plan: string;
    credit_balance: number;
    created_at: string;
  }>;
}

const statusColors: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-500/10",
  processing: "text-cyan-400 bg-cyan-500/10",
  queued: "text-amber-400 bg-amber-500/10",
  failed: "text-red-400 bg-red-500/10",
  cancelled: "text-zinc-400 bg-zinc-500/10",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  processing: Loader2,
  queued: Clock,
  failed: XCircle,
  cancelled: XCircle,
};

const planColors: Record<string, string> = {
  free: "text-zinc-400",
  creator: "text-violet-400",
  pro: "text-cyan-400",
  studio: "text-amber-400",
};

export default function AdminPage() {
  const { user } = useStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "users">("overview");

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        if (res.status === 403) {
          setError("Access denied. Admin only.");
        } else {
          setError("Failed to load stats.");
        }
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch {
      setError("Failed to connect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!user?.isOwner) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Shield className="w-16 h-16 text-red-500/50" />
          <h1 className="text-2xl font-bold text-zinc-200">Access Denied</h1>
          <p className="text-zinc-500">This page is restricted to platform administrators.</p>
        </div>
      </PageTransition>
    );
  }

  if (loading && !stats) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <p className="text-zinc-400">{error}</p>
          <Button onClick={fetchStats} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (!stats) return null;

  const overviewCards = [
    {
      label: "Total Users",
      value: stats.overview.totalUsers,
      icon: Users,
      color: "text-violet-400",
      bg: "from-violet-500/10 to-violet-500/5",
    },
    {
      label: "Total Jobs",
      value: stats.overview.totalJobs.toLocaleString(),
      icon: Activity,
      color: "text-cyan-400",
      bg: "from-cyan-500/10 to-cyan-500/5",
    },
    {
      label: "Videos Generated",
      value: stats.overview.totalVideos.toLocaleString(),
      icon: Film,
      color: "text-emerald-400",
      bg: "from-emerald-500/10 to-emerald-500/5",
    },
    {
      label: "Credits Consumed",
      value: stats.overview.totalCreditsSpent.toLocaleString(),
      icon: Zap,
      color: "text-amber-400",
      bg: "from-amber-500/10 to-amber-500/5",
    },
    {
      label: "Est. Revenue",
      value: `$${stats.overview.estimatedRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "from-emerald-500/10 to-emerald-500/5",
    },
    {
      label: "Avg GPU Time",
      value: `${stats.overview.avgGpuTime}s`,
      icon: Cpu,
      color: "text-pink-400",
      bg: "from-pink-500/10 to-pink-500/5",
    },
  ];

  const totalJobs = Object.values(stats.jobStatusDistribution).reduce((a, b) => a + b, 0);
  const failRate = totalJobs > 0
    ? ((stats.jobStatusDistribution.failed || 0) / totalJobs * 100).toFixed(1)
    : "0";

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="red">ADMIN</Badge>
              <span className="text-xs text-zinc-500">Owner Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Platform Analytics</h1>
            <p className="text-zinc-500 mt-1">Real-time metrics and management</p>
          </div>
          <Button
            onClick={fetchStats}
            variant="outline"
            size="sm"
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {(["overview", "jobs", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {overviewCards.map((card) => (
                <StaggerItem key={card.label}>
                  <Card className="glass-strong hover:border-white/[0.12] transition-colors">
                    <CardContent className="p-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.bg} flex items-center justify-center mb-3`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      <div className="text-xl font-bold text-zinc-100">{card.value}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{card.label}</div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerGroup>

            {/* Middle row: Plan Distribution + Job Status + Model Usage */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Plan Distribution */}
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-400" />
                    Plan Distribution
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(stats.planDistribution).map(([plan, count]) => {
                      const pct = stats.overview.totalUsers > 0
                        ? Math.round((count / stats.overview.totalUsers) * 100)
                        : 0;
                      return (
                        <div key={plan}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-sm font-medium capitalize ${planColors[plan] || "text-zinc-400"}`}>
                              {plan}
                            </span>
                            <span className="text-xs text-zinc-500">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Job Status */}
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Job Status
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(stats.jobStatusDistribution).map(([status, count]) => {
                      const Icon = statusIcons[status] || Activity;
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${statusColors[status]?.split(" ")[0] || "text-zinc-400"}`} />
                            <span className="text-sm text-zinc-400 capitalize">{status}</span>
                          </div>
                          <span className="text-sm font-medium text-zinc-300">{count}</span>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-white/[0.06]">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Failure Rate</span>
                        <span className={parseFloat(failRate) > 10 ? "text-red-400" : "text-emerald-400"}>
                          {failRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Usage */}
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Model Usage (7d)
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(stats.modelUsage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([model, count]) => {
                        const maxCount = Math.max(...Object.values(stats.modelUsage));
                        return (
                          <div key={model}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-zinc-400">{model}</span>
                              <span className="text-xs text-zinc-500">{count}</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {Object.keys(stats.modelUsage).length === 0 && (
                      <p className="text-xs text-zinc-600">No jobs this week</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Activity (last 7 days) */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  Daily Activity (Last 7 Days)
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
                    const key = date.toISOString().split("T")[0];
                    const dayData = stats.dailyStats[key] || { jobs: 0, credits: 0 };
                    const maxJobs = Math.max(1, ...Object.values(stats.dailyStats).map((d) => d.jobs));
                    const heightPct = Math.max(8, (dayData.jobs / maxJobs) * 100);

                    return (
                      <div key={key} className="flex flex-col items-center gap-1">
                        <div className="w-full h-24 bg-white/[0.02] rounded-lg flex items-end p-1">
                          <div
                            className="w-full bg-gradient-to-t from-violet-600 to-cyan-500 rounded transition-all"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {date.toLocaleDateString("en", { weekday: "short" })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">{dayData.jobs}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === "jobs" && (
          <Card className="glass-strong">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Jobs (Last 50)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Status</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Model</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Resolution</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Duration</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Credits</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">GPU Time</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Created</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentJobs.map((job) => {
                      const Icon = statusIcons[job.status] || Activity;
                      return (
                        <tr key={job.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${statusColors[job.status] || ""}`}>
                              <Icon className="w-3 h-3" />
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 font-mono text-xs">{job.model_id}</td>
                          <td className="py-2.5 px-3 text-zinc-500">{job.resolution}</td>
                          <td className="py-2.5 px-3 text-zinc-500">{job.duration}s</td>
                          <td className="py-2.5 px-3 text-zinc-400">{job.credits_cost}</td>
                          <td className="py-2.5 px-3 text-zinc-500">
                            {job.gpu_time ? `${Math.round(job.gpu_time)}s` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 text-xs">
                            {formatRelativeTime(job.created_at)}
                          </td>
                          <td className="py-2.5 px-3 text-red-400/70 text-xs max-w-[200px] truncate">
                            {job.error_message || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card className="glass-strong">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Users (Last 20)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Name</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Email</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Plan</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Credits</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUsers.map((u) => (
                      <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-zinc-200 font-medium">{u.name}</td>
                        <td className="py-2.5 px-3 text-zinc-400 text-xs">{u.email}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-sm font-medium capitalize ${planColors[u.plan] || "text-zinc-400"}`}>
                            {u.plan}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400">{u.credit_balance}</td>
                        <td className="py-2.5 px-3 text-zinc-600 text-xs">
                          {formatRelativeTime(u.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
