"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard, SkeletonVideoCard } from "@/components/ui/skeleton";
import { PageTransition, StaggerGroup, StaggerItem, AnimatedCounter, MotionSection, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
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
  Brain,
  Crown,
  Rocket,
  Video,
} from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const { user, activeJobs, videos, isInitialized } = useStore();
  const isLoading = !isInitialized;

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
      label: "Brain Studio",
      desc: "Multi-scene AI director",
      icon: Brain,
      href: "/brain",
      gradient: "from-cyan-600 to-blue-600",
      shadow: "shadow-cyan-600/25",
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
      title: "Talking Avatar",
      desc: "Upload a photo and make it talk with AI lip-sync",
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

      {/* ====== STATS ROW ====== */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <StaggerGroup className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Credits", value: user?.creditBalance ?? 50, icon: Zap, color: "violet" },
            { label: "Videos", value: (videos || []).length, icon: Film, color: "emerald" },
            { label: "Active Jobs", value: pendingJobs.length, icon: Clock, color: "amber" },
            { label: "Plan", value: planLabel, icon: user?.plan === "free" ? Rocket : Crown, color: "cyan" },
          ].map((stat) => {
            const c = colorMap[stat.color] || colorMap.violet;
            return (
              <StaggerItem key={stat.label}>
                <motion.div
                  className={`relative rounded-xl border ${c.border} bg-gradient-to-br from-${stat.color}-500/10 to-transparent p-4 overflow-hidden group cursor-default`}
                  whileHover={{ y: -2 }}
                >
                  <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${c.bg} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-zinc-500 font-medium">{stat.label}</p>
                      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                        <stat.icon className={`w-4 h-4 ${c.text}`} />
                      </div>
                    </div>
                    {typeof stat.value === "number" ? (
                      <AnimatedCounter value={stat.value} className="text-2xl font-bold text-white" />
                    ) : (
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    )}
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}

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
                  <div key={job.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 relative">
                        <div className="absolute inset-0 rounded-xl bg-violet-500/10 animate-ping" />
                        <Sparkles className="w-4 h-4 text-violet-400 relative z-10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate font-medium">&ldquo;{job.prompt}&rdquo;</p>
                        <span className="text-[11px] text-zinc-600">{job.duration || 5}s</span>
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

      {/* ====== RECOMMENDED FOR YOU ====== */}
      <MotionSection delay={0.2}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Recommended for You</h2>
          </div>
        </div>
        <StaggerGroup fast className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {recommended.map((item) => {
            const c = colorMap[item.color] || colorMap.violet;
            return (
              <StaggerItem key={item.title}>
                <Link href={item.href}>
                  <motion.div
                    className={`rounded-xl border ${c.border} bg-[#111118]/80 p-4 cursor-pointer group transition-all duration-300 hover:shadow-lg ${c.glow}`}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <item.icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <p className="text-sm font-semibold text-zinc-200 mb-1">{item.title}</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{item.desc}</p>
                  </motion.div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </MotionSection>

      {/* ====== CREDIT USAGE ====== */}
      <MotionSection delay={0.25}>
        <div className="rounded-xl border border-white/[0.06] bg-[#111118]/60 p-5">
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
            <span className="text-sm text-zinc-500 mb-1">/ {user?.monthlyCreditsLimit ?? 50} credits</span>
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
          <p className="text-[11px] text-zinc-600">
            Credits reset monthly. Purchased credit packs never expire.
          </p>
        </div>
      </MotionSection>

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
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-white/[0.06] flex items-center justify-center mx-auto mb-4"
            >
              <Film className="w-7 h-7 text-zinc-500" />
            </motion.div>
            <h3 className="text-base font-semibold text-zinc-300 mb-1">No videos yet</h3>
            <p className="text-sm text-zinc-600 mb-5 max-w-xs mx-auto">
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
            <Film className="w-6 h-6 text-zinc-700" />
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
          isHovered ? "border-violet-500/40" : "border-white/[0.06]"
        }`} />
      </motion.div>
    </Link>
  );
}
