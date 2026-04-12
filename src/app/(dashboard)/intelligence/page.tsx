"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Music,
  Target,
  Zap,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  BarChart3,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface Insight {
  id: string;
  insight_type: string;
  insight_key: string;
  insight_value: Record<string, unknown>;
  confidence_score: number;
  sample_size: number;
  avg_performance_score: number;
  avg_views: number;
  avg_engagement_rate: number;
}

interface Decision {
  id: string;
  decision_type: string;
  before_value: string;
  after_value: string;
  reason: string;
  confidence_score: number;
  outcome_score: number | null;
  was_correct: boolean | null;
  created_at: string;
}

interface ViralFormula {
  formula_name: string;
  topic_category: string;
  hook_pattern: string;
  optimal_duration: number;
  optimal_hour: number;
  optimal_day: number;
  music_style: string;
  avg_viral_score: number;
  avg_views: number;
  success_rate: number;
  usage_count: number;
}

interface Summary {
  totalPosts: number;
  lockedPosts: number;
  totalDecisions: number;
  correctDecisions: number;
  avgPerformanceScore: number;
  insightCount: number;
  lastAnalysis: string | null;
  hasViralFormula: boolean;
}

interface TopPost {
  id: string;
  topic: string;
  topic_category: string;
  headline: string;
  views: number;
  engagement_rate: number;
  performance_score: number;
  performance_tier: string;
  posted_at: string;
}

const PAGE_OPTIONS = [
  { value: "tech_pulse_africa_dev", label: "Tech Pulse Africa" },
  { value: "ai_revolution_dev", label: "AI Revolution" },
  { value: "afrika_toons_dev", label: "Afrika Toons" },
  { value: "world_news_animated_dev", label: "World News Animated" },
  { value: "mzansi_baby_stars", label: "Mzansi Baby Stars" },
  { value: "africa_2050_dev", label: "Africa 2050" },
  { value: "pop_culture_buzz_dev", label: "Pop Culture Buzz" },
];

const TIER_COLORS: Record<string, string> = {
  viral: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30",
  great: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  good: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  poor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  dead: "text-red-400 bg-red-500/10 border-red-500/30",
};

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  best_topic_category: Trophy,
  best_posting_hour: Clock,
  best_day: Calendar,
  best_video_length: Timer,
  best_music_style: Music,
  best_hook_style: Target,
  worst_topic_category: AlertTriangle,
  trending_pattern: TrendingUp,
};

export default function IntelligencePage() {
  const { isInitialized } = useStore();
  const [selectedPage, setSelectedPage] = useState(PAGE_OPTIONS[0].value);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [formula, setFormula] = useState<ViralFormula | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);

  const loadData = useCallback(async (pageId: string) => {
    setLoading(true);
    try {
      const [summaryRes, insightsRes, decisionsRes, formulaRes, postsRes] = await Promise.all([
        fetch(`/api/intelligence/summary?pageId=${pageId}`),
        fetch(`/api/intelligence/insights?pageId=${pageId}`),
        fetch(`/api/intelligence/decisions?pageId=${pageId}&limit=15`),
        fetch(`/api/intelligence/viral-formula?pageId=${pageId}`),
        fetch(`/api/intelligence/performance?pageId=${pageId}&limit=6&orderBy=performance_score`),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data.insights || []);
      }
      if (decisionsRes.ok) {
        const data = await decisionsRes.json();
        setDecisions(data.decisions || []);
      }
      if (formulaRes.ok) {
        const data = await formulaRes.json();
        setFormula(data.formula || null);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setTopPosts(data.posts || []);
      }
    } catch {
      // Silently handle — dashboard will show empty state
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isInitialized) loadData(selectedPage);
  }, [selectedPage, isInitialized, loadData]);

  const bestInsights = insights.filter((i) => i.insight_type.startsWith("best_"));
  const worstInsights = insights.filter((i) => i.insight_type.startsWith("worst_"));
  const trendingInsights = insights.filter((i) => i.insight_type === "trending_pattern");

  const confidenceLabel = (score: number) => {
    if (score >= 0.7) return "High";
    if (score >= 0.4) return "Medium";
    return "Low";
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GenesisLoader size="lg" text="Loading Intelligence..." />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="violet" className="animate-pulse-glow">
                <Brain className="w-3 h-3 mr-1" /> AI INTELLIGENCE
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Content Intelligence</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Every video teaches the system what Africa wants to watch.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedPage}
              onChange={(val) => setSelectedPage(val)}
              options={PAGE_OPTIONS}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(selectedPage)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Section 1: Summary Stats */}
            {summary && (
              <MotionSection>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-zinc-500">Posts Analyzed</p>
                      <p className="text-2xl font-bold text-zinc-100">{summary.totalPosts}</p>
                      <p className="text-xs text-zinc-600">{summary.lockedPosts} with stable metrics</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-zinc-500">Avg Performance</p>
                      <p className="text-2xl font-bold text-zinc-100">{summary.avgPerformanceScore}</p>
                      <p className="text-xs text-zinc-600">out of 100</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-zinc-500">AI Decisions</p>
                      <p className="text-2xl font-bold text-zinc-100">{summary.totalDecisions}</p>
                      <p className="text-xs text-zinc-600">
                        {summary.totalDecisions > 0
                          ? `${Math.round((summary.correctDecisions / summary.totalDecisions) * 100)}% correct`
                          : "No decisions yet"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-zinc-500">Active Insights</p>
                      <p className="text-2xl font-bold text-zinc-100">{summary.insightCount}</p>
                      <p className="text-xs text-zinc-600">
                        Confidence: {confidenceLabel(summary.insightCount > 5 ? 0.7 : summary.insightCount > 2 ? 0.4 : 0.2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </MotionSection>
            )}

            {/* Section 2: What's Working */}
            {bestInsights.length > 0 && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  What&apos;s Working
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bestInsights.map((insight) => {
                    const Icon = INSIGHT_ICONS[insight.insight_type] || Sparkles;
                    return (
                      <Card key={insight.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs text-zinc-500">{insight.insight_type.replace(/_/g, " ").replace("best ", "")}</p>
                              <p className="text-sm font-semibold text-zinc-100 capitalize">{insight.insight_key}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>{formatNumber(insight.avg_views)} avg views</span>
                            <span>{insight.sample_size} posts</span>
                          </div>
                          <div className="mt-2 h-1 rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, insight.confidence_score * 100)}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </MotionSection>
            )}

            {/* Section 3: What's Not Working */}
            {worstInsights.length > 0 && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  What&apos;s Not Working
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {worstInsights.map((insight) => (
                    <Card key={insight.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-100 capitalize">{insight.insight_key}</p>
                            <p className="text-xs text-zinc-500">
                              Score: {Math.round(insight.avg_performance_score)} &middot; {insight.sample_size} posts
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </MotionSection>
            )}

            {/* Section 4: Trending Patterns */}
            {trendingInsights.length > 0 && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                  Trending Patterns
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trendingInsights.map((insight) => {
                    const val = insight.insight_value as Record<string, unknown>;
                    const isUp = val.direction === "trending_up";
                    return (
                      <Card key={insight.id}>
                        <CardContent className="p-4 flex items-center gap-3">
                          {isUp ? (
                            <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-zinc-100 capitalize">{insight.insight_key}</p>
                            <p className="text-xs text-zinc-500">
                              {isUp ? "+" : ""}{String(val.delta)} pts vs last week
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </MotionSection>
            )}

            {/* Section 5: Viral Formula */}
            {formula && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Viral Formula
                </h2>
                <Card glow>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-lg font-bold text-zinc-100">{formula.formula_name}</p>
                      <Badge variant="violet">{Math.round(formula.success_rate * 100)}% success rate</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500 text-xs">Category</p>
                        <p className="text-zinc-200 capitalize">{formula.topic_category || "mixed"}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Best Time</p>
                        <p className="text-zinc-200">{formula.optimal_hour != null ? `${formula.optimal_hour}:00` : "any"}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Duration</p>
                        <p className="text-zinc-200">{formula.optimal_duration || "?"}s</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Avg Views</p>
                        <p className="text-zinc-200">{formatNumber(formula.avg_views)}</p>
                      </div>
                    </div>
                    {formula.hook_pattern && (
                      <p className="mt-3 text-xs text-zinc-500">
                        Hook pattern: <span className="text-zinc-400 capitalize">{formula.hook_pattern}</span>
                        {formula.music_style && <> &middot; Music: <span className="text-zinc-400">{formula.music_style}</span></>}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </MotionSection>
            )}

            {/* Section 6: AI Decision Log */}
            {decisions.length > 0 && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-400" />
                  AI Decision Log
                </h2>
                <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left p-3 text-xs text-zinc-500 font-medium">Decision</th>
                          <th className="text-left p-3 text-xs text-zinc-500 font-medium">Change</th>
                          <th className="text-left p-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">Reason</th>
                          <th className="text-center p-3 text-xs text-zinc-500 font-medium">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decisions.map((d) => (
                          <tr key={d.id} className="border-b border-white/[0.04]">
                            <td className="p-3 text-zinc-300 capitalize">
                              {d.decision_type.replace(/_/g, " ")}
                            </td>
                            <td className="p-3">
                              <span className="text-zinc-500">{d.before_value}</span>
                              <span className="text-zinc-600 mx-1">&rarr;</span>
                              <span className="text-zinc-200">{d.after_value}</span>
                            </td>
                            <td className="p-3 text-xs text-zinc-500 max-w-[200px] truncate hidden sm:table-cell">
                              {d.reason}
                            </td>
                            <td className="p-3 text-center">
                              {d.was_correct === true && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                              )}
                              {d.was_correct === false && (
                                <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                              )}
                              {d.was_correct === null && (
                                <Timer className="w-4 h-4 text-zinc-600 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </MotionSection>
            )}

            {/* Section 7: Top Performing Posts */}
            {topPosts.length > 0 && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Top Performing Posts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topPosts.map((post) => (
                    <Card key={post.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={TIER_COLORS[post.performance_tier] || ""}>
                            {post.performance_tier}
                          </Badge>
                          <span className="text-xs text-zinc-600">
                            {new Date(post.posted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-200 line-clamp-2 mb-2">
                          {post.headline || post.topic || "Untitled"}
                        </p>
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>{formatNumber(post.views)} views</span>
                          <span>{Math.round(post.engagement_rate * 10000) / 100}% eng</span>
                          <span>Score: {Math.round(post.performance_score)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </MotionSection>
            )}

            {/* Section 8: Learning Progress */}
            {summary && (
              <MotionSection>
                <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Learning Progress
                </h2>
                <Card>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500 text-xs">Total Posts Analyzed</p>
                        <p className="text-xl font-bold text-zinc-100">{summary.totalPosts}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">AI Decisions Made</p>
                        <p className="text-xl font-bold text-zinc-100">{summary.totalDecisions}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Correct Decisions</p>
                        <p className="text-xl font-bold text-zinc-100">
                          {summary.correctDecisions}
                          {summary.totalDecisions > 0 && (
                            <span className="text-sm text-zinc-500 ml-1">
                              ({Math.round((summary.correctDecisions / summary.totalDecisions) * 100)}%)
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Last Analysis</p>
                        <p className="text-sm text-zinc-300">
                          {summary.lastAnalysis
                            ? new Date(summary.lastAnalysis).toLocaleString()
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    {summary.hasViralFormula && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                        <Zap className="w-3 h-3" />
                        Viral formula detected for this page
                      </div>
                    )}
                  </CardContent>
                </Card>
              </MotionSection>
            )}

            {/* Empty State */}
            {!summary?.totalPosts && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-16 h-16 text-zinc-700 mb-4" />
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">No Intelligence Data Yet</h3>
                <p className="text-sm text-zinc-500 max-w-md">
                  The intelligence system learns from every video posted. As more content is published
                  and metrics are collected, the AI will start generating insights and making decisions
                  to improve performance.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
