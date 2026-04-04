"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/hooks/use-store";
import {
  Sparkles,
  Film,
  Zap,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
} from "lucide-react";

export default function DashboardPage() {
  const { user, activeJobs, videos } = useStore();

  const stats = [
    {
      label: "Credit Balance",
      value: user?.creditBalance?.toLocaleString() ?? "50",
      icon: Zap,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Videos Created",
      value: videos.length.toString(),
      icon: Film,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active Jobs",
      value: activeJobs.filter((j) => j.status === "processing" || j.status === "queued").length.toString(),
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Plan",
      value: (user?.plan ?? "free").charAt(0).toUpperCase() + (user?.plan ?? "free").slice(1),
      icon: TrendingUp,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
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
          <Button>
            <Sparkles className="w-4 h-4" /> Generate Video
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-400" />
            Monthly Credit Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">
                {user?.monthlyCreditsUsed ?? 0} / {user?.monthlyCreditsLimit ?? 50} credits used
              </span>
              <span className="text-violet-400 font-medium">
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
            />
            <p className="text-xs text-zinc-500">
              Credits reset monthly with your subscription. Purchased credit packs never expire.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Active Generations
            </CardTitle>
            <Link href="/gallery" className="text-xs text-violet-400 hover:text-violet-300">
              View all <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {activeJobs.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No active generations.</p>
              <Link href="/generate">
                <Button variant="outline" size="sm" className="mt-3">
                  Create your first video
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
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
                      <span className="text-xs text-zinc-500">{job.modelId}</span>
                    </div>
                  </div>
                  {job.status === "processing" && (
                    <div className="w-24">
                      <Progress value={job.progress} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Videos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-400" />
              Recent Videos
            </CardTitle>
            <Link href="/gallery" className="text-xs text-violet-400 hover:text-violet-300">
              View all <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-center py-8">
              <Film className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No videos yet. Start generating!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {videos.slice(0, 8).map((video) => (
                <div
                  key={video.id}
                  className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video cursor-pointer hover:border-violet-500/50 transition-colors"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <Film className="w-6 h-6 text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <p className="text-xs text-zinc-200 truncate">{video.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
