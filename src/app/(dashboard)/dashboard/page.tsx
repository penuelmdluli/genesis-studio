"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard, SkeletonVideoCard } from "@/components/ui/skeleton";
import { PageTransition, StaggerGroup, StaggerItem, AnimatedCounter, MotionSection, GlowCard, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import {
  Sparkles,
  Film,
  Zap,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardPage() {
  const { user, activeJobs, videos } = useStore();
  const isLoading = !user;

  const numericStats = [
    {
      label: "Credit Balance",
      numValue: user?.isOwner ? -1 : (user?.creditBalance ?? 50),
      icon: Zap,
      gradient: "from-violet-500/20 to-violet-500/5",
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-400",
      border: "border-violet-500/10",
    },
    {
      label: "Videos Created",
      numValue: videos.length,
      icon: Film,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
      border: "border-emerald-500/10",
    },
    {
      label: "Active Jobs",
      numValue: activeJobs.filter((j) => j.status === "processing" || j.status === "queued").length,
      icon: Clock,
      gradient: "from-amber-500/20 to-amber-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-400",
      border: "border-amber-500/10",
    },
  ];

  const planLabel = (user?.plan ?? "free").charAt(0).toUpperCase() + (user?.plan ?? "free").slice(1);

  return (
    <PageTransition className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Here&apos;s what&apos;s happening with your creations.
          </p>
        </div>
        <Link href="/generate">
          <Button className="shadow-lg shadow-violet-600/20">
            <Sparkles className="w-4 h-4" /> Generate Video
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {numericStats.map((stat) => (
            <StaggerItem key={stat.label}>
              <GlowCard className={`rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} p-5`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1.5">{stat.label}</p>
                    {stat.numValue === -1 ? (
                      <span className="text-2xl font-bold text-zinc-100">&infin;</span>
                    ) : (
                      <AnimatedCounter
                        value={stat.numValue}
                        className="text-2xl font-bold text-zinc-100"
                      />
                    )}
                  </div>
                  <motion.div
                    className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </motion.div>
                </div>
              </GlowCard>
            </StaggerItem>
          ))}
          {/* Plan card — not numeric, uses text */}
          <StaggerItem>
            <GlowCard className="rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-medium mb-1.5">Current Plan</p>
                  <p className="text-2xl font-bold text-zinc-100">{planLabel}</p>
                </div>
                <motion.div
                  className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </motion.div>
              </div>
            </GlowCard>
          </StaggerItem>
        </StaggerGroup>
      )}

      {/* Credit Usage */}
      <MotionSection delay={0.1}>
        <Card glow>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                </div>
                Monthly Credit Usage
              </CardTitle>
              <Link href="/pricing" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
                Upgrade <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  {user?.monthlyCreditsUsed ?? 0} / {user?.monthlyCreditsLimit ?? 50} credits used
                </span>
                <span className="text-violet-400 font-semibold">
                  {user?.monthlyCreditsLimit
                    ? Math.round(((user?.monthlyCreditsUsed ?? 0) / user.monthlyCreditsLimit) * 100)
                    : 0}%
                </span>
              </div>
              <Progress
                value={
                  user?.monthlyCreditsLimit
                    ? ((user?.monthlyCreditsUsed ?? 0) / user.monthlyCreditsLimit) * 100
                    : 0
                }
                size="md"
              />
              <p className="text-xs text-zinc-500">
                Credits reset monthly with your subscription. Purchased credit packs never expire.
              </p>
            </div>
          </CardContent>
        </Card>
      </MotionSection>

      {/* Active Jobs */}
      <MotionSection delay={0.15}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                Active Generations
              </CardTitle>
              <Link href="/gallery" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activeJobs.length === 0 ? (
              <div className="text-center py-10 relative">
                <div className="absolute inset-0 bg-glow-center opacity-30" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No active generations</p>
                  <p className="text-xs text-zinc-600 mb-4">Your generated videos will appear here</p>
                  <Link href="/generate">
                    <Button variant="outline" size="sm">
                      Create your first video
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeJobs.slice(0, 5).map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{job.prompt}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "emerald"
                              : job.status === "failed"
                              ? "red"
                              : job.status === "processing"
                              ? "amber"
                              : "default"
                          }
                        >
                          {job.status}
                        </Badge>
                        <span className="text-xs text-zinc-600">{job.modelId}</span>
                      </div>
                    </div>
                    {job.status === "processing" && (
                      <div className="w-28 shrink-0">
                        <Progress value={job.progress} size="sm" showLabel />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </MotionSection>

      {/* Recent Videos */}
      <MotionSection delay={0.2}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Film className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                Recent Videos
              </CardTitle>
              <Link href="/gallery" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonVideoCard key={i} />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-10 relative">
                <div className="absolute inset-0 bg-glow-center opacity-30" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <Film className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No videos yet</p>
                  <p className="text-xs text-zinc-600">Start generating to build your library</p>
                </div>
              </div>
            ) : (
              <StaggerGroup fast className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {videos.slice(0, 8).map((video) => (
                  <StaggerItem key={video.id}>
                    <Link
                      href="/gallery"
                      className="relative group rounded-xl overflow-hidden border border-white/[0.06] bg-[#111118] aspect-video cursor-pointer block"
                    >
                      <motion.div
                        className="w-full h-full"
                        whileHover={{ scale: 1.03 }}
                        transition={{ duration: 0.25 }}
                      >
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-900/20 via-[#111118] to-fuchsia-900/10 p-2">
                            <Film className="w-5 h-5 text-violet-500/50 mb-1" />
                            <p className="text-[9px] text-zinc-500 text-center line-clamp-2">{video.title}</p>
                            <p className="text-[8px] text-zinc-600 mt-0.5">{video.resolution} · {video.duration}s</p>
                          </div>
                        )}
                      </motion.div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                        <div>
                          <p className="text-xs font-medium text-zinc-200 truncate">{video.title}</p>
                          <p className="text-[10px] text-zinc-400">{video.resolution} · {video.duration}s</p>
                        </div>
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </MotionSection>
    </PageTransition>
  );
}
