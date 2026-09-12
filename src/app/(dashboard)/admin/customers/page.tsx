"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/motion";
import { formatRelativeTime } from "@/lib/utils";
import {
  Users,
  Search,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Circle,
  LogIn,
  Eye,
  MousePointerClick,
  Film,
  Coins,
  ShoppingCart,
  CreditCard,
} from "lucide-react";

// Every customer, where they are in the journey, and — on click — everything
// they ever did with us in one time-ordered stream.

interface Customer {
  id: string;
  email: string;
  name: string;
  plan: string;
  credit_balance: number;
  created_at: string;
  plan_expires_at: string | null;
  is_owner: boolean;
  last_seen: string | null;
  last_path: string | null;
  page_views: number;
  events: number;
  jobs_total: number;
  jobs_completed: number;
  jobs_failed: number;
  last_job_status: string | null;
  last_job_error: string | null;
  videos: number;
  checkouts_started: number;
  checkouts_paid: number;
  credits_spent: number;
  stage: string;
}

interface TimelineItem {
  at: string;
  kind: "session" | "page" | "event" | "job" | "credit" | "checkout" | "payment";
  title: string;
  detail?: string;
  status?: "ok" | "fail" | "neutral";
}

interface Detail {
  user: Record<string, unknown>;
  summary: {
    firstSeen: string;
    lastSeen: string | null;
    lastPage: string | null;
    sessions: number;
    pageViews: number;
    jobs: number;
    jobsCompleted: number;
    jobsFailed: number;
    checkoutsStarted: number;
    payments: number;
    topPages: Array<{ path: string; n: number }>;
    modelsTried: Array<{ model: string; n: number }>;
  };
  timeline: TimelineItem[];
}

const STAGE_STYLE: Record<string, string> = {
  paying: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "abandoned checkout": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "activated (has a video)": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "tried, every generation failed": "bg-red-500/15 text-red-300 border-red-500/30",
  generating: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "browsing, never generated": "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  "signed up, never returned": "bg-zinc-700/30 text-zinc-400 border-zinc-600/30",
};

const KIND_ICON = {
  session: LogIn,
  page: Eye,
  event: MousePointerClick,
  job: Film,
  credit: Coins,
  checkout: ShoppingCart,
  payment: CreditCard,
};

function when(iso: string | null | undefined): string {
  if (!iso) return "never";
  try {
    return formatRelativeTime(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  } catch {
    return iso;
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stages, setStages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set());

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setStages(data.stages || {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/admin/customers/${selected.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const visible = customers.filter((c) => !stageFilter || c.stage === stageFilter);

  const toggleKind = (k: string) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const timeline = (detail?.timeline || []).filter((t) => kindFilter.size === 0 || kindFilter.has(t.kind));

  return (
    <PageTransition className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Users className="w-6 h-6 text-violet-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Customers</h1>
        <span className="text-sm text-zinc-500">{customers.length} accounts</span>
      </div>

      {/* Journey stages — click to filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(stages)
          .sort((a, b) => b[1] - a[1])
          .map(([stage, n]) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stageFilter === stage ? null : stage)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${STAGE_STYLE[stage] || STAGE_STYLE["browsing, never generated"]} ${stageFilter === stage ? "ring-2 ring-white/40" : "opacity-80 hover:opacity-100"}`}
            >
              {stage} · {n}
            </button>
          ))}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
          placeholder="Search by email or name, then press Enter"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50"
        />
      </div>

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[1fr_1.2fr]" : ""}`}>
        {/* List */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">Stage</th>
                  <th className="text-left px-3 py-2">Last seen</th>
                  <th className="text-right px-3 py-2">Videos</th>
                  <th className="text-right px-3 py-2">Fails</th>
                  <th className="text-right px-3 py-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">Loading customers…</td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">No customers match.</td>
                  </tr>
                )}
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`border-t border-white/[0.06] cursor-pointer hover:bg-white/[0.03] ${selected?.id === c.id ? "bg-violet-500/10" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-200 truncate max-w-[220px]">{c.name || "—"}</div>
                      <div className="text-xs text-zinc-500 truncate max-w-[220px]">{c.email}</div>
                      <div className="flex gap-1 mt-1">
                        <Badge className="text-[10px] bg-white/5 text-zinc-300 border-white/10">{c.plan}</Badge>
                        {c.is_owner && <Badge className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/20">owner</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${STAGE_STYLE[c.stage] || ""}`}>{c.stage}</span>
                      {c.last_path && <div className="text-[11px] text-zinc-500 mt-1">last on {c.last_path}</div>}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                      {when(c.last_seen)}
                      <div className="text-[11px] text-zinc-500">joined {when(c.created_at)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300">{c.jobs_completed}</td>
                    <td className={`px-3 py-2 text-right ${c.jobs_failed > 0 ? "text-red-400" : "text-zinc-500"}`}>{c.jobs_failed}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{c.credit_balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <div className="rounded-xl border border-white/10 p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{selected.name || selected.email}</h2>
                <p className="text-sm text-zinc-500">{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-sm">Close</button>
            </div>

            {detailLoading && <p className="text-zinc-500 text-sm">Loading timeline…</p>}

            {detail && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
                  {[
                    { l: "Sign-ins", v: detail.summary.sessions },
                    { l: "Page views", v: detail.summary.pageViews },
                    { l: "Videos", v: detail.summary.jobsCompleted },
                    { l: "Failed", v: detail.summary.jobsFailed, warn: detail.summary.jobsFailed > 0 },
                    { l: "Checkouts", v: detail.summary.checkoutsStarted },
                    { l: "Payments", v: detail.summary.payments },
                    { l: "Credits", v: Number(detail.user.credit_balance || 0).toLocaleString() },
                    { l: "Plan", v: String(detail.user.plan) },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
                      <div className={`text-base font-semibold ${s.warn ? "text-red-400" : "text-zinc-100"}`}>{s.v}</div>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{s.l}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-zinc-400 mb-4 space-y-1">
                  <div>First seen <span className="text-zinc-200">{when(detail.summary.firstSeen)}</span> · last seen <span className="text-zinc-200">{when(detail.summary.lastSeen)}</span>{detail.summary.lastPage && <> · last page <span className="text-zinc-200">{detail.summary.lastPage}</span></>}</div>
                  {detail.summary.topPages.length > 0 && (
                    <div>Most visited: {detail.summary.topPages.map((p) => `${p.path} (${p.n})`).join(", ")}</div>
                  )}
                  {detail.summary.modelsTried.length > 0 && (
                    <div>Models tried: {detail.summary.modelsTried.map((m) => `${m.model} ×${m.n}`).join(", ")}</div>
                  )}
                  {selected.plan_expires_at && <div>Plan renews/ends {when(selected.plan_expires_at)}</div>}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {(Object.keys(KIND_ICON) as Array<keyof typeof KIND_ICON>).map((k) => (
                    <button
                      key={k}
                      onClick={() => toggleKind(k)}
                      className={`text-[11px] px-2 py-1 rounded border ${kindFilter.size === 0 || kindFilter.has(k) ? "border-violet-500/40 text-violet-200 bg-violet-500/10" : "border-white/10 text-zinc-500"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <ol className="space-y-2">
                  {timeline.map((t, i) => {
                    const Icon = KIND_ICON[t.kind];
                    const StatusIcon = t.status === "ok" ? CheckCircle : t.status === "fail" ? XCircle : Circle;
                    const colour = t.status === "ok" ? "text-emerald-400" : t.status === "fail" ? "text-red-400" : "text-zinc-600";
                    return (
                      <li key={i} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center pt-0.5">
                          <StatusIcon className={`w-3.5 h-3.5 ${colour}`} />
                        </div>
                        <div className="flex-1 min-w-0 pb-2 border-b border-white/[0.04]">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-zinc-200 truncate">{t.title}</span>
                            <span className="ml-auto text-[11px] text-zinc-500 whitespace-nowrap">{when(t.at)}</span>
                          </div>
                          {t.detail && <div className={`text-xs mt-0.5 ${t.status === "fail" ? "text-red-300/80" : "text-zinc-500"}`}>{t.detail}</div>}
                        </div>
                      </li>
                    );
                  })}
                  {timeline.length === 0 && <li className="text-sm text-zinc-500">Nothing recorded yet.</li>}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
