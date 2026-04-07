"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ShareModal } from "@/components/explore/share-modal";
import { RecreateModal } from "@/components/explore/recreate-modal";
import { ExploreVideoCard } from "@/components/explore/video-card";
import type { ExploreVideo } from "@/components/explore/video-card";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Eye,
  Sparkles,
  ArrowRight,
  Clock,
  Film,
  Zap,
  Link2,
  Download,
  Check,
  Share2,
  Users,
} from "lucide-react";

// ─── Social SVG icons (reused from share-modal patterns) ─────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" />
    </svg>
  );
}

// ─── Constants ────────────────────────────────────────────────
const BASE_URL = "https://genesis-studio-hazel.vercel.app";

// Model labels removed — clients don't need to see model names

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0
    ? `${m}:${s.toString().padStart(2, "0")}`
    : `0:${s.toString().padStart(2, "0")}`;
}

// ─── Props ────────────────────────────────────────────────────
interface VideoShareContentProps {
  video: ExploreVideo;
  relatedVideos: ExploreVideo[];
}

// ─── Component ────────────────────────────────────────────────
export function VideoShareContent({
  video,
  relatedVideos,
}: VideoShareContentProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interaction state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [isCopied, setIsCopied] = useState(false);

  // Modals
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [recreateModalOpen, setRecreateModalOpen] = useState(false);

  const shareUrl = `${BASE_URL}/explore/${video.id}`;

  // ── Video controls ─────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // Try autoplay on mount
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  // Track view
  useEffect(() => {
    fetch(`/api/explore/${video.id}`, { method: "GET" }).catch(() => {});
  }, [video.id]);

  // ── Like ───────────────────────────────────────────────────
  const handleLike = useCallback(() => {
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((prev) => (next ? prev + 1 : prev - 1));
    fetch("/api/explore/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id }),
    }).catch(() => {});
  }, [isLiked, video.id]);

  // ── Copy link ──────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast("Link copied to clipboard!", "success");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast("Failed to copy link", "error");
    }
  }, [shareUrl, toast]);

  // ── Download ───────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = video.videoUrl;
    a.download = `genesis-${video.id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("Downloading video...", "info");
  }, [video.videoUrl, video.id, toast]);

  // ── Platform share helpers ─────────────────────────────────
  const encodedUrl = encodeURIComponent(shareUrl);
  const shareText = `Check out this AI video — Made with Genesis Studio`;
  const encodedText = encodeURIComponent(shareText);

  const sharePlatforms = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <WhatsAppIcon className="w-5 h-5" />,
      bg: "bg-green-600 hover:bg-green-500",
      url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      id: "twitter",
      label: "X",
      icon: <XIcon className="w-5 h-5" />,
      bg: "bg-zinc-800 hover:bg-zinc-700",
      url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <FacebookIcon className="w-5 h-5" />,
      bg: "bg-blue-600 hover:bg-blue-500",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: <LinkedInIcon className="w-5 h-5" />,
      bg: "bg-blue-700 hover:bg-blue-600",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: <TikTokIcon className="w-5 h-5" />,
      bg: "bg-zinc-900 hover:bg-zinc-800 border border-white/10",
      download: true,
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: <InstagramIcon className="w-5 h-5" />,
      bg: "bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500",
      download: true,
    },
    {
      id: "copy",
      label: isCopied ? "Copied!" : "Copy Link",
      icon: isCopied ? (
        <Check className="w-5 h-5" />
      ) : (
        <Link2 className="w-5 h-5" />
      ),
      bg: isCopied ? "bg-emerald-600" : "bg-zinc-700 hover:bg-zinc-600",
      copy: true,
    },
    {
      id: "download",
      label: "Download",
      icon: <Download className="w-5 h-5" />,
      bg: "bg-violet-600 hover:bg-violet-500",
      download: true,
    },
  ];

  const handleSharePlatformClick = useCallback(
    (platform: (typeof sharePlatforms)[number]) => {
      if (platform.copy) {
        handleCopyLink();
      } else if (platform.download) {
        handleDownload();
      } else if (platform.url) {
        window.open(platform.url, "_blank", "noopener,noreferrer,width=600,height=500");
      }
      // Track
      fetch("/api/share/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, platform: platform.id }),
      }).catch(() => {});
    },
    [handleCopyLink, handleDownload, video.id]
  );

  // ── Type badge ─────────────────────────────────────────────
  const typeBadge = (() => {
    if (video.isFeatured)
      return { label: "FEATURED", icon: Sparkles, color: "bg-amber-500/80 text-amber-100" };
    if (video.type === "motion")
      return { label: "MOTION", icon: Film, color: "bg-cyan-500/80 text-cyan-100" };
    if (video.type === "brain")
      return { label: "BRAIN STUDIO", icon: Zap, color: "bg-pink-500/80 text-pink-100" };
    return null;
  })();

  return (
    <>
      <div className="min-h-screen pb-20">
        {/* ─── Video Player Section ─────────────────────────── */}
        <section className="w-full px-4 pt-6 pb-8">
          <div className="max-w-4xl mx-auto">
            <div
              className={cn(
                "relative rounded-2xl overflow-hidden border border-white/[0.08]",
                "bg-black shadow-2xl shadow-black/40"
              )}
              onMouseMove={resetControlsTimer}
              onMouseEnter={() => setShowControls(true)}
            >
              {/* Video element */}
              <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                loop
                playsInline
                muted
                className="w-full aspect-video object-contain bg-black cursor-pointer"
                onClick={togglePlay}
              />

              {/* Play/Pause overlay (center) */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none",
                  showControls && !isPlaying ? "opacity-100" : "opacity-0"
                )}
              >
                <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-7 h-7 text-white ml-1" fill="white" />
                </div>
              </div>

              {/* Bottom controls bar */}
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 px-4 py-3 flex items-center justify-between",
                  "bg-gradient-to-t from-black/80 to-transparent",
                  "transition-opacity duration-300",
                  showControls ? "opacity-100" : "opacity-0"
                )}
              >
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" fill="white" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" fill="white" />
                  )}
                </button>

                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Click-to-unmute hint */}
              {isMuted && video.hasAudio && (
                <button
                  onClick={toggleMute}
                  className={cn(
                    "absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                    "bg-black/60 backdrop-blur-sm text-white/90 text-xs font-medium",
                    "border border-white/10 hover:bg-black/80 transition-colors"
                  )}
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Tap to unmute
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ─── Video Info Section ───────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Prompt text */}
          <p className="text-lg sm:text-xl font-medium text-zinc-100 leading-relaxed">
            {video.prompt}
          </p>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Duration */}
            {video.duration && video.duration > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] text-zinc-400 text-xs font-medium border border-white/[0.06]">
                <Clock className="w-3 h-3" />
                {formatDuration(video.duration)}
              </span>
            )}

            {/* Resolution */}
            {video.resolution && (
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-zinc-400 text-xs font-medium border border-white/[0.06]">
                {video.resolution}
              </span>
            )}

            {/* Audio badge */}
            {video.hasAudio && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/20 text-violet-300 text-xs font-semibold border border-violet-500/20">
                <Volume2 className="w-3 h-3" />
                WITH AUDIO
              </span>
            )}

            {/* Type badge */}
            {typeBadge && (
              <span
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-white/10",
                  typeBadge.color
                )}
              >
                <typeBadge.icon className="w-3 h-3" />
                {typeBadge.label}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {formatCount(video.views)} views
            </span>

            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                isLiked
                  ? "text-red-400"
                  : "text-zinc-500 hover:text-red-400"
              )}
            >
              <Heart
                className="w-4 h-4"
                fill={isLiked ? "currentColor" : "none"}
              />
              {formatCount(likeCount)} likes
            </button>

            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              {formatCount(video.recreates)} recreates
            </span>
          </div>

          {/* ─── CTA Buttons ──────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => setRecreateModalOpen(true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl",
                "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
                "text-white font-semibold text-base",
                "shadow-lg shadow-violet-600/25 hover:shadow-violet-500/35",
                "transition-all duration-200 press-effect"
              )}
            >
              <Sparkles className="w-5 h-5" />
              Recreate This Video
              <ArrowRight className="w-4 h-4 opacity-60" />
            </button>

            <Link
              href="/sign-up"
              className={cn(
                "flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl",
                "bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.10] hover:border-white/[0.15]",
                "text-zinc-100 font-semibold text-base",
                "transition-all duration-200 press-effect"
              )}
            >
              Start Free
              <ArrowRight className="w-4 h-4 opacity-50" />
            </Link>
          </div>

          {/* ─── Share Buttons Row ─────────────────────────── */}
          <div className="pt-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Share this video
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {sharePlatforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleSharePlatformClick(platform)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-xl transition-all duration-200 press-effect",
                    platform.bg
                  )}
                  title={platform.label}
                >
                  <span className="text-white">{platform.icon}</span>
                  <span className="text-[9px] font-medium text-white/80 leading-tight text-center">
                    {platform.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Social Proof ──────────────────────────────── */}
          <div className="flex items-center justify-center gap-2 py-6">
            <Users className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-zinc-500">
              Join <strong className="text-zinc-300">2,000+</strong> creators
              making AI videos
            </span>
          </div>
        </section>

        {/* ─── Related Videos ──────────────────────────────── */}
        {relatedVideos.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pt-8 pb-12">
            <h2 className="text-xl font-semibold text-zinc-100 mb-6">
              More videos you might like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedVideos.slice(0, 6).map((rv) => (
                <Link key={rv.id} href={`/explore/${rv.id}`}>
                  <ExploreVideoCard
                    video={rv}
                    onRecreate={() => {
                      // Navigate to the video's page for the recreate flow
                      window.location.href = `/explore/${rv.id}`;
                    }}
                    onShare={() => setShareModalOpen(true)}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ─── Modals ────────────────────────────────────────── */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        video={video}
      />
      <RecreateModal
        isOpen={recreateModalOpen}
        onClose={() => setRecreateModalOpen(false)}
        video={video}
      />
    </>
  );
}
