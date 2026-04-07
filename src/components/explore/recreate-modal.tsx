"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import {
  X,
  Copy,
  Pencil,
  ImagePlus,
  Move3d,
  ArrowRight,
  Sparkles,
  Mail,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { ExploreVideo } from "./video-card";

interface RecreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: ExploreVideo;
}

// Google icon for sign-up button
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface RecreateOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
}

export function RecreateModal({ isOpen, onClose, video }: RecreateModalProps) {
  const { isSignedIn, isLoaded } = useUser();
  const [editPrompt, setEditPrompt] = useState(video.prompt);
  const [showEditor, setShowEditor] = useState(false);

  // Reset state when modal opens with a new video
  useEffect(() => {
    if (isOpen) {
      setEditPrompt(video.prompt);
      setShowEditor(false);
    }
  }, [isOpen, video.prompt]);

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

  const handleSignUpIntent = useCallback(
    (method: "google" | "email") => {
      // Store recreate intent in sessionStorage for post-signup redirect
      sessionStorage.setItem(
        "genesis_recreate_intent",
        JSON.stringify({
          prompt: video.prompt,
          modelId: video.modelId,
          videoUrl: video.videoUrl,
          sourceVideoId: video.id,
        })
      );

      // Redirect to sign-up — Clerk will handle the flow
      const redirectUrl = `/generate?prompt=${encodeURIComponent(video.prompt)}&model=${encodeURIComponent(video.modelId)}`;
      const signUpUrl = method === "google"
        ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}&strategy=oauth_google`
        : `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`;

      window.location.href = signUpUrl;
    },
    [video]
  );

  if (!isOpen) return null;

  const encodedPrompt = encodeURIComponent(video.prompt);
  const encodedModel = encodeURIComponent(video.modelId);

  const recreateOptions: RecreateOption[] = [
    {
      id: "exact",
      title: "Use exact same prompt",
      description: "Generate a new video with the same prompt and model settings",
      icon: <Copy className="w-5 h-5 text-violet-400" />,
      href: `/generate?prompt=${encodedPrompt}&model=${encodedModel}`,
    },
    {
      id: "edit",
      title: "Edit prompt first",
      description: "Modify the prompt before generating your own version",
      icon: <Pencil className="w-5 h-5 text-amber-400" />,
    },
    {
      id: "image",
      title: "Use my own image",
      description: "Use image-to-video mode with this prompt as a starting point",
      icon: <ImagePlus className="w-5 h-5 text-cyan-400" />,
      href: `/generate?mode=i2v&prompt=${encodedPrompt}`,
    },
    {
      id: "motion",
      title: "Use as motion reference",
      description: "Use this video as a motion reference for your new creation",
      icon: <Move3d className="w-5 h-5 text-pink-400" />,
      href: `/motion-control?ref=${encodeURIComponent(video.videoUrl)}`,
    },
  ];

  const handleOptionClick = (option: RecreateOption) => {
    if (option.id === "edit") {
      setShowEditor(true);
    }
    // Options with href are handled by Link component
  };

  // Logged-in recreate view
  const renderLoggedInContent = () => {
    if (showEditor) {
      return (
        <div className="px-5 pb-5 space-y-4">
          <button
            onClick={() => setShowEditor(false)}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            Back to options
          </button>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Edit your prompt
            </label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              className={cn(
                "w-full px-4 py-3 rounded-xl text-sm text-zinc-100 placeholder-zinc-600",
                "bg-white/[0.04] border border-white/[0.08]",
                "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40",
                "resize-none transition-all"
              )}
              placeholder="Describe your video..."
            />
          </div>

          <Link
            href={`/generate?prompt=${encodeURIComponent(editPrompt)}&model=${encodedModel}`}
            onClick={onClose}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg",
              "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400",
              "text-white font-medium text-sm",
              "shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30",
              "transition-all duration-200 press-effect"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Generate Video
            <ArrowRight className="w-4 h-4 opacity-60" />
          </Link>
        </div>
      );
    }

    return (
      <div className="px-5 pb-5 space-y-2.5">
        {recreateOptions.map((option) => {
          const content = (
            <div
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl",
                "bg-white/[0.03] border border-white/[0.06]",
                "hover:bg-white/[0.06] hover:border-white/[0.10]",
                "transition-all duration-200 cursor-pointer group/option"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-zinc-100">{option.title}</h4>
                <p className="text-xs text-zinc-500 mt-0.5">{option.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover/option:text-zinc-300 transition-colors shrink-0" />
            </div>
          );

          if (option.href) {
            return (
              <Link key={option.id} href={option.href} onClick={onClose}>
                {content}
              </Link>
            );
          }

          return (
            <div key={option.id} onClick={() => handleOptionClick(option)}>
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  // Not logged in — sign-up prompt
  const renderSignUpContent = () => (
    <div className="px-5 pb-6 space-y-5">
      {/* Hero text */}
      <div className="text-center space-y-2 py-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-600/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-base font-semibold text-zinc-100">
          Create your free account to recreate this video
        </h3>
        <p className="text-sm text-zinc-500">
          Get 50 free credits — start creating in 60 seconds
        </p>
      </div>

      {/* Sign up buttons */}
      <div className="space-y-2.5">
        <button
          onClick={() => handleSignUpIntent("google")}
          className={cn(
            "flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl",
            "bg-white hover:bg-zinc-100",
            "text-zinc-900 font-medium text-sm",
            "transition-all duration-200 press-effect",
            "shadow-lg shadow-black/20"
          )}
        >
          <GoogleIcon className="w-5 h-5" />
          Sign up with Google
        </button>

        <button
          onClick={() => handleSignUpIntent("email")}
          className={cn(
            "flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl",
            "bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.12]",
            "text-zinc-100 font-medium text-sm",
            "transition-all duration-200 press-effect"
          )}
        >
          <Mail className="w-5 h-5 text-zinc-400" />
          Sign up with Email
        </button>
      </div>

      {/* Video preview */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.prompt}
            className="w-14 h-10 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-14 h-10 rounded-lg bg-violet-900/30 shrink-0" />
        )}
        <p className="text-xs text-zinc-400 line-clamp-2 leading-snug">
          {video.prompt.length > 80 ? video.prompt.slice(0, 80) + "..." : video.prompt}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recreate this video"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl backdrop-blur-xl bg-[#111118]/95 shadow-2xl animate-fade-in-scale",
          "border border-white/[0.06]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isLoaded && isSignedIn ? "Recreate This Video" : "Join Genesis Studio"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {!isLoaded ? (
          // Loading state
          <div className="px-5 pb-5 flex items-center justify-center py-8">
            <GenesisLoader size="md" />
          </div>
        ) : isSignedIn ? (
          renderLoggedInContent()
        ) : (
          renderSignUpContent()
        )}
      </div>
    </div>
  );
}
