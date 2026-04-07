"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageTransition,
  StaggerGroup,
  StaggerItem,
  AnimatedCounter,
  MotionSection,
} from "@/components/ui/motion";
import {
  Brain,
  Zap,
  Play,
  BarChart3,
  Globe,
  TrendingUp,
  Video,
  Send,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  ThumbsUp,
  Share2,
  MessageCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  today: { videosGenerated: number; postsCreated: number };
  week: {
    videosGenerated: number;
    postsCreated: number;
    totalViews: number;
    totalReactions: number;
    totalShares: number;
    totalComments: number;
    avgPerformanceScore: number;
  };
  topPosts: TopPost[];
  nicheBreakdowns: NicheBreakdown[];
}

interface TopPost {
  id: string;
  facebook_post_id: string | null;
  posted_at: string | null;
  views: number;
  reactions: number;
  shares: number;
  comments: number;
  performance_score: number;
  video_title: string;
  page_name: string;
  niche: string;
}

interface NicheBreakdown {
  niche: string;
  videoCount: number;
  postCount: number;
  totalViews: number;
  avgScore: number;
}

interface TrendData {
  date: string;
  trends: Trend[];
}

interface Trend {
  id: string;
  niche: string;
  headline: string;
  used: boolean;
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NICHES = ["news", "finance", "motivation", "entertainment"] as const;

const NICHE_CONFIG: Record<
  string,
  { label: string; gradient: string; icon: typeof Brain }
> = {
  news: { label: "News", gradient: "from-blue-600 to-cyan-600", icon: Globe },
  finance: {
    label: "Finance",
    gradient: "from-emerald-600 to-teal-600",
    icon: TrendingUp,
  },
  motivation: {
    label: "Motivation",
    gradient: "from-violet-600 to-purple-600",
    icon: Zap,
  },
  entertainment: {
    label: "Entertainment",
    gradient: "from-pink-600 to-rose-600",
    icon: Play,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 100) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (score >= 30) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

function scoreLabel(score: number): string {
  if (score >= 100) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudioDashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [engineRunning] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [analyticsRes, trendsRes] = await Promise.all([
        fetch("/api/studio/analytics"),
        fetch(`/api/studio/trends?date=${today}`),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data);
      }
    } catch (err) {
      console.error("[Studio] Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Action handlers
  const handleFetchTrends = async () => {
    setActionLoading("trends");
    try {
      await fetch("/api/studio/trends/fetch", { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error("[Studio] Fetch trends error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateScripts = async () => {
    setActionLoading("scripts");
    try {
      const unusedTrends =
        trends?.trends?.filter((t) => !t.used) || [];
      await Promise.all(
        unusedTrends.map((trend) =>
          fetch("/api/studio/scripts/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trendId: trend.id }),
          })
        )
      );
      await fetchData();
    } catch (err) {
      console.error("[Studio] Generate scripts error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncAnalytics = async () => {
    setActionLoading("sync");
    try {
      await fetch("/api/studio/analytics/sync");
      await fetchData();
    } catch (err) {
      console.error("[Studio] Sync analytics error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Get trend for a specific niche
  const getTrendForNiche = (niche: string): Trend | undefined => {
    return trends?.trends?.find((t) => t.niche === niche);
  };

  // Get niche breakdown
  const getNicheBreakdown = (niche: string): NicheBreakdown | undefined => {
    return analytics?.nicheBreakdowns?.find((b) => b.niche === niche);
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-zinc-400 text-sm">Loading Content Engine...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-8 pb-12">
        {/* ---------------------------------------------------------------- */}
        {/* Header */}
        {/* ---------------------------------------------------------------- */}
        <MotionSection>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                <Brain className="w-8 h-8 text-violet-500" />
                Content Engine
              </h1>
              <p className="text-zinc-400 mt-1">
                Automated content pipeline — trends, scripts, videos, posts
              </p>
            </div>
            <Badge
              className={`px-3 py-1.5 text-sm font-medium border ${
                engineRunning
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  engineRunning
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              {engineRunning ? "Running" : "Paused"}
            </Badge>
          </div>
        </MotionSection>

        {/* ---------------------------------------------------------------- */}
        {/* Quick Stats Row */}
        {/* ---------------------------------------------------------------- */}
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <Card className="bg-zinc-900/80 border-zinc-800 hover:border-violet-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Videos Today</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      <AnimatedCounter
                        value={analytics?.today.videosGenerated ?? 0}
                      />
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <Video className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="bg-zinc-900/80 border-zinc-800 hover:border-blue-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Posts Today</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      <AnimatedCounter
                        value={analytics?.today.postsCreated ?? 0}
                      />
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <Send className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="bg-zinc-900/80 border-zinc-800 hover:border-emerald-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Views This Week</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      <AnimatedCounter
                        value={analytics?.week.totalViews ?? 0}
                      />
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="bg-zinc-900/80 border-zinc-800 hover:border-amber-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Avg. Score</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      <AnimatedCounter
                        value={analytics?.week.avgPerformanceScore ?? 0}
                        suffix=""
                      />
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerGroup>

        {/* ---------------------------------------------------------------- */}
        {/* Today's Pipeline */}
        {/* ---------------------------------------------------------------- */}
        <MotionSection delay={0.1}>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-400" />
            Today&apos;s Pipeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {NICHES.map((niche) => {
              const config = NICHE_CONFIG[niche];
              const trend = getTrendForNiche(niche);
              const breakdown = getNicheBreakdown(niche);
              const NicheIcon = config.icon;

              return (
                <Card
                  key={niche}
                  className="bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}
                      >
                        <NicheIcon className="w-4 h-4 text-white" />
                      </div>
                      <CardTitle className="text-sm font-medium text-white">
                        {config.label}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Trend headline */}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        Trend
                      </p>
                      <p className="text-sm text-zinc-300 line-clamp-2">
                        {trend?.headline || "No trend today"}
                      </p>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-zinc-400">
                        {trend?.used ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        Script:{" "}
                        {trend?.used ? (
                          <span className="text-emerald-400">Ready</span>
                        ) : (
                          <span className="text-amber-400">Pending</span>
                        )}
                      </span>
                    </div>

                    {/* Stats */}
                    {breakdown && breakdown.videoCount > 0 && (
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{breakdown.videoCount} videos</span>
                        <span>{breakdown.totalViews} views</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 pt-1">
                      {!trend?.used && trend && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                          onClick={async () => {
                            setActionLoading(`script-${niche}`);
                            try {
                              await fetch("/api/studio/scripts/generate", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ trendId: trend.id }),
                              });
                              await fetchData();
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                          disabled={actionLoading === `script-${niche}`}
                        >
                          {actionLoading === `script-${niche}` ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : null}
                          Generate Script
                        </Button>
                      )}
                      {trend?.used && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                          onClick={async () => {
                            setActionLoading(`video-${niche}`);
                            try {
                              await fetch("/api/studio/videos/generate", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ niche }),
                              });
                              await fetchData();
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                          disabled={actionLoading === `video-${niche}`}
                        >
                          {actionLoading === `video-${niche}` ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : null}
                          Create Video
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </MotionSection>

        {/* ---------------------------------------------------------------- */}
        {/* Recent Posts */}
        {/* ---------------------------------------------------------------- */}
        <MotionSection delay={0.2}>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Top Performing Posts
          </h2>
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-0">
              {analytics?.topPosts && analytics.topPosts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-xs text-zinc-500 font-medium p-4 pb-3">
                          Video
                        </th>
                        <th className="text-left text-xs text-zinc-500 font-medium p-4 pb-3">
                          Page
                        </th>
                        <th className="text-left text-xs text-zinc-500 font-medium p-4 pb-3">
                          Posted
                        </th>
                        <th className="text-center text-xs text-zinc-500 font-medium p-4 pb-3">
                          <Eye className="w-3.5 h-3.5 inline" />
                        </th>
                        <th className="text-center text-xs text-zinc-500 font-medium p-4 pb-3">
                          <ThumbsUp className="w-3.5 h-3.5 inline" />
                        </th>
                        <th className="text-center text-xs text-zinc-500 font-medium p-4 pb-3">
                          <Share2 className="w-3.5 h-3.5 inline" />
                        </th>
                        <th className="text-center text-xs text-zinc-500 font-medium p-4 pb-3">
                          <MessageCircle className="w-3.5 h-3.5 inline" />
                        </th>
                        <th className="text-center text-xs text-zinc-500 font-medium p-4 pb-3">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topPosts.map((post) => (
                        <tr
                          key={post.id}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`text-[10px] px-1.5 py-0.5 border ${
                                  NICHE_CONFIG[post.niche]
                                    ? `bg-gradient-to-r ${NICHE_CONFIG[post.niche].gradient} text-white border-transparent`
                                    : "bg-zinc-700 text-zinc-300 border-zinc-600"
                                }`}
                              >
                                {post.niche}
                              </Badge>
                              <span className="text-sm text-zinc-200 max-w-[200px] truncate">
                                {post.video_title}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-zinc-400">
                            {post.page_name}
                          </td>
                          <td className="p-4 text-sm text-zinc-500">
                            {formatTimeAgo(post.posted_at)}
                          </td>
                          <td className="p-4 text-center text-sm text-zinc-300">
                            {post.views.toLocaleString()}
                          </td>
                          <td className="p-4 text-center text-sm text-zinc-300">
                            {post.reactions.toLocaleString()}
                          </td>
                          <td className="p-4 text-center text-sm text-zinc-300">
                            {post.shares.toLocaleString()}
                          </td>
                          <td className="p-4 text-center text-sm text-zinc-300">
                            {post.comments.toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <Badge
                              className={`text-xs border ${scoreColor(post.performance_score)}`}
                            >
                              {scoreLabel(post.performance_score)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <BarChart3 className="w-10 h-10 mb-3 text-zinc-600" />
                  <p className="text-sm">No posts yet this week</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Posts will appear here after publishing
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </MotionSection>

        {/* ---------------------------------------------------------------- */}
        {/* Actions Bar */}
        {/* ---------------------------------------------------------------- */}
        <MotionSection delay={0.3}>
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleFetchTrends}
                  disabled={actionLoading === "trends"}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0"
                >
                  {actionLoading === "trends" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mr-2" />
                  )}
                  Fetch Trends
                </Button>

                <Button
                  onClick={handleGenerateScripts}
                  disabled={actionLoading === "scripts"}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0"
                >
                  {actionLoading === "scripts" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Brain className="w-4 h-4 mr-2" />
                  )}
                  Generate All Scripts
                </Button>

                <Button
                  onClick={handleSyncAnalytics}
                  disabled={actionLoading === "sync"}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0"
                >
                  {actionLoading === "sync" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync Analytics
                </Button>

                <Link href="/api/studio/facebook/auth">
                  <Button
                    variant="outline"
                    className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Connect Facebook
                  </Button>
                </Link>

                <Link href="/studio/setup">
                  <Button
                    variant="outline"
                    className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Setup
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </MotionSection>
      </div>
    </PageTransition>
  );
}
