"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import {
  Heart,
  Eye,
  Share2,
  Volume2,
  Sparkles,
  Film,
  Zap,
  Clock,
  ArrowRight,
} from "lucide-react";

export interface ExploreVideo {
  id: string;
  prompt: string;
  modelId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  hasAudio: boolean;
  type: string; // 'standard' | 'motion' | 'brain'
  views: number;
  likes: number;
  recreates: number;
  creatorName?: string;
  creatorAvatarUrl?: string;
  isFreeTier: boolean;
  isFeatured: boolean;
  tags?: string[];
  createdAt: string;
}

interface ExploreVideoCardProps {
  video: ExploreVideo;
  onRecreate?: (video: ExploreVideo) => void;
  onLike?: (video: ExploreVideo) => void;
  onShare?: (video: ExploreVideo) => void;
  onClick?: (video: ExploreVideo) => void;
  className?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

export function ExploreVideoCard({
  video,
  onRecreate,
  onLike,
  onShare,
  onClick,
  className,
}: ExploreVideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isVertical = video.resolution?.includes("9:16") || video.resolution?.includes("768x1344");

  // IntersectionObserver: only load/play video when card is in viewport
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Play/pause based on hover + visibility
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isVisible && isHovered) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isVisible, isHovered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const vid = videoRef.current;
    if (vid && video.hasAudio) {
      vid.muted = false;
    }
  }, [video.hasAudio]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const vid = videoRef.current;
    if (vid) {
      vid.muted = true;
    }
  }, []);

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !isLiked;
      setIsLiked(next);
      setLikeCount((prev) => (next ? prev + 1 : prev - 1));
      onLike?.(video);
    },
    [isLiked, onLike, video]
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare?.(video);
    },
    [onShare, video]
  );

  const handleRecreate = useCallback(() => {
    onRecreate?.(video);
  }, [onRecreate, video]);

  const handleClick = useCallback(() => {
    onClick?.(video);
  }, [onClick, video]);

  const typeBadge = (() => {
    if (video.isFeatured) return { label: "FEATURED", icon: Sparkles, color: "bg-amber-500/80 text-amber-100" };
    if (video.type === "motion") return { label: "MOTION", icon: Film, color: "bg-cyan-500/80 text-cyan-100" };
    if (video.type === "brain") return { label: "BRAIN STUDIO", icon: Zap, color: "bg-pink-500/80 text-pink-100" };
    return null;
  })();

  return (
    <div ref={cardRef} className={cn("group/card flex flex-col gap-2", className)}>
      {/* Video card */}
      <div
        className={cn(
          "relative rounded-xl border border-white/[0.06] bg-[#111118]/80 overflow-hidden cursor-pointer",
          "transition-all duration-300 ease-out",
          isHovered && "scale-[1.03] shadow-[0_0_30px_-5px_rgba(124,58,237,0.3)]"
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Thumbnail / Video area */}
        <div className={cn("relative w-full overflow-hidden", isVertical ? "aspect-[9/16]" : "aspect-[4/3]")}>
          {/* Lazy video — plays on hover when visible */}
          {isVisible && !videoError && (
            <video
              ref={videoRef}
              src={`${video.videoUrl}#t=0.5`}
              poster={video.thumbnailUrl || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setVideoError(true)}
            />
          )}
          {/* Poster fallback when not visible or video failed */}
          {(!isVisible || videoError) && video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}
          {/* Shimmer when no thumbnail and no video */}
          {!video.thumbnailUrl && (!isVisible || videoError) && (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-[#0D0D14] to-fuchsia-900/20" />
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* Top-left: Creator info */}
          {video.creatorName && (
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              {video.creatorAvatarUrl ? (
                <img
                  src={video.creatorAvatarUrl}
                  alt={video.creatorName}
                  className="w-6 h-6 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-violet-600/60 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                  {video.creatorName[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-white/90 drop-shadow-lg">
                {video.creatorName}
              </span>
            </div>
          )}

          {/* Top-right: Badges */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
            {/* Audio badge */}
            {video.hasAudio && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-600/70 backdrop-blur-sm text-[10px] font-semibold text-white border border-violet-400/20">
                <Volume2 className="w-3 h-3" />
                WITH AUDIO
              </span>
            )}

            {/* Type badge */}
            {typeBadge && (
              <span className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md backdrop-blur-sm text-[10px] font-semibold border border-white/10",
                typeBadge.color
              )}>
                <typeBadge.icon className="w-3 h-3" />
                {typeBadge.label}
              </span>
            )}
          </div>

          {/* Bottom overlay content */}
          <div className="absolute inset-x-0 bottom-0 p-3 z-10">
            {/* Stats row */}
            <div className="flex items-center gap-3 text-[11px] text-white/60">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {formatCount(video.views)}
              </span>

              <button
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-1 transition-colors",
                  isLiked ? "text-red-400" : "text-white/60 hover:text-red-400"
                )}
              >
                <Heart
                  className="w-3.5 h-3.5"
                  fill={isLiked ? "currentColor" : "none"}
                />
                {formatCount(likeCount)}
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-1 text-white/60 hover:text-white transition-colors ml-auto"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>

              {video.duration && video.duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDurationShort(video.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recreate button (below card) */}
      <button
        onClick={handleRecreate}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
          "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
          "text-white text-sm font-medium",
          "shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30",
          "transition-all duration-200 press-effect"
        )}
      >
        <Sparkles className="w-4 h-4" />
        Recreate This
        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
      </button>
    </div>
  );
}
