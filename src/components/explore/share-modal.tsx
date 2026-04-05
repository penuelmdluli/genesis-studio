"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  X,
  Link2,
  Download,
  Check,
  ExternalLink,
} from "lucide-react";
import type { ExploreVideo } from "./video-card";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: ExploreVideo;
}

const BASE_URL = "https://genesis-studio-hazel.vercel.app";

function buildShareUrl(videoId: string): string {
  return `${BASE_URL}/explore/${videoId}`;
}

function buildShareText(prompt: string, url: string): string {
  const truncated = prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
  return `Check out this AI video: "${truncated}" — Made with Genesis Studio ✨ ${url}`;
}

async function trackShare(videoId: string, platform: string) {
  try {
    await fetch("/api/share/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, platform }),
    });
  } catch {
    // Silently fail — don't block the share flow
  }
}

interface PlatformButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  bg: string;
  action: "link" | "download" | "copy";
  getUrl?: (shareUrl: string, shareText: string) => string;
}

// WhatsApp icon
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// X / Twitter icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Facebook icon
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// LinkedIn icon
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// TikTok icon
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

// Instagram icon
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" />
    </svg>
  );
}

export function ShareModal({ isOpen, onClose, video }: ShareModalProps) {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const shareUrl = buildShareUrl(video.id);
  const shareText = buildShareText(video.prompt, shareUrl);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast("Link copied to clipboard!", "success");
      trackShare(video.id, "copy_link");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast("Failed to copy link", "error");
    }
  }, [shareUrl, toast, video.id]);

  const handlePlatformShare = useCallback(
    (platform: string, url: string) => {
      trackShare(video.id, platform);
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    },
    [video.id]
  );

  const handleDownloadVideo = useCallback(() => {
    trackShare(video.id, "download");
    const a = document.createElement("a");
    a.href = video.videoUrl;
    a.download = `genesis-${video.id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("Downloading video...", "info");
  }, [video.id, video.videoUrl, toast]);

  const handleBrandedDownload = useCallback(
    (platform: string) => {
      trackShare(video.id, platform);
      // For TikTok/Instagram, download the video (in production this would be a branded version)
      const a = document.createElement("a");
      a.href = video.videoUrl;
      a.download = `genesis-${platform}-${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast(`Downloading ${platform} video...`, "info");
    },
    [video.id, video.videoUrl, toast]
  );

  const platforms: PlatformButton[] = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <WhatsAppIcon className="w-5 h-5" />,
      bg: "bg-green-600 hover:bg-green-500",
      action: "link",
      getUrl: () => `https://wa.me/?text=${encodedText}`,
    },
    {
      id: "twitter",
      label: "X / Twitter",
      icon: <XIcon className="w-5 h-5" />,
      bg: "bg-zinc-800 hover:bg-zinc-700",
      action: "link",
      getUrl: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(video.prompt, ""))}&url=${encodedUrl}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <FacebookIcon className="w-5 h-5" />,
      bg: "bg-blue-600 hover:bg-blue-500",
      action: "link",
      getUrl: () => `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: <LinkedInIcon className="w-5 h-5" />,
      bg: "bg-blue-700 hover:bg-blue-600",
      action: "link",
      getUrl: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: <TikTokIcon className="w-5 h-5" />,
      bg: "bg-zinc-900 hover:bg-zinc-800 border border-white/10",
      action: "download",
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: <InstagramIcon className="w-5 h-5" />,
      bg: "bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500",
      action: "download",
    },
    {
      id: "download",
      label: "Download",
      icon: <Download className="w-5 h-5" />,
      bg: "bg-violet-600 hover:bg-violet-500",
      action: "download",
    },
    {
      id: "copy",
      label: isCopied ? "Copied!" : "Copy Link",
      icon: isCopied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />,
      bg: isCopied ? "bg-emerald-600" : "bg-zinc-700 hover:bg-zinc-600",
      action: "copy",
    },
  ];

  const handlePlatformClick = useCallback(
    (platform: PlatformButton) => {
      if (platform.action === "copy") {
        handleCopyLink();
      } else if (platform.action === "link" && platform.getUrl) {
        handlePlatformShare(platform.id, platform.getUrl(shareUrl, shareText));
      } else if (platform.action === "download") {
        if (platform.id === "download") {
          handleDownloadVideo();
        } else {
          handleBrandedDownload(platform.id);
        }
      }
    },
    [handleCopyLink, handlePlatformShare, handleDownloadVideo, handleBrandedDownload, shareUrl, shareText]
  );

  if (!isOpen) return null;

  const truncatedPrompt = video.prompt.length > 80 ? video.prompt.slice(0, 80) + "..." : video.prompt;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share this video"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal content */}
      <div
        className={cn(
          "relative w-full backdrop-blur-xl bg-[#111118]/95 shadow-2xl animate-fade-in-scale",
          // Mobile: bottom sheet
          isMobile
            ? "rounded-t-2xl max-h-[85vh] overflow-y-auto"
            : "sm:max-w-lg sm:rounded-2xl sm:mx-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-zinc-100">Share this video</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video preview */}
        <div className="mx-5 mb-4 flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.prompt}
              className="w-16 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-12 rounded-lg bg-violet-900/30 shrink-0 flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-violet-400" />
            </div>
          )}
          <p className="text-sm text-zinc-300 line-clamp-2 leading-snug">{truncatedPrompt}</p>
        </div>

        {/* Share URL display */}
        <div className="mx-5 mb-4">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Link2 className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-400 truncate flex-1 font-mono">{shareUrl}</span>
            <button
              onClick={handleCopyLink}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0",
                isCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-violet-600 hover:bg-violet-500 text-white"
              )}
            >
              {isCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Platform buttons grid */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-2.5">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformClick(platform)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all duration-200 press-effect",
                  platform.bg
                )}
              >
                <span className="text-white">{platform.icon}</span>
                <span className="text-[10px] font-medium text-white/90 leading-tight text-center">
                  {platform.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
