"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, AlertTriangle, Volume2, VolumeX } from "lucide-react";

interface LazyVideoProps {
  src: string;
  poster?: string;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait";
  autoPlayOnHover?: boolean;
  autoPlayOnVisible?: boolean;
  muted?: boolean;
  loop?: boolean;
  showPlayIndicator?: boolean;
  onClick?: () => void;
  rootMargin?: string;
}

/**
 * LazyVideo — TikTok-style video loading component
 *
 * 6 layers:
 * 1. Blurred poster (instant load)
 * 2. Skeleton shimmer (while video loads)
 * 3. Actual video (loaded via IntersectionObserver)
 * 4. Loading spinner (during buffer)
 * 5. Error state (with retry)
 * 6. Play indicator (hover/tap)
 */
export function LazyVideo({
  src,
  poster,
  className,
  aspectRatio = "video",
  autoPlayOnHover = true,
  autoPlayOnVisible = false,
  muted = true,
  loop = true,
  showPlayIndicator = true,
  onClick,
  rootMargin = "200px",
}: LazyVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);

  // Aspect ratio class
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "portrait"
        ? "aspect-[9/16]"
        : "aspect-video";

  // IntersectionObserver — only load video when near viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // Play/pause based on visibility + hover
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoReady) return;

    const shouldPlay = autoPlayOnVisible
      ? isVisible
      : autoPlayOnHover
        ? isVisible && isHovered
        : false;

    if (shouldPlay) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, [isVisible, isHovered, videoReady, autoPlayOnHover, autoPlayOnVisible]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setVideoReady(false);
    const vid = videoRef.current;
    if (vid) {
      vid.load();
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted((m) => !m);
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#0D0D14] cursor-pointer group",
        aspectClass,
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Layer 1: Poster image — loads instantly */}
      {poster && (
        <img
          src={poster}
          alt=""
          loading="lazy"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-500",
            videoReady && isPlaying
              ? "opacity-0 scale-105 blur-sm"
              : "opacity-100 scale-100 blur-0"
          )}
        />
      )}

      {/* Layer 2: Shimmer skeleton (no poster or loading) */}
      {!poster && !videoReady && !hasError && (
        <div className="absolute inset-0 bg-[#0D0D14]">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-transparent to-fuchsia-900/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      )}

      {/* Layer 3: Actual video — only rendered when near viewport */}
      {isVisible && !hasError && (
        <video
          ref={videoRef}
          src={`${src}#t=0.5`}
          poster={poster}
          muted={isMuted}
          loop={loop}
          playsInline
          preload="metadata"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            videoReady && isPlaying ? "opacity-100" : "opacity-0"
          )}
          onLoadedData={() => setVideoReady(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Layer 4: Loading indicator (video loading but not yet ready) */}
      {isVisible && !videoReady && !hasError && isHovered && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-violet-500 animate-spin" />
        </div>
      )}

      {/* Layer 5: Error state with retry */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20 bg-black/60">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <span className="text-xs text-zinc-400">Failed to load</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="text-xs text-violet-400 hover:text-violet-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Layer 6: Play indicator — shows on hover when not playing */}
      {showPlayIndicator && !isPlaying && !hasError && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Mute toggle — visible when playing */}
      {isPlaying && (
        <button
          onClick={toggleMute}
          className="absolute bottom-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-white" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-white" />
          )}
        </button>
      )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-[5]" />
    </div>
  );
}

/**
 * VideoGridSkeleton — shimmer skeleton for a video grid
 */
export function VideoGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-[#111118]/80 overflow-hidden">
          <div className="relative aspect-video">
            <div className="absolute inset-0 bg-[#0D0D14]">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-transparent to-fuchsia-900/10" />
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <div className="w-0 h-0 border-l-[8px] border-l-white/[0.12] border-y-[6px] border-y-transparent ml-0.5" />
              </div>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 rounded bg-white/[0.06] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            <div className="flex justify-between">
              <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-10 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * GenerationOrb — pulsing animated orb shown during video generation
 */
export function GenerationOrb({
  progress = 0,
  eta,
  text = "Generating your video...",
  className,
}: {
  progress?: number;
  eta?: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 py-12", className)}>
      {/* Animated orb */}
      <div className="relative w-28 h-28">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-cyan-500/30 blur-xl animate-pulse" />

        {/* Main orb */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-purple-700 shadow-[0_0_40px_rgba(139,92,246,0.5)]">
          {/* Inner shine */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/20" />

          {/* Orbiting ring */}
          <svg className="absolute inset-[-8px] animate-spin" style={{ animationDuration: "3s" }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />
            <circle
              cx="50" cy="50" r="48" fill="none"
              stroke="url(#orbGrad)" strokeWidth="2"
              strokeLinecap="round" strokeDasharray="80 220"
            />
            <defs>
              <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center percentage */}
          {progress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-lg drop-shadow-lg">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-48 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}

      {/* Text */}
      <div className="text-center">
        <p className="text-sm text-zinc-300 font-medium">{text}</p>
        {eta && <p className="text-xs text-zinc-500 mt-1">ETA: {eta}</p>}
      </div>
    </div>
  );
}
