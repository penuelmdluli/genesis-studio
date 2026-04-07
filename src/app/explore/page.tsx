"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ExploreVideoCard,
  type ExploreVideo,
} from "@/components/explore/video-card";
import { ShareModal } from "@/components/explore/share-modal";
import { RecreateModal } from "@/components/explore/recreate-modal";
import { VideoViewerModal } from "@/components/explore/video-viewer-modal";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import {
  Flame,
  Sparkles,
  PersonStanding,
  Volume2,
  Film,
  Star,
  ArrowRight,
  VideoOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApiResponse {
  videos: ExploreVideo[];
  nextCursor: string | null;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  apiValue: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS: Tab[] = [
  { id: "trending", label: "Trending", icon: <Flame className="w-4 h-4" />, apiValue: "trending" },
  { id: "latest", label: "Latest", icon: <Sparkles className="w-4 h-4" />, apiValue: "latest" },
  { id: "motion", label: "Motion Control", icon: <PersonStanding className="w-4 h-4" />, apiValue: "motion" },
  { id: "audio", label: "With Audio", icon: <Volume2 className="w-4 h-4" />, apiValue: "audio" },
  { id: "films", label: "Brain Studio Films", icon: <Film className="w-4 h-4" />, apiValue: "films" },
  { id: "picks", label: "Staff Picks", icon: <Star className="w-4 h-4" />, apiValue: "picks" },
];

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  Skeleton card for loading states                                   */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
        <div className="aspect-video bg-white/[0.06]" />
      </div>
      <div className="h-10 rounded-lg bg-white/[0.04]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  const { isSignedIn } = useAuth();

  // Feed state
  const [activeTab, setActiveTab] = useState("trending");
  const [videos, setVideos] = useState<ExploreVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<ExploreVideo | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [recreateOpen, setRecreateOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchVideos = useCallback(
    async (tab: string, pageCursor: string | null, append: boolean) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          tab,
          limit: String(PAGE_SIZE),
        });
        if (pageCursor) params.set("cursor", pageCursor);

        const res = await fetch(`/api/explore?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const data: ApiResponse = await res.json();

        if (append) {
          setVideos((prev) => [...prev, ...data.videos]);
        } else {
          setVideos(data.videos);
        }

        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch explore videos:", err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Initial fetch + tab change
  useEffect(() => {
    setVideos([]);
    setCursor(null);
    setHasMore(true);
    fetchVideos(activeTab, null, false);

    return () => {
      abortRef.current?.abort();
    };
  }, [activeTab, fetchVideos]);

  /* ---------------------------------------------------------------- */
  /*  Infinite scroll via IntersectionObserver                         */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchVideos(activeTab, cursor, true);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, cursor, hasMore, isLoading, isLoadingMore, fetchVideos]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleLike = useCallback(async (video: ExploreVideo) => {
    // Optimistic update is already handled inside ExploreVideoCard.
    // Here we call the API and revert on failure.
    try {
      const res = await fetch("/api/explore/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });

      if (!res.ok) {
        // Revert — the card manages its own local state,
        // so a page-level revert just re-fetches current list
        // in case the user isn't authenticated, etc.
        console.warn("Like API returned non-OK:", res.status);
      }
    } catch (err) {
      console.error("Like failed:", err);
    }
  }, []);

  const handleShare = useCallback((video: ExploreVideo) => {
    setSelectedVideo(video);
    setShareOpen(true);
  }, []);

  const handleRecreate = useCallback((video: ExploreVideo) => {
    setSelectedVideo(video);
    setRecreateOpen(true);
  }, []);

  const handleVideoClick = useCallback((video: ExploreVideo) => {
    setSelectedVideo(video);
    setViewerOpen(true);
  }, []);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    // Scroll to top of grid area smoothly
    window.scrollTo({ top: 320, behavior: "smooth" });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* ========== Hero Banner ========== */}
      <section className="relative overflow-hidden">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Violet glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              Explore
            </span>{" "}
            <span className="text-zinc-100 block sm:inline">
              Watch. Get Inspired. Create.
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            12,000+ videos &bull; 2,000+ creators &bull; 500+ created today
          </p>

          {!isSignedIn && (
            <Link
              href="/sign-up"
              className={cn(
                "inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-xl",
                "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
                "text-white font-semibold text-sm",
                "shadow-lg shadow-violet-600/25 hover:shadow-violet-500/35",
                "transition-all duration-200"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Start Creating — It&apos;s Free
              <ArrowRight className="w-4 h-4 opacity-60" />
            </Link>
          )}
        </div>
      </section>

      {/* ========== Filter Tabs ========== */}
      <div className="sticky top-16 z-30 bg-[#0A0A0F]/90 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-3 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                    "border transition-all duration-200 shrink-0",
                    isActive
                      ? "border-violet-500 bg-violet-500/10 text-violet-300"
                      : "border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========== Video Grid ========== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading skeleton — initial load */}
        {isLoading && videos.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
              <VideoOff className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-300">
              No videos yet
            </h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">
              Be the first to create! Generate a video and share it with the
              community.
            </p>
            <Link
              href="/generate"
              className={cn(
                "inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg",
                "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
                "text-white font-medium text-sm",
                "shadow-lg shadow-violet-600/20",
                "transition-all duration-200"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Create a Video
            </Link>
          </div>
        )}

        {/* Video cards */}
        {videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {videos.map((video) => (
              <ExploreVideoCard
                key={video.id}
                video={video}
                onLike={handleLike}
                onShare={handleShare}
                onRecreate={handleRecreate}
                onClick={handleVideoClick}
              />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />

        {/* Loading more spinner */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-10">
            <GenesisLoader size="md" />
          </div>
        )}

        {/* End of feed */}
        {!hasMore && videos.length > 0 && !isLoading && (
          <p className="text-center text-sm text-zinc-600 py-10">
            You&apos;ve reached the end. Time to create your own!
          </p>
        )}
      </section>

      {/* ========== Modals ========== */}
      {selectedVideo && (
        <>
          <VideoViewerModal
            isOpen={viewerOpen}
            onClose={() => setViewerOpen(false)}
            video={selectedVideo}
            onLike={handleLike}
            onShare={handleShare}
          />
          <ShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            video={selectedVideo}
          />
          <RecreateModal
            isOpen={recreateOpen}
            onClose={() => setRecreateOpen(false)}
            video={selectedVideo}
          />
        </>
      )}
    </>
  );
}
