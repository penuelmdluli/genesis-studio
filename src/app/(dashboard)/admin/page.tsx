"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { formatRelativeTime } from "@/lib/utils";
import { GenesisLoader } from "@/components/ui/genesis-loader";
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
  CreditCard,
  Heart,
  HeartCrack,
  ArrowDownRight,
  ArrowUpRight,
  ServerCrash,
  Wifi,
  WifiOff,
  Gauge,
  Receipt,
  Crown,
  AlertCircle,
} from "lucide-react";

interface AdminStats {
  overview: {
    totalUsers: number;
    totalJobs: number;
    totalVideos: number;
    totalCreditsSpent: number;
    estimatedRevenue: number;
    avgGpuTime: number;
    monthlyRecurring: number;
    paidSubscribers: number;
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
  // New data
  creditFlow: {
    totalDebits: number;
    totalRefunds: number;
    totalGrants: number;
    totalPurchases: number;
  };
  recentTransactions: Array<{
    id: string;
    user_id: string;
    type: string;
    amount: number;
    balance: number;
    description: string;
    created_at: string;
  }>;
  lowBalanceUsers: Array<{
    id: string;
    email: string;
    name: string;
    plan: string;
    credit_balance: number;
    monthly_credits_used: number;
    monthly_credits_limit: number;
  }>;
  topSpenders: Array<{ userId: string; totalSpent: number }>;
  packPurchases: Array<{
    id: string;
    user_id: string;
    amount: number;
    description: string;
    created_at: string;
  }>;
  refunds: Array<{
    id: string;
    user_id: string;
    amount: number;
    description: string;
    created_at: string;
  }>;
  failedJobsRecent: Array<{
    id: string;
    user_id: string;
    model_id: string;
    error_message: string;
    credits_cost: number;
    created_at: string;
  }>;
  subscribers: Array<{
    id: string;
    email: string;
    name: string;
    plan: string;
    credit_balance: number;
    monthly_credits_used: number;
    monthly_credits_limit: number;
    stripe_customer_id?: string;
    created_at: string;
  }>;
  providerHealth: Array<{
    provider: string;
    healthy: boolean;
    failCount: number;
    lastError?: string;
    lastChecked: string | null;
  }>;
  apiBudgets: Record<string, {
    budgetCents: number;
    spentCents: number;
    requests: number;
    percentUsed: number;
  }>;
}

type AdminTab = "overview" | "credits" | "subscribers" | "jobs" | "users" | "health";

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

const txnTypeLabels: Record<string, { label: string; color: string }> = {
  generation_debit: { label: "Generation", color: "text-red-400" },
  generation_refund: { label: "Refund", color: "text-amber-400" },
  subscription_grant: { label: "Subscription", color: "text-emerald-400" },
  pack_purchase: { label: "Pack Purchase", color: "text-cyan-400" },
  admin_adjustment: { label: "Admin", color: "text-violet-400" },
};

export default function AdminPage() {
  const { user } = useStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

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
          <GenesisLoader size="md" />
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
          <Button onClick={fetchStats} variant="outline" size="sm">Retry</Button>
        </div>
      </PageTransition>
    );
  }

  if (!stats) return null;

  const totalJobs = Object.values(stats.jobStatusDistribution).reduce((a, b) => a + b, 0);
  const failRate = totalJobs > 0
    ? ((stats.jobStatusDistribution.failed || 0) / totalJobs * 100).toFixed(1)
    : "0";

  const tabs: { key: AdminTab; label: string; icon: typeof Activity }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "credits", label: "Credits", icon: Zap },
    { key: "subscribers", label: "Subscribers", icon: Crown },
    { key: "jobs", label: "Jobs", icon: Activity },
    { key: "users", label: "Users", icon: Users },
    { key: "health", label: "Health", icon: Heart },
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="red">ADMIN</Badge>
              <span className="text-xs text-zinc-500">Owner Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Command Center</h1>
            <p className="text-zinc-500 mt-1 text-sm">Everything happening on your platform</p>
          </div>
          <Button onClick={fetchStats} variant="outline" size="sm" disabled={loading} className="shrink-0">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========== OVERVIEW TAB ========== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Top-level KPIs */}
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Users", value: stats.overview.totalUsers, icon: Users, color: "text-violet-400", bg: "from-violet-500/10 to-violet-500/5" },
                { label: "Subscribers", value: stats.overview.paidSubscribers, icon: Crown, color: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5" },
                { label: "MRR", value: `$${stats.overview.monthlyRecurring}`, icon: DollarSign, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
                { label: "Revenue", value: `$${stats.overview.estimatedRevenue.toFixed(0)}`, icon: TrendingUp, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
                { label: "Jobs", value: stats.overview.totalJobs.toLocaleString(), icon: Activity, color: "text-cyan-400", bg: "from-cyan-500/10 to-cyan-500/5" },
                { label: "Videos", value: stats.overview.totalVideos.toLocaleString(), icon: Film, color: "text-pink-400", bg: "from-pink-500/10 to-pink-500/5" },
                { label: "Credits Used", value: stats.overview.totalCreditsSpent.toLocaleString(), icon: Zap, color: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5" },
                { label: "Avg GPU", value: `${stats.overview.avgGpuTime}s`, icon: Cpu, color: "text-zinc-400", bg: "from-zinc-500/10 to-zinc-500/5" },
              ].map((card) => (
                <StaggerItem key={card.label}>
                  <Card className="glass-strong hover:border-white/[0.12] transition-colors">
                    <CardContent className="p-3 sm:p-4">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br ${card.bg} flex items-center justify-center mb-2`}>
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-zinc-100">{card.value}</div>
                      <div className="text-[10px] sm:text-xs text-zinc-500">{card.label}</div>
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
                        ? Math.round((count / stats.overview.totalUsers) * 100) : 0;
                      return (
                        <div key={plan}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-sm font-medium capitalize ${planColors[plan] || "text-zinc-400"}`}>{plan}</span>
                            <span className="text-xs text-zinc-500">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
                        <span className={parseFloat(failRate) > 10 ? "text-red-400" : "text-emerald-400"}>{failRate}%</span>
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
                              <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
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

            {/* Daily Activity */}
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
                          <div className="w-full bg-gradient-to-t from-violet-600 to-cyan-500 rounded transition-all" style={{ height: `${heightPct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600">{date.toLocaleDateString("en", { weekday: "short" })}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">{dayData.jobs}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== CREDITS TAB ========== */}
        {activeTab === "credits" && (
          <div className="space-y-6">
            {/* Credit Flow KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Credits Spent", value: stats.creditFlow.totalDebits.toLocaleString(), icon: ArrowDownRight, color: "text-red-400", bg: "bg-red-500/10" },
                { label: "Refunded", value: stats.creditFlow.totalRefunds.toLocaleString(), icon: ArrowUpRight, color: "text-amber-400", bg: "bg-amber-500/10" },
                { label: "Subscription Grants", value: stats.creditFlow.totalGrants.toLocaleString(), icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Pack Purchases", value: stats.creditFlow.totalPurchases.toLocaleString(), icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
              ].map((kpi) => (
                <Card key={kpi.label} className="glass-strong">
                  <CardContent className="p-4">
                    <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <div className="text-xl font-bold text-zinc-100">{kpi.value}</div>
                    <div className="text-xs text-zinc-500">{kpi.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Low Balance Users */}
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Low Balance Users
                    {stats.lowBalanceUsers.length > 0 && (
                      <Badge variant="amber" className="text-[10px]">{stats.lowBalanceUsers.length}</Badge>
                    )}
                  </h3>
                  {stats.lowBalanceUsers.length === 0 ? (
                    <p className="text-xs text-zinc-600">All paid users have sufficient credits</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                      {stats.lowBalanceUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="min-w-0">
                            <div className="text-sm text-zinc-200 truncate">{u.name || u.email}</div>
                            <div className="text-[10px] text-zinc-500">
                              <span className={planColors[u.plan]}>{u.plan}</span> · {u.monthly_credits_used}/{u.monthly_credits_limit} used
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className={`text-sm font-bold ${u.credit_balance <= 5 ? "text-red-400" : "text-amber-400"}`}>
                              {u.credit_balance}
                            </div>
                            <div className="text-[10px] text-zinc-600">credits left</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Spenders */}
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Top Spenders (30d)
                  </h3>
                  {stats.topSpenders.length === 0 ? (
                    <p className="text-xs text-zinc-600">No credit usage in the last 30 days</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topSpenders.map((s, i) => {
                        const maxSpent = stats.topSpenders[0]?.totalSpent || 1;
                        return (
                          <div key={s.userId}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-zinc-400 truncate max-w-[60%]">
                                <span className="text-zinc-600 mr-1">#{i + 1}</span>
                                {s.userId.slice(0, 8)}...
                              </span>
                              <span className="text-xs font-medium text-zinc-300">{s.totalSpent.toLocaleString()} credits</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${(s.totalSpent / maxSpent) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-400" />
                  Recent Transactions
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Type</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Amount</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Balance</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Description</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTransactions.map((txn) => {
                        const typeInfo = txnTypeLabels[txn.type] || { label: txn.type, color: "text-zinc-400" };
                        return (
                          <tr key={txn.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2 px-3">
                              <span className={`text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                            </td>
                            <td className={`py-2 px-3 text-sm font-medium ${txn.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {txn.amount > 0 ? "+" : ""}{txn.amount}
                            </td>
                            <td className="py-2 px-3 text-xs text-zinc-500">{txn.balance}</td>
                            <td className="py-2 px-3 text-xs text-zinc-500 max-w-[200px] truncate">{txn.description}</td>
                            <td className="py-2 px-3 text-xs text-zinc-600">{formatRelativeTime(txn.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Refunds */}
            {stats.refunds.length > 0 && (
              <Card className="glass-strong border-amber-500/10">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    Refunds (7d)
                    <Badge variant="amber" className="text-[10px]">{stats.refunds.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {stats.refunds.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="text-xs text-zinc-400 truncate max-w-[60%]">{r.description}</div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-medium text-amber-400">+{Math.abs(r.amount)}</span>
                          <span className="text-[10px] text-zinc-600">{formatRelativeTime(r.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ========== SUBSCRIBERS TAB ========== */}
        {activeTab === "subscribers" && (
          <div className="space-y-6">
            {/* Subscription KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="glass-strong">
                <CardContent className="p-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-100">${stats.overview.monthlyRecurring}</div>
                  <div className="text-xs text-zinc-500">Monthly Recurring</div>
                </CardContent>
              </Card>
              <Card className="glass-strong">
                <CardContent className="p-4">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
                    <Crown className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-100">{stats.overview.paidSubscribers}</div>
                  <div className="text-xs text-zinc-500">Paid Subscribers</div>
                </CardContent>
              </Card>
              <Card className="glass-strong">
                <CardContent className="p-4">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-100">
                    {stats.overview.totalUsers > 0
                      ? ((stats.overview.paidSubscribers / stats.overview.totalUsers) * 100).toFixed(1)
                      : "0"}%
                  </div>
                  <div className="text-xs text-zinc-500">Conversion Rate</div>
                </CardContent>
              </Card>
              <Card className="glass-strong">
                <CardContent className="p-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-100">{stats.packPurchases.length}</div>
                  <div className="text-xs text-zinc-500">Pack Purchases (30d)</div>
                </CardContent>
              </Card>
            </div>

            {/* Subscriber Table */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">All Subscribers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Name</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Email</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Plan</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Credits</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Usage</th>
                        <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.subscribers.map((u) => {
                        const usagePct = u.monthly_credits_limit > 0
                          ? Math.round((u.monthly_credits_used / u.monthly_credits_limit) * 100) : 0;
                        return (
                          <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-zinc-200 font-medium">{u.name}</td>
                            <td className="py-2.5 px-3 text-zinc-400 text-xs">{u.email}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-sm font-medium capitalize ${planColors[u.plan]}`}>{u.plan}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={u.credit_balance < 20 ? "text-red-400 font-medium" : "text-zinc-300"}>
                                {u.credit_balance}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${usagePct > 80 ? "bg-amber-500" : "bg-violet-500"}`}
                                    style={{ width: `${Math.min(100, usagePct)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-zinc-500">{usagePct}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-600 text-xs">{formatRelativeTime(u.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {stats.subscribers.length === 0 && (
                    <p className="text-xs text-zinc-600 text-center py-8">No paid subscribers yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Pack Purchases */}
            {stats.packPurchases.length > 0 && (
              <Card className="glass-strong">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    Recent Pack Purchases
                  </h3>
                  <div className="space-y-2">
                    {stats.packPurchases.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="text-xs text-zinc-400 truncate max-w-[60%]">{p.description}</div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-medium text-cyan-400">+{Math.abs(p.amount)}</span>
                          <span className="text-[10px] text-zinc-600">{formatRelativeTime(p.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ========== JOBS TAB ========== */}
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
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Res</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Dur</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">Credits</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">GPU</th>
                      <th className="text-left text-xs text-zinc-500 font-medium py-2 px-3">When</th>
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
                          <td className="py-2.5 px-3 text-zinc-500">{job.gpu_time ? `${Math.round(job.gpu_time)}s` : "—"}</td>
                          <td className="py-2.5 px-3 text-zinc-600 text-xs">{formatRelativeTime(job.created_at)}</td>
                          <td className="py-2.5 px-3 text-red-400/70 text-xs max-w-[200px] truncate">{job.error_message || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== USERS TAB ========== */}
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
                          <span className={`text-sm font-medium capitalize ${planColors[u.plan] || "text-zinc-400"}`}>{u.plan}</span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400">{u.credit_balance}</td>
                        <td className="py-2.5 px-3 text-zinc-600 text-xs">{formatRelativeTime(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== HEALTH TAB ========== */}
        {activeTab === "health" && (
          <div className="space-y-6">
            {/* Provider Health */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  Provider Health
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {stats.providerHealth.map((p) => (
                    <div
                      key={p.provider}
                      className={`p-4 rounded-xl border ${
                        p.healthy
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-zinc-200 uppercase">{p.provider}</span>
                        {p.healthy ? (
                          <Badge variant="emerald" className="text-[10px]">Healthy</Badge>
                        ) : (
                          <Badge variant="red" className="text-[10px]">Down</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Fail Count</span>
                          <span className={p.failCount > 0 ? "text-amber-400" : "text-zinc-400"}>{p.failCount}</span>
                        </div>
                        {p.lastError && (
                          <div className="text-red-400/70 truncate mt-1" title={p.lastError}>
                            {p.lastError}
                          </div>
                        )}
                        {p.lastChecked && (
                          <div className="text-zinc-600">
                            Last check: {formatRelativeTime(p.lastChecked)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Budget Usage */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-violet-400" />
                  API Budget (Today)
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {Object.entries(stats.apiBudgets).map(([service, budget]) => {
                    const isWarning = budget.percentUsed > 70;
                    const isDanger = budget.percentUsed > 90;
                    return (
                      <div
                        key={service}
                        className={`p-4 rounded-xl border ${
                          isDanger ? "border-red-500/20 bg-red-500/5" :
                          isWarning ? "border-amber-500/20 bg-amber-500/5" :
                          "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-200">{service.replace("claude:", "")}</span>
                          <span className={`text-xs font-medium ${isDanger ? "text-red-400" : isWarning ? "text-amber-400" : "text-zinc-400"}`}>
                            {budget.percentUsed}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-violet-500"
                            }`}
                            style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>${(budget.spentCents / 100).toFixed(2)} / ${(budget.budgetCents / 100).toFixed(2)}</span>
                          <span>{budget.requests} reqs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Failed Jobs (24h) */}
            <Card className="glass-strong border-red-500/10">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                  <ServerCrash className="w-4 h-4 text-red-400" />
                  Failed Jobs (24h)
                  {stats.failedJobsRecent.length > 0 && (
                    <Badge variant="red" className="text-[10px]">{stats.failedJobsRecent.length}</Badge>
                  )}
                </h3>
                {stats.failedJobsRecent.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-300">No failures in the last 24 hours</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {stats.failedJobsRecent.map((job) => (
                      <div key={job.id} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-zinc-400">{job.model_id}</span>
                          <span className="text-[10px] text-zinc-600">{formatRelativeTime(job.created_at)}</span>
                        </div>
                        <p className="text-xs text-red-400/80 line-clamp-2">{job.error_message || "Unknown error"}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                          <span>{job.credits_cost} credits</span>
                          <span>·</span>
                          <span className="font-mono">{job.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
