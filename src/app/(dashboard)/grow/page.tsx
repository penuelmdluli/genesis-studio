"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/motion";
import { ArrowRight, CheckCircle2, Circle, Flame, TrendingUp } from "lucide-react";

// The weekly loop. A page grows from posting every week, not from one good
// video, so this page answers one question — what is the next thing to do —
// from what the creator has actually made this week, never from a checklist
// they tick themselves.

interface GrowStatus {
  made: number;
  polished: number;
  target: number;
  pages: Array<{ id: string; name: string | null }>;
  next: { step: string; label: string; href: string; why: string };
  videos: Array<{ id: string; title: string; thumbnail_url?: string; url: string }>;
}

interface Trend {
  id: string;
  title: string;
  description: string;
  platform: string;
  suggestedPrompt: string;
}

const STEPS = [
  { key: "make", label: "Make it", hint: "Pick a trending format" },
  { key: "polish", label: "Finish it", hint: "Sound and captions" },
  { key: "publish", label: "Post it", hint: "While the trend is moving" },
];

export default function GrowPage() {
  const [status, setStatus] = useState<GrowStatus | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/grow/status").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/trends").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, t]) => {
        if (s) setStatus(s);
        if (t?.trends) setTrends(t.trends.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading your week…</div>;
  }

  const made = status?.made ?? 0;
  const target = status?.target ?? 3;
  const pct = Math.min(100, Math.round((made / target) * 100));
  const doneSteps = new Set<string>();
  if (made > 0) doneSteps.add("make");
  if ((status?.polished ?? 0) > 0) doneSteps.add("polish");
  if ((status?.pages.length ?? 0) > 0 && made > 0) doneSteps.add("publish");

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-400" />
          Grow your page
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          One loop, every week: make something on a trend, finish it properly, post it.
        </p>
      </div>

      {/* This week at a glance */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm font-medium text-zinc-300">This week</span>
            <span className="text-sm text-zinc-400">
              <strong className="text-white text-lg">{made}</strong> of {target} videos
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {STEPS.map((s) => {
              const done = doneSteps.has(s.key);
              return (
                <div
                  key={s.key}
                  className={`rounded-xl border p-3 ${
                    done ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${done ? "text-emerald-300" : "text-zinc-300"}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{s.hint}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* The single next action */}
      {status?.next && (
        <a
          href={status.next.href}
          className="block rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-[#12121a] to-cyan-950/30 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">Next up</span>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-lg font-bold text-white">{status.next.label}</h2>
            <ArrowRight className="w-4 h-4 text-violet-300" />
          </div>
          <p className="text-sm text-zinc-300 mt-1 leading-relaxed max-w-xl">{status.next.why}</p>
        </a>
      )}

      {/* Ideas that are moving right now */}
      {trends.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Working right now
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {trends.map((t) => (
              <a
                key={t.id}
                href={`/generate?prompt=${encodeURIComponent(t.suggestedPrompt)}`}
                className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-violet-500/40"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  {t.platform}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-zinc-100 leading-snug">{t.title}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-snug line-clamp-2">{t.description}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* What they already have this week */}
      {status && status.videos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Made this week</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {status.videos.map((v) => (
              <a key={v.id} href="/gallery" className="group">
                <div className="aspect-[9/16] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08]">
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600 px-2 text-center">
                      {v.title}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </PageTransition>
  );
}
