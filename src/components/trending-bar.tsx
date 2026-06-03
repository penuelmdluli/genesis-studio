"use client";

import { useState, useEffect, useRef } from "react";
import { Flame, ChevronLeft, ChevronRight, Music, Sparkles, Zap, Newspaper } from "lucide-react";

interface Trend {
  id: string;
  title: string;
  description: string;
  platform: string;
  category: string;
  suggestedPrompt: string;
  suggestedLyrics?: string;
  trendScore: number;
}

interface TrendingBarProps {
  onSelectTrend: (trend: { prompt: string; lyrics?: string; title: string }) => void;
  filter?: string; // "music" | "dance" | "all"
}

const CATEGORY_ICONS: Record<string, typeof Flame> = {
  music: Music,
  dance: Zap,
  challenge: Sparkles,
  news: Newspaper,
  meme: Flame,
  topic: Flame,
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-500/20 text-pink-400",
  twitter: "bg-blue-500/20 text-blue-400",
  news: "bg-amber-500/20 text-amber-400",
  general: "bg-violet-500/20 text-violet-400",
};

export function TrendingBar({ onSelectTrend, filter }: TrendingBarProps) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => (r.ok ? r.json() : { trends: [] }))
      .then((d) => {
        let items = d.trends || [];
        if (filter && filter !== "all") {
          items = items.filter((t: Trend) => t.category === filter);
        }
        setTrends(items.slice(0, 8));
      })
      .catch(() => {});
  }, [filter]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  if (trends.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-sm font-semibold text-zinc-200">Trending Now</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => scroll("left")} className="p-1 rounded-md hover:bg-white/[0.06] text-zinc-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll("right")} className="p-1 rounded-md hover:bg-white/[0.06] text-zinc-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {trends.map((trend) => {
          const Icon = CATEGORY_ICONS[trend.category] || Flame;
          const platformClass = PLATFORM_COLORS[trend.platform] || PLATFORM_COLORS.general;

          return (
            <button
              key={trend.id}
              onClick={() =>
                onSelectTrend({
                  prompt: trend.suggestedPrompt,
                  lyrics: trend.suggestedLyrics,
                  title: trend.title,
                })
              }
              className="flex-shrink-0 w-[260px] rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-violet-500/30 p-3.5 text-left transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${platformClass}`}>
                  {trend.platform}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-1 group-hover:text-white transition-colors">
                {trend.title}
              </h4>
              <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                {trend.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
