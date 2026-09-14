"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard, SkeletonVideoCard } from "@/components/ui/skeleton";
import { PageTransition, StaggerGroup, StaggerItem, AnimatedCounter, MotionSection, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import {
  Sparkles,
  Film,
  Zap,
  Clock,
  ArrowRight,
  Play,
  ArrowUpRight,
  Volume2,
  Move,
  Mic,
  Type,
  ImageIcon,
  Wand2,
  Crown,
  Rocket,
  Video,
} from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

// Every tool that actually works today, grouped by what the creator is
// trying to do rather than by which model powers it. Anything still dark
// (Brain Studio, Product Ads, Music Video) is deliberately absent — the
// dashboard must never advertise something that cannot run.
const TOOL_GROUPS: Array<{
  name: string;
  items: Array<{ href: string; icon: string; title: string; desc: string; badge?: string }>;
}> = [
  {
    name: "Make a video",
    items: [
      { href: "/generate", icon: "🎬", title: "Generate", desc: "Describe a scene, get a cinematic clip with sound" },
      { href: "/motion-control", icon: "🕺", title: "Motion Control", desc: "Put any dance or move onto your character", badge: "HOT" },
      { href: "/talking-avatar", icon: "🗣️", title: "AI Avatar", desc: "A photo speaks your script, in SA English too" },
      { href: "/ai-singer", icon: "🎤", title: "AI Singer", desc: "Your face singing your lyrics, any genre", badge: "NEW" },
      { href: "/react-studio", icon: "👥", title: "React Studio", desc: "Put yourself inside a scene with your own photos" },
    ],
  },
  {
    name: "Finish it properly",
    items: [
      { href: "/tools", icon: "🧰", title: "Creator Tools", desc: "Add sound, dub, remove background, make a beat", badge: "NEW" },
      { href: "/captions", icon: "💬", title: "Auto Captions", desc: "Feeds play on mute — captions in 75+ languages" },
      { href: "/voiceover", icon: "🎧", title: "AI Voiceover", desc: "Natural narration, free on every plan" },
      { href: "/upscale", icon: "🔍", title: "Upscaler", desc: "Push a clip to crisp 1080p or 4K" },
      { href: "/thumbnails", icon: "🖼️", title: "AI Thumbnails", desc: "Covers people actually click" },
      { href: "/images", icon: "🎨", title: "Image Gen", desc: "Posters, characters, product shots" },
    ],
  },
  {
    name: "Grow your page",
    items: [
      { href: "/series", icon: "🎬", title: "Series Studio", desc: "A drama in your language, episode after episode", badge: "NEW" },
      { href: "/grow", icon: "🔥", title: "Weekly plan", desc: "One loop a week: make, finish, post", badge: "NEW" },
      { href: "/explore", icon: "🌍", title: "Explore", desc: "See what is working for other creators" },
      { href: "/gallery", icon: "📁", title: "Your Gallery", desc: "Everything you have made, ready to post" },
      { href: "/lead-videos", icon: "🔗", title: "Lead Videos", desc: "Paste a trending reel to reuse its motion" },
    ],
  },
];

export default function DashboardPage() {
  const { user, activeJobs, videos, isInitialized, setUser } = useStore();
  const { toast } = useToast();
  const isLoading = !isInitialized;

  // Landing back from a checkout. Don't just celebrate — confirm the payment
  // with the provider and credit the account right now, then reload the user
  // so the balance on screen is real. The webhook may still be in flight (or,
  // as happened for months, never arrive); this path does not depend on it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPlan = params.get("success") === "true";
    const isPack = params.get("pack_success") === "true";
    if (!isPlan && !isPack) return;
    window.history.replaceState({}, "", "/dashboard");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/verify", { method: "POST" });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;

        if (data?.credited || data?.alreadyCredited) {
          toast(
            isPlan ? "Payment confirmed — your plan is active!" : "Payment confirmed — credits added to your account!",
            "success"
          );
        } else {
          toast("Payment received. Your credits will appear within a few minutes.", "info");
        }

        const userRes = await fetch("/api/user");
        if (userRes.ok && !cancelled) setUser(await userRes.json());
      } catch {
        if (!cancelled) toast("Payment received. Your credits will appear within a few minutes.", "info");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, setUser]);

  // What is working on the platforms right now. The dashboard used to push
  // "Generate Video" no matter what — useful once, then wallpaper. A creator
  // opening this needs an idea, not a reminder that generation exists.
  const [trends, setTrends] = useState<Array<{
    id: string;
    title: string;
    description: string;
    platform: string;
    category: string;
    suggestedPrompt: string;
  }>>([]);
  useEffect(() => {
    fetch("/api/trends")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTrends((d?.trends || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  const pendingJobs = (activeJobs || []).filter(
    (j) => j.status === "processing" || j.status === "queued"
  );

  const planLabel = (user?.plan ?? "free").charAt(0).toUpperCase() + (user?.plan ?? "free").slice(1);
  const totalDuration = (videos || []).reduce((sum, v) => sum + (v.duration || 0), 0);

  const quickActions = [
    {
      label: "Generate Video",
      desc: "Text or image to video",
      icon: Sparkles,
      href: "/generate",
      gradient: "from-violet-600 to-fuchsia-600",
      shadow: "shadow-violet-600/25",
    },
    {
      label: "Motion Control",
      desc: "40+ fun effects",
      icon: Move,
      href: "/motion-control",
      gradient: "from-fuchsia-600 to-pink-600",
      shadow: "shadow-fuchsia-600/25",
      hot: true,
    },
    {
      label: "Creator Tools",
      desc: "Add sound, dub, remove BG, beats",
      icon: Wand2,
      href: "/tools",
      gradient: "from-cyan-600 to-blue-600",
      shadow: "shadow-cyan-600/25",
      hot: true,
    },
    {
      label: "AI Voiceover",
      desc: "Add voice to videos",
      icon: Mic,
      href: "/voiceover",
      gradient: "from-amber-600 to-orange-600",
      shadow: "shadow-amber-600/25",
    },
  ];

  const recommended = [
    {
      title: "Text to Video",
      desc: "Describe a scene and watch AI bring it to life in seconds",
      icon: Video,
      href: "/generate",
      color: "violet",
    },
    {
      title: "AI Avatar",
      desc: "Make any face speak with AI lip-sync",
      icon: Mic,
      href: "/talking-avatar",
      color: "fuchsia",
    },
    {
      title: "Auto Captions",
      desc: "Add beautiful animated captions to any video",
      icon: Type,
      href: "/captions",
      color: "cyan",
    },
    {
      title: "AI Upscaler",
      desc: "Enhance video quality to 4K with AI super-resolution",
      icon: ArrowUpRight,
      href: "/upscale",
      color: "emerald",
    },
    {
      title: "AI Thumbnails",
      desc: "Generate eye-catching thumbnails for your videos",
      icon: ImageIcon,
      href: "/thumbnails",
      color: "amber",
    },
    {
      title: "Motion Effects",
      desc: "Apply 40+ fun effects — dance, gesture, fantasy and more",
      icon: Move,
      href: "/motion-control",
      color: "pink",
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", glow: "hover:shadow-violet-500/10" },
    fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", border: "border-fuchsia-500/20", glow: "hover:shadow-fuchsia-500/10" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", glow: "hover:shadow-cyan-500/10" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", glow: "hover:shadow-emerald-500/10" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", glow: "hover:shadow-amber-500/10" },
    pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20", glow: "hover:shadow-pink-500/10" },
  };

  return (
    <PageTransition className="space-y-8">
      {/* ====== HERO HEADER ====== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950/60 via-[#111118] to-fuchsia-950/40 border border-violet-500/10 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              <motion.span
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 2.5, delay: 0.5, repeat: Infinity, repeatDelay: 5 }}
                className="text-2xl"
              >
                {"\u{1F44B}"}
              </motion.span>
            </div>
            <p className="text-sm text-zinc-400">
              {(videos || []).length > 0
                ? `You've created ${(videos || []).length} videos (${totalDuration}s of footage). Keep creating!`
                : "Ready to create something amazing? Let's get started."}
            </p>
          </div>
          <Link href="/generate">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button className="shadow-lg shadow-violet-600/30 text-base px-6 py-3">
                <Sparkles className="w-5 h-5" /> Generate Video
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>

      {/* ====== AT A GLANCE ======
          Four large cards for numbers the sidebar already shows pushed the
          actual product below the fold. Same information, one line. */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "credits", value: (user?.creditBalance ?? 0).toLocaleString(), icon: Zap, tone: "text-violet-300 bg-violet-500/10 border-violet-500/25" },
          { label: "videos", value: String((videos || []).length), icon: Film, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
          ...(pendingJobs.length > 0
            ? [{ label: "rendering now", value: String(pendingJobs.length), icon: Clock, tone: "text-amber-300 bg-amber-500/10 border-amber-500/25" }]
            : []),
          { label: "plan", value: planLabel, icon: user?.plan === "free" ? Rocket : Crown, tone: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25" },
        ].map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${s.tone}`}
          >
            <s.icon className="w-3.5 h-3.5" />
            <strong className="text-white font-semibold">{s.value}</strong>
            {s.label}
          </span>
        ))}
      </div>

      {/* ====== QUICK ACTIONS ====== */}
      <MotionSection delay={0.1}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <Link key={action.label} href={action.href}>
              <motion.div
                className={`relative rounded-xl p-4 bg-gradient-to-br ${action.gradient} overflow-hidden cursor-pointer group`}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-lg" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <action.icon className="w-6 h-6 text-white" />
                    {action.hot && (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1], opacity: [1, 0.85, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        className="relative"
                      >
                        <div className="absolute inset-0 rounded-full bg-red-500/40 blur-md animate-ping" />
                        <Badge className="relative bg-gradient-to-r from-red-500 to-orange-500 text-white text-[9px] font-black border-0 shadow-lg shadow-red-500/40 px-2 py-0.5 tracking-wider">
                          🔥 HOT
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">{action.label}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{action.desc}</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </MotionSection>

      {/* ====== ACTIVE GENERATIONS ====== */}
      {pendingJobs.length > 0 && (
        <MotionSection delay={0.15}>
          <div className="relative rounded-2xl overflow-hidden border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-[#111118] to-fuchsia-950/20">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.03] to-transparent animate-[shimmer_3s_infinite]" />
            </div>
            <div className="relative p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-violet-500 animate-ping" />
                </div>
                <span className="text-sm font-medium text-violet-300">
                  {pendingJobs.length} generation{pendingJobs.length > 1 ? "s" : ""} in progress
                </span>
                <Link href="/gallery" className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  View all <ArrowRight className="w-3 h-3 inline" />
                </Link>
              </div>
              <div className="space-y-3">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 relative">
                        <div className="absolute inset-0 rounded-xl bg-violet-500/10 animate-ping" />
                        <Sparkles className="w-4 h-4 text-violet-400 relative z-10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate font-medium">&ldquo;{job.prompt}&rdquo;</p>
                        <span className="text-[11px] text-zinc-400">{job.duration || 5}s</span>
                      </div>
                      <Badge variant={job.status === "processing" ? "amber" : "default"} className="text-[10px]">
                        {job.status === "processing" ? "Generating..." : "In Queue"}
                      </Badge>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        initial={{ width: "5%" }}
                        animate={{ width: job.progress > 0 ? `${job.progress}%` : "40%" }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MotionSection>
      )}

      {/* ====== TRENDING NOW ====== */}
      {trends.length > 0 && (
        <MotionSection>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Trending now
            </h2>
            <span className="text-xs text-zinc-500">Tap one to make it</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trends.map((t) => (
              <a
                key={t.id}
                href={`/generate?prompt=${encodeURIComponent(t.suggestedPrompt)}`}
                className="group rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.05] to-transparent p-4 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10"
              >
                <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  {t.platform}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-zinc-100 leading-snug">{t.title}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-snug line-clamp-2">{t.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Make this <ArrowRight className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </MotionSection>
      )}

      {/* ====== EVERYTHING YOU CAN MAKE ======
          The dashboard is the shop window. Six hand-picked "recommended"
          cards meant most of the product was invisible unless you already
          knew the sidebar — so this lists every tool that actually works,
          grouped by what you are trying to do, with what it is for. */}
      <MotionSection delay={0.2}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Everything you can make</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Every tool, one tap away</p>
          </div>
        </div>

        {TOOL_GROUPS.map((group) => (
          <div key={group.name} className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-0.5">
              {group.name}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {group.items.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group relative rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.05] to-transparent p-3.5 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl leading-none shrink-0">{t.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100 leading-tight">{t.title}</span>
                        {t.badge && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                            t.badge === "HOT"
                              ? "bg-orange-500/20 text-orange-300 border-orange-400/30"
                              : "bg-violet-500/20 text-violet-200 border-violet-400/30"
                          }`}>
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-1">{t.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </MotionSection>

      {/* ====== CREDIT USAGE ====== */}
      <MotionSection delay={0.25}>
        <div className="rounded-xl border border-white/[0.10] bg-[#111118]/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-zinc-200">Monthly Credits</span>
            </div>
            <Link href="/pricing" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
              Upgrade <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-bold text-white">{user?.monthlyCreditsUsed ?? 0}</span>
            <span className="text-sm text-zinc-400 mb-1">/ {user?.monthlyCreditsLimit ?? 50} credits</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{
                width: `${user?.monthlyCreditsLimit
                  ? Math.min(((user?.monthlyCreditsUsed ?? 0) / user.monthlyCreditsLimit) * 100, 100)
                  : 0}%`,
              }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Credits reset monthly. Purchased credit packs never expire.
          </p>
        </div>
      </MotionSection>

      {/* ====== CREATOR STATS ====== */}
      <MotionSection delay={0.25}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.10] p-3 text-center">
            <p className="text-2xl font-bold text-violet-300">{(videos || []).length}</p>
            <p className="text-[10px] text-zinc-400">Videos Created</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.10] p-3 text-center">
            <p className="text-2xl font-bold text-cyan-300">{Math.round(totalDuration / 60)}m</p>
            <p className="text-[10px] text-zinc-400">Total Duration</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.10] p-3 text-center">
            <p className="text-2xl font-bold text-emerald-300">{user?.creditBalance?.toLocaleString() || 0}</p>
            <p className="text-[10px] text-zinc-400">Credits Left</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.10] p-3 text-center">
            <p className="text-2xl font-bold text-amber-300">{pendingJobs.length}</p>
            <p className="text-[10px] text-zinc-400">In Progress</p>
          </div>
        </div>
      </MotionSection>

      {/* ====== PLAN-AWARE UPSELL ======
          Free users who are running low: upgrade. Paid users running low: top
          up. Owners and anyone with plenty of credits: nothing. */}
      {!user?.isOwner && user && user.creditBalance < 200 && (
        <MotionSection delay={0.27}>
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-violet-500/5 p-4 flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">
                {user.plan === "free"
                  ? `${user.creditBalance} credits left on the Free plan`
                  : `${user.creditBalance} credits left this month`}
              </p>
              <p className="text-xs text-zinc-400">
                {user.plan === "free"
                  ? "Upgrade to Creator for 500 credits a month, premium models and 1080p."
                  : "Top up with a credit pack — credits never expire."}
              </p>
            </div>
            <Link
              href="/pricing"
              className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors shrink-0"
            >
              {user.plan === "free" ? "Upgrade" : "Buy credits"}
            </Link>
          </div>
        </MotionSection>
      )}

      {/* ====== REFERRAL BANNER (free plan only) ====== */}
      {!user?.isOwner && user?.plan === "free" && (
        <MotionSection delay={0.28}>
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-cyan-500/5 p-4 flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
              <span className="text-lg">🎁</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">Earn bonus credits</p>
              <p className="text-xs text-zinc-400">Invite a friend → you both get bonus credits</p>
            </div>
            <button
              onClick={() => {
                const text = encodeURIComponent("I've been using iVideo Studio to create AI videos — it's insane! Try it free:\n\nhttps://ivideostudio.ai/sign-up");
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
              className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors shrink-0"
            >
              Share on WhatsApp
            </button>
          </div>
        </MotionSection>
      )}

      {/* ====== RECENT VIDEOS ====== */}
      <MotionSection delay={0.3}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Film className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Recent Videos</h2>
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {(videos || []).length}
            </Badge>
          </div>
          <Link href="/gallery" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <SkeletonVideoCard key={i} />)}
          </div>
        ) : (videos || []).length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.01]">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-white/[0.10] flex items-center justify-center mx-auto mb-4"
            >
              <Film className="w-7 h-7 text-zinc-400" />
            </motion.div>
            <h3 className="text-base font-semibold text-zinc-300 mb-1">No videos yet</h3>
            <p className="text-sm text-zinc-400 mb-5 max-w-xs mx-auto">
              Create your first AI video and watch the magic happen
            </p>
            <Link href="/generate">
              <Button className="shadow-lg shadow-violet-600/20">
                <Sparkles className="w-4 h-4" /> Create Your First Video
              </Button>
            </Link>
          </div>
        ) : (
          <StaggerGroup fast className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(videos || []).slice(0, 8).map((video) => (
              <StaggerItem key={video.id}>
                <DashboardVideoCard video={video} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </MotionSection>
    </PageTransition>
  );
}

/* ================================================
   DashboardVideoCard — Hover-to-play mini card
   ================================================ */
function DashboardVideoCard({ video }: {
  video: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    title: string;
    prompt: string;
    duration: number;
    resolution: string;
    aspectRatio?: string;
    audioUrl?: string;
    createdAt: string;
  };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  return (
    <Link href="/gallery">
      <motion.div
        className="group relative rounded-xl overflow-hidden cursor-pointer aspect-video"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.04, boxShadow: "0 8px 30px rgba(139, 92, 246, 0.15)" }}
        transition={{ duration: 0.25 }}
      >
        {/* Loading state */}
        {video.url && !loaded && (
          <div className="absolute inset-0 z-[5] bg-[#0D0D14]">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/15 via-[#0D0D14] to-fuchsia-900/10" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <GenesisLoader size="md" />
            </div>
          </div>
        )}

        {video.url ? (
          <video
            ref={videoRef}
            src={`${video.url}#t=0.5`}
            className={`w-full h-full ${video.aspectRatio === "portrait" ? "object-contain" : "object-cover"} transition-transform duration-500 ${
              isHovered ? "scale-110" : "scale-100"
            }`}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/20 via-[#0D0D14] to-fuchsia-900/10">
            <Film className="w-6 h-6 text-zinc-400" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
          <p className="text-[11px] font-medium text-white truncate">{video.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-white/50">{video.resolution}</span>
            <span className="text-[10px] text-white/30">&middot;</span>
            <span className="text-[10px] text-white/50">{formatDuration(video.duration)}</span>
            {video.audioUrl && (
              <>
                <span className="text-[10px] text-white/30">&middot;</span>
                <Volume2 className="w-2.5 h-2.5 text-violet-300" />
              </>
            )}
          </div>
        </div>

        {/* Play icon on hover */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-black/60 text-white backdrop-blur-sm">
            {formatDuration(video.duration)}
          </span>
        </div>

        {/* Hover border */}
        <div className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 pointer-events-none ${
          isHovered ? "border-violet-500/40" : "border-white/[0.10]"
        }`} />
      </motion.div>
    </Link>
  );
}
