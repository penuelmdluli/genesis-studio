"use client";

import { useState } from "react";
import { ThumbsUp, Minus, ThumbsDown } from "lucide-react";

interface VideoRatingProps {
  videoId: string;
  initialRating?: "great" | "okay" | "bad" | null;
  size?: "sm" | "md";
}

export function VideoRating({ videoId, initialRating = null, size = "sm" }: VideoRatingProps) {
  const [rating, setRating] = useState<string | null>(initialRating);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (newRating: "great" | "okay" | "bad") => {
    if (isSubmitting) return;
    const ratingToSet = rating === newRating ? null : newRating;
    setRating(ratingToSet);
    setIsSubmitting(true);

    try {
      await fetch(`/api/videos/${videoId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: ratingToSet || newRating }),
      });
    } catch {
      // Revert on error
      setRating(initialRating);
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const btnSize = size === "sm" ? "p-1.5" : "p-2";

  const buttons = [
    { value: "great" as const, icon: ThumbsUp, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", label: "Great" },
    { value: "okay" as const, icon: Minus, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", label: "Okay" },
    { value: "bad" as const, icon: ThumbsDown, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", label: "Bad" },
  ];

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Rate this video">
      {buttons.map((btn) => {
        const isActive = rating === btn.value;
        return (
          <button
            key={btn.value}
            onClick={() => handleRate(btn.value)}
            className={`${btnSize} rounded-lg border transition-all ${
              isActive
                ? `${btn.bg} ${btn.color}`
                : "border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
            }`}
            title={btn.label}
            aria-label={`Rate video: ${btn.label}`}
            aria-pressed={isActive}
            disabled={isSubmitting}
          >
            <btn.icon className={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
