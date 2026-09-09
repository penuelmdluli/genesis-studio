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
  reliability: {
    today: Window; week: Window; month: Window;
    byErrorCode: Array<{ code: string; n: number }>;
    byProvider: Array<{ provider: string; total: number; completed: number; successRate: number | null; p50: number; p95: number }>;
  };
  funnel: { signups: number; startedGeneration: number; completedGeneration: number; purchased: number; activationRate: number | null };
  firstGenerationFailed: Array<{ email: string; plan: string; created_at: string }>;
  creditLiability: { outstandingHolds: number; outstandingCredits: number; capturedAllTime: number; releasedAllTime: number };
  spendByModel: Array<{ model_id: string; completed: number; credits: number; usd: number }>;
}

interface Window { total: number; completed: number; successRate: number | null }

/** Below this, the product is broken for most people who try it. */
const HEALTHY_SUCCESS_RATE = 90;

function rateColour(rate: number | null): string {
  if (rate === null) return "text-zinc-400";
  if (rate >= HEALTHY_SUCCESS_RATE) return "text-emerald-400";
  if (rate >= 60) return "text-amber-400";
  return "text-red-400";
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
          // Success rate leads. It is the number that decides whether anything
          // else on this page matters.
          { label: "Success Rate (7d)", value: data.reliability?.week?.successRate ?? 0, sub: `${data.reliability?.week?.completed ?? 0} of ${data.reliability?.week?.total ?? 0} jobs`, icon: TrendingUp, color: rateColour(data.reliability?.week?.successRate ?? null), bg: "bg-violet-500/20" },
          { label: "Activation", value: data.funnel?.activationRate ?? 0, sub: `${data.funnel?.completedGeneration ?? 0} of ${data.funnel?.signups ?? 0} signups got a video`, icon: Users, color: rateColour(data.funnel?.activationRate ?? null), bg: "bg-cyan-500/20" },
          { label: "Credits Held", value: data.creditLiability?.outstandingCredits ?? 0, sub: `${data.creditLiability?.outstandingHolds ?? 0} unsettled reservations`, icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/20" },
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

      {/* Funnel — where signups actually stop */}
      <MotionSection delay={0.06} className="mb-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Funnel
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Signed up", value: data.funnel?.signups ?? 0 },
                { label: "Tried to generate", value: data.funnel?.startedGeneration ?? 0 },
                { label: "Got a video", value: data.funnel?.completedGeneration ?? 0 },
                { label: "Purchased", value: data.funnel?.purchased ?? 0 },
              ].map((s, i, arr) => {
                const prev = i > 0 ? arr[i - 1].value : null;
                const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
                return (
                  <div key={s.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <p className="text-2xl font-bold text-zinc-100">{s.value}</p>
                    <p className="text-xs text-zinc-300">{s.label}</p>
                    {drop !== null && drop > 0 && (
                      <p className="text-[10px] text-red-400 mt-0.5">-{drop}% from previous step</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </MotionSection>

      {/* Reliability across three windows */}
      <MotionSection delay={0.07} className="mb-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" /> Reliability
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {([
                ["Today", data.reliability?.today],
                ["7 days", data.reliability?.week],
                ["30 days", data.reliability?.month],
              ] as Array<[string, Window | undefined]>).map(([label, w]) => (
                <div key={label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className={`text-2xl font-bold ${rateColour(w?.successRate ?? null)}`}>
                    {w?.successRate === null || w?.successRate === undefined ? "\u2014" : `${w.successRate}%`}
                  </p>
                  <p className="text-xs text-zinc-300">{label}</p>
                  <p className="text-[10px] text-zinc-400">{w?.completed ?? 0} of {w?.total ?? 0}</p>
                </div>
              ))}
            </div>

            {(data.reliability?.byErrorCode?.length ?? 0) > 0 && (
              <>
                <p className="text-xs font-medium text-zinc-300 mb-2">Failures by cause</p>
                <div className="space-y-1.5">
                  {data.reliability.byErrorCode.slice(0, 8).map((e) => (
                    <div key={e.code} className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-300 flex-1 truncate" title={e.code}>{e.code}</span>
                      <span className="text-red-400 font-medium">{e.n}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(data.reliability?.byProvider?.length ?? 0) > 0 && (
              <>
                <p className="text-xs font-medium text-zinc-300 mt-4 mb-2">By provider (30 days)</p>
                <div className="space-y-1.5">
                  {data.reliability.byProvider.map((p) => (
                    <div key={p.provider} className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-300 w-24 truncate">{p.provider}</span>
                      <span className={rateColour(p.successRate)}>{p.successRate ?? 0}%</span>
                      <span className="text-zinc-400 ml-auto">{p.completed}/{p.total} · ~{p.p50 ?? 0}s</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </MotionSection>

      {/* The churn cohort — everyone whose first impression was a failure */}
      {(data.firstGenerationFailed?.length ?? 0) > 0 && (
        <MotionSection delay={0.08} className="mb-6">
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" /> First generation failed
                <Badge className="bg-red-500/20 text-red-300 text-[10px]">
                  {data.firstGenerationFailed.length}
                </Badge>
              </h2>
              <p className="text-[11px] text-zinc-400 mb-3">
                These people tried the product once and it broke. They are the cheapest
                users to win back &mdash; restore their credits and tell them it is fixed.
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {data.firstGenerationFailed.map((u) => (
                  <div key={u.email} className="flex items-center gap-3 py-1 text-xs">
                    <span className="text-zinc-300 flex-1 truncate">{u.email}</span>
                    <span className="text-zinc-400">{u.plan}</span>
                    <span className="text-zinc-500 w-20 text-right">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </MotionSection>
      )}

      {/* Credit liability + spend */}
      <MotionSection delay={0.09} className="mb-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Credits &amp; spend
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Held (unsettled)", value: data.creditLiability?.outstandingCredits ?? 0 },
                { label: "Captured all time", value: data.creditLiability?.capturedAllTime ?? 0 },
                { label: "Released all time", value: data.creditLiability?.releasedAllTime ?? 0 },
                { label: "User balances", value: data.users.totalCreditsOutstanding },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="text-xl font-bold text-zinc-100">{s.value.toLocaleString()}</p>
                  <p className="text-[11px] text-zinc-300">{s.label}</p>
                </div>
              ))}
            </div>

            {(data.spendByModel?.length ?? 0) > 0 && (
              <>
                <p className="text-xs font-medium text-zinc-300 mb-2">Completed jobs by model (30 days)</p>
                <div className="space-y-1.5">
                  {data.spendByModel.map((m) => (
                    <div key={m.model_id} className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-300 w-32 truncate">{m.model_id}</span>
                      <span className="text-zinc-400">{m.completed} done</span>
                      <span className="text-zinc-400">{m.credits} cr</span>
                      <span className="text-zinc-400 ml-auto">
                        {m.usd > 0 ? `$${m.usd.toFixed(2)}` : "cost not reported"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Provider cost is only recorded where the provider reports it, so margin
                  per tier is not yet computable. Treat these credit totals as
                  revenue-side only until cost_usd is populated.
                </p>
              </>
            )}
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
