"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { CREDIT_PACKS, UPSELL_THRESHOLDS } from "@/lib/constants";
import { Zap, ArrowRight, Gift, X, TrendingUp } from "lucide-react";

interface CreditUpsellProps {
  variant?: "inline" | "banner" | "modal";
  context?: "low-credits" | "out-of-credits" | "post-generation" | "upgrade";
  onDismiss?: () => void;
}

export function CreditUpsell({ variant = "inline", context = "low-credits", onDismiss }: CreditUpsellProps) {
  const { user } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  if (!user || user.isOwner) return null;

  const balance = user.creditBalance;
  const isLow = balance <= UPSELL_THRESHOLDS.lowCreditWarning;
  const isEmpty = balance <= 0;

  // Don't show if not relevant
  if (context === "low-credits" && !isLow) return null;
  if (context === "out-of-credits" && !isEmpty) return null;

  const handleBuyPack = async (packId: string) => {
    setLoading(packId);
    try {
      const res = await fetch("/api/credits/buy-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async () => {
    setLoading("upgrade");
    try {
      const targetPlan = user.plan === "free" ? "creator" : user.plan === "creator" ? "pro" : "studio";
      const res = await fetch("/api/credits/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: targetPlan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(null);
    }
  };

  // Banner variant — subtle top bar
  if (variant === "banner") {
    return (
      <div className="relative bg-gradient-to-r from-violet-500/10 via-cyan-500/5 to-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-zinc-300">
                {isEmpty
                  ? "You're out of credits!"
                  : `Only ${balance} credits remaining`}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isEmpty
                  ? "Buy a credit pack to keep generating"
                  : "Top up now to avoid interruptions"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleBuyPack("pack-500")}
              disabled={!!loading}
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs"
            >
              {loading === "pack-500" ? "..." : "Buy 500 Credits — $12"}
            </Button>
            {onDismiss && (
              <button onClick={onDismiss} className="p-1 text-zinc-600 hover:text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant — credit pack cards
  if (variant === "inline") {
    return (
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] to-transparent overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              {context === "upgrade" ? "Upgrade Your Plan" : "Need More Credits?"}
            </h3>
            {context === "out-of-credits" && (
              <Badge variant="red" className="text-[10px]">Out of Credits</Badge>
            )}
          </div>

          {context === "upgrade" ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                {`You've used ${Math.round((user.monthlyCreditsUsed / Math.max(1, user.monthlyCreditsLimit)) * 100)}% of your monthly credits. Upgrade for more.`}
              </p>
              <Button
                onClick={handleUpgrade}
                disabled={!!loading}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {loading === "upgrade" ? "Redirecting..." : "Upgrade Plan"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {CREDIT_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => handleBuyPack(pack.id)}
                  disabled={!!loading}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all text-center group"
                >
                  <div className="text-lg font-bold text-zinc-200 group-hover:text-violet-300 transition-colors">
                    {pack.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">credits</div>
                  <div className="text-sm font-semibold text-violet-400 mt-2">
                    ${pack.price}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">
                    ${(pack.price / pack.credits * 100).toFixed(1)}c each
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Hook to determine which upsell to show
 */
export function useUpsellContext(): "low-credits" | "out-of-credits" | "upgrade" | null {
  const { user } = useStore();
  if (!user || user.isOwner) return null;

  if (user.creditBalance <= 0) return "out-of-credits";
  if (user.creditBalance <= UPSELL_THRESHOLDS.lowCreditWarning) return "low-credits";
  if (
    user.monthlyCreditsLimit > 0 &&
    user.monthlyCreditsUsed / user.monthlyCreditsLimit >= UPSELL_THRESHOLDS.upgradePromptAt
  ) {
    return "upgrade";
  }
  return null;
}
