"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  X,
  Heart,
  Share2,
  Sparkles,
  Pencil,
  ImagePlus,
  Move3d,
  Volume2,
  Clock,
  Eye,
  Copy,
} from "lucide-react";
import type { ExploreVideo } from "./video-card";

interface VideoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: ExploreVideo;
  onLike?: (video: ExploreVideo) => void;
  onShare?: (video: ExploreVideo) => void;
}

const MODEL_LABELS: Record<string, string> = {
  "kling-2.6": "Kling 2.6 Pro",
  "kling-3.0": "Kling 3.0 Pro",
  "veo-3.1": "Veo 3.1",
  "seedance-1.5": "Seedance 1.5",
  "wan-2.2": "Wan 2.2",
  "wan-2.1-turbo": "Wan 2.1 Turbo",
  "hunyuan-video": "HunyuanVideo",
  "ltx-video": "LTX Video",
  "mochi-1": "Mochi 1",
  "cogvideo-x": "CogVideoX",
  "mimic-motion": "MimicMotion",
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function VideoViewerModal({
  isOpen,
  onClose,
  video,
  onLike,
  onShare,
}: VideoViewerModalProps) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [promptCopied, setPromptCopied] = useState(false);

  // Reset state when video changes
  useEffect(() => {
    if (isOpen) {
      setIsLiked(false);
      setLikeCount(video.likes);
      setPromptCopied(false);
    }
  }, [isOpen, video]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleRecreate = useCallback(
    (mode: "exact" | "edit" | "image" | "motion") => {
      const encodedPrompt = encodeURIComponent(video.prompt);
      const encodedModel = encodeURIComponent(video.modelId);

      if (!isLoaded) return;

      if (!isSignedIn) {
        // Store intent for post-signup redirect
        sessionStorage.setItem(
          "genesis_recreate_intent",
          JSON.stringify({
            prompt: video.prompt,
            modelId: video.modelId,
            videoUrl: video.videoUrl,
            sourceVideoId: video.id,
            mode,
          })
        );
        const redirectUrl = `/generate?prompt=${encodedPrompt}&model=${encodedModel}`;
        window.location.href = `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      onClose();

      switch (mode) {
        case "exact":
          router.push(`/generate?prompt=${encodedPrompt}&model=${encodedModel}`);
          break;
        case "edit":
          router.push(`/generate?prompt=${encodedPrompt}&model=${encodedModel}&edit=true`);
          break;
        case "image":
          router.push(`/generate?mode=i2v&prompt=${encodedPrompt}`);
          break;
        case "motion":
          router.push(`/motion-control?ref=${encodeURIComponent(video.videoUrl)}`);
          break;
      }
    },
    [isSignedIn, isLoaded, video, onClose, router]
  );

  const handleLike = useCallback(() => {
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((prev) => (next ? prev + 1 : prev - 1));
    onLike?.(video);
  }, [isLiked, onLike, video]);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(video.prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [video.prompt]);

  if (!isOpen) return null;

  const modelLabel = MODEL_LABELS[video.modelId] || video.modelId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Video viewer"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-fade-in" />

      {/* Modal content */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111118]/95 border border-white/[0.06] shadow-2xl animate-fade-in-scale scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video player */}
        <div className="relative rounded-t-2xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={video.videoUrl}
            autoPlay
            loop
            playsInline
            controls
            className="w-full max-h-[60vh] object-contain"
          />

          {/* Prompt overlay on video (gradient at bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
            <p className="text-white/90 text-sm italic leading-relaxed line-clamp-2">
              &ldquo;{video.prompt}&rdquo;
            </p>
            <p className="text-purple-400 text-xs mt-1.5 font-medium">
              Made with {modelLabel} &bull; Genesis Studio
            </p>
          </div>
        </div>

        {/* Details section */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Full prompt */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Prompt used
              </p>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <Copy className="w-3 h-3" />
                {promptCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              {video.prompt}
            </p>
          </div>

          {/* Model info badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/[0.05] text-xs text-white/60 border border-white/[0.06]">
              {modelLabel}
            </span>
            {video.duration && video.duration > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] text-xs text-white/60 border border-white/[0.06]">
                <Clock className="w-3 h-3" />
                {video.duration}s
              </span>
            )}
            {video.hasAudio && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 text-xs text-green-400 border border-green-500/20">
                <Volume2 className="w-3 h-3" />
                With Audio
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] text-xs text-white/60 border border-white/[0.06]">
              <Eye className="w-3 h-3" />
              {formatCount(video.views)} views
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] text-xs text-white/60 border border-white/[0.06]">
              <Heart className="w-3 h-3" />
              {formatCount(likeCount)} likes
            </span>
          </div>

          {/* Primary action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleRecreate("exact")}
              className={cn(
                "py-3 rounded-xl text-white font-semibold text-sm",
                "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500",
                "shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40",
                "transition-all duration-200 flex items-center justify-center gap-2"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Recreate This
            </button>
            <button
              onClick={() => handleRecreate("edit")}
              className={cn(
                "py-3 rounded-xl text-white font-medium text-sm",
                "bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08]",
                "transition-all duration-200 flex items-center justify-center gap-2"
              )}
            >
              <Pencil className="w-4 h-4" />
              Edit & Create
            </button>
          </div>

          {/* Secondary action buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleRecreate("image")}
              className="py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white/90 text-xs transition-all text-center flex flex-col items-center gap-1"
            >
              <ImagePlus className="w-4 h-4" />
              Use My Image
            </button>
            <button
              onClick={() => handleRecreate("motion")}
              className="py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white/90 text-xs transition-all text-center flex flex-col items-center gap-1"
            >
              <Move3d className="w-4 h-4" />
              Motion Ref
            </button>
            <button
              onClick={handleLike}
              className={cn(
                "py-2.5 rounded-xl border text-xs transition-all text-center flex flex-col items-center gap-1",
                isLiked
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-white/[0.04] border-white/[0.06] text-white/60 hover:bg-white/[0.08] hover:text-white/90"
              )}
            >
              <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
              {isLiked ? "Liked" : "Like"}
            </button>
            <button
              onClick={() => onShare?.(video)}
              className="py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white/90 text-xs transition-all text-center flex flex-col items-center gap-1"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
