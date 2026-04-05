"use client";

import { useStore } from "@/hooks/use-store";
import { Zap, X } from "lucide-react";
import { useState } from "react";

export function LowCreditBanner() {
  const { user, setCreditPurchaseOpen } = useStore();
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed) return null;

  const credits = user.creditBalance;
  const isOwner = user.isOwner;

  // Don't show for owners or users with enough credits
  if (isOwner || credits > 100) return null;

  const isEmpty = credits <= 0;
  const videosLeft = Math.floor(credits / 40); // ~40 credits for cheapest video

  if (isEmpty) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
            <Zap className="w-3 h-3 text-red-400" />
          </div>
          <p className="text-xs text-red-300">
            <span className="font-semibold">Out of credits.</span> Buy more to continue creating.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreditPurchaseOpen(true)}
            className="px-3 py-1 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-medium transition-colors"
          >
            Buy Credits
          </button>
          <button onClick={() => setDismissed(true)} className="text-red-400/50 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/8 border-b border-amber-500/15 px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Zap className="w-3 h-3 text-amber-400" />
        </div>
        <p className="text-xs text-amber-300">
          <span className="font-semibold">{credits} credits left</span>
          {videosLeft > 0
            ? ` — enough for ~${videosLeft} video${videosLeft > 1 ? "s" : ""}.`
            : " — not enough for a video."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCreditPurchaseOpen(true)}
          className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium transition-colors"
        >
          Top Up
        </button>
        <button onClick={() => setDismissed(true)} className="text-amber-400/50 hover:text-amber-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
