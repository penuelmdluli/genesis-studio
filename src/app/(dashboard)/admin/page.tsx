"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { Users, Zap, Film, TrendingUp, Activity, CheckCircle, XCircle, Clock, MessageCircle } from "lucide-react";
import Link from "next/link";

interface HealthCheck { status: string; detail?: string }

interface DashboardData {
  health: Record<string, HealthCheck>;
  users: { total: number; newThisWeek: number; byPlan: Record<string, number>; totalCreditsOutstanding: number };
  generation: {
    totalAllTime: number;
    today: { total: number; completed: number; failed: number; processing: number };
    failedThisWeek: number;
    modelSuccessRates: Array<{ model: string; total: number; completed: number; failed: number; rate: number }>;
  };
  content: { totalProductions: number; totalVideos: number };
  credits: { debitedThisWeek: number; refundedThisWeek: number; netSpent: number };
  support: { openTickets: number };
  recentActivity: Array<{ id: string; userId: string; status: string; model: string; credits: number; created: string }>;
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading dashboard...</div>;
  if (!data) return <div className="flex items-center justify-center min-h-[50vh] text-red-400">Access denied</div>;

  return (
    <PageTransition className="max-w-6xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Admin Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Users", value: data.users.total, sub: `+${data.users.newThisWeek} this week`, icon: Users, color: "text-violet-400", bg: "bg-violet-500/20" },
          { label: "Today's Generations", value: data.generation.today.total, sub: `${data.generation.today.completed} done, ${data.generation.today.failed} failed`, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/20" },
          { label: "Total Videos", value: data.content.totalVideos, sub: `${data.content.totalProductions} productions`, icon: Film, color: "text-emerald-400", bg: "bg-emerald-500/20" },
          { label: "Open Support", value: data.support.openTickets, sub: data.support.openTickets > 0 ? "Needs attention" : "All clear", icon: MessageCircle, color: data.support.openTickets > 0 ? "text-amber-400" : "text-emerald-400", bg: data.support.openTickets > 0 ? "bg-amber-500/20" : "bg-emerald-500/20" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-100">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-zinc-400">{s.label}</p>
                  <p className="text-[10px] text-zinc-400">{s.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health */}
      <MotionSection delay={0.05} className="mb-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> System Health
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {Object.entries(data.health).map(([name, h]) => (
                <div key={name} className="text-center">
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${h.status === "ok" ? "bg-emerald-500" : h.status === "warn" ? "bg-amber-500" : "bg-red-500"}`} />
                  <p className="text-[10px] font-medium text-zinc-300 capitalize">{name}</p>
                  <p className="text-[9px] text-zinc-400 truncate" title={h.detail}>{h.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </MotionSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Success Rates */}
        <MotionSection delay={0.1}>
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" /> Model Success Rates (7 days)
              </h2>
              <div className="space-y-2">
                {data.generation.modelSuccessRates.map((m) => (
                  <div key={m.model} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-300 w-28 truncate">{m.model}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className={`h-full rounded-full ${m.rate >= 80 ? "bg-emerald-500" : m.rate >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${m.rate}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-16 text-right">{m.rate}% ({m.total})</span>
                  </div>
                ))}
                {data.generation.modelSuccessRates.length === 0 && <p className="text-xs text-zinc-400">No generations this week</p>}
              </div>
            </CardContent>
          </Card>
        </MotionSection>

        {/* Users by Plan + Credits */}
        <MotionSection delay={0.2}>
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" /> Users & Credits
              </h2>
              <div className="space-y-2 mb-3">
                {Object.entries(data.users.byPlan).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 capitalize">{plan}</span>
                    <span className="text-sm font-medium text-zinc-200">{count}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/[0.10] grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-red-400">{data.credits.debitedThisWeek}</p>
                  <p className="text-[10px] text-zinc-400">Debited</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-400">{data.credits.refundedThisWeek}</p>
                  <p className="text-[10px] text-zinc-400">Refunded</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-zinc-200">{data.credits.netSpent}</p>
                  <p className="text-[10px] text-zinc-400">Net Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionSection>

        {/* Quick Actions */}
        <MotionSection delay={0.3}>
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3">Quick Actions</h2>
              <div className="space-y-1.5">
                <Link href="/admin/support" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <MessageCircle className="w-4 h-4 text-amber-400" /> Support Inbox
                  {data.support.openTickets > 0 && <Badge variant="amber" className="text-[10px] ml-auto">{data.support.openTickets}</Badge>}
                </Link>
                <Link href="/admin/mbs-config" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <Users className="w-4 h-4 text-violet-400" /> MBS Config
                </Link>
                <Link href="/gallery" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <Film className="w-4 h-4 text-cyan-400" /> Gallery
                </Link>
                <a href="https://dashboard.fal.ai" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <Activity className="w-4 h-4 text-emerald-400" /> FAL Dashboard ↗
                </a>
                <a href="/api/admin/fb-health" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <CheckCircle className="w-4 h-4 text-blue-400" /> Check FB Token Health ↗
                </a>
                <a href="https://sentry.io" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <XCircle className="w-4 h-4 text-red-400" /> Sentry Errors ↗
                </a>
                <a href="https://plausible.io" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Plausible Analytics ↗
                </a>
              </div>
            </CardContent>
          </Card>
        </MotionSection>

        {/* Recent Activity */}
        <MotionSection delay={0.4}>
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" /> Recent Generations
              </h2>
              <div className="space-y-1">
                {data.recentActivity.slice(0, 10).map((j) => (
                  <div key={j.id} className="flex items-center gap-3 py-1.5 text-xs">
                    {j.status === "completed" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> :
                     j.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" /> :
                     <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    <span className="text-zinc-300 w-24 truncate">{j.model}</span>
                    <span className="text-zinc-400">{j.credits}cr</span>
                    <span className="text-zinc-400 ml-auto">{new Date(j.created).toLocaleTimeString()}</span>
                  </div>
                ))}
                {data.recentActivity.length === 0 && <p className="text-xs text-zinc-400">No recent activity</p>}
              </div>
            </CardContent>
          </Card>
        </MotionSection>
      </div>
    </PageTransition>
  );
}
