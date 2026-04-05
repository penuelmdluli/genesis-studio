"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import {
  Heart,
  Eye,
  Share2,
  Play,
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
  className?: string;
}

// Map model IDs to display names
const MODEL_LABELS: Record<string, string> = {
  "kling-2.6": "Kling 2.6",
  "kling-2.5": "Kling 2.5",
  "hunyuan-video": "HunyuanVideo",
  "wan-2.1": "Wan 2.1",
  "ltx-video": "LTX Video",
  "cogvideox-5b": "CogVideoX",
  "mochi-1": "Mochi 1",
};

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
  className,
}: ExploreVideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVertical = video.resolution?.includes("9:16") || video.resolution?.includes("768x1344");

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
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

  const modelLabel = MODEL_LABELS[video.modelId] || video.modelId;

  const typeBadge = (() => {
    if (video.isFeatured) return { label: "FEATURED", icon: Sparkles, color: "bg-amber-500/80 text-amber-100" };
    if (video.type === "motion") return { label: "MOTION", icon: Film, color: "bg-cyan-500/80 text-cyan-100" };
    if (video.type === "brain") return { label: "BRAIN STUDIO", icon: Zap, color: "bg-pink-500/80 text-pink-100" };
    return null;
  })();

  return (
    <div className={cn("group/card flex flex-col gap-2", className)}>
      {/* Video card */}
      <div
        className={cn(
          "relative rounded-xl border border-white/[0.06] bg-[#111118]/80 overflow-hidden cursor-pointer",
          "transition-all duration-300 ease-out",
          isHovered && "scale-[1.03] shadow-[0_0_30px_-5px_rgba(124,58,237,0.3)]"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Thumbnail / Video area */}
        <div className={cn("relative w-full overflow-hidden", isVertical ? "aspect-[9/16]" : "aspect-video")}>
          {/* Thumbnail image */}
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.prompt}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                isHovered ? "opacity-0" : "opacity-100"
              )}
            />
          )}

          {/* Video element (hover-to-play) */}
          <video
            ref={videoRef}
            src={video.videoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            poster={video.thumbnailUrl || undefined}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              isHovered ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Play icon overlay when not hovering */}
          {!isHovered && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

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
            {/* Model badge */}
            <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white/90 border border-white/10">
              {modelLabel}
            </span>

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
            {/* Prompt text */}
            <p className="text-sm text-white/90 font-medium line-clamp-2 leading-snug mb-2 drop-shadow-lg">
              {video.prompt}
            </p>

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
