"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { CREDIT_PACKS, STARTER_PACK_ID, UPSELL_THRESHOLDS } from "@/lib/constants";
import { usePaymentInfo, packPriceLabel } from "@/hooks/use-payment-info";
import { trackEvent } from "@/lib/analytics-events";
import { Zap, ArrowRight, Gift, X, TrendingUp } from "lucide-react";

interface CreditUpsellProps {
  variant?: "inline" | "banner" | "modal";
  /** "insufficient": the thing they want costs more than they have. Always shown. */
  context?: "low-credits" | "out-of-credits" | "insufficient" | "post-generation" | "upgrade";
  /** Credits short for the current job, for the "insufficient" message. */
  shortfall?: number;
  onDismiss?: () => void;
}

export function CreditUpsell({ variant = "inline", context = "low-credits", shortfall, onDismiss }: CreditUpsellProps) {
  const { user } = useStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payInfo = usePaymentInfo();

  // Record each time a free user is actually shown a way to pay, once per
  // mount, so the funnel can compare "saw an offer" with "tapped it".
  const visible =
    !!user && !user.isOwner &&
    !(context === "low-credits" && user.creditBalance > UPSELL_THRESHOLDS.lowCreditWarning) &&
    !(context === "out-of-credits" && user.creditBalance > 0);
  useEffect(() => {
    if (visible) trackEvent("upsell_shown", { context, variant, balance: user?.creditBalance ?? -1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, context]);

  if (!user || user.isOwner) return null;

  const balance = user.creditBalance;
  const isLow = balance <= UPSELL_THRESHOLDS.lowCreditWarning;
  const isEmpty = balance <= 0;

  // Don't show if not relevant
  if (context === "low-credits" && !isLow) return null;
  if (context === "out-of-credits" && !isEmpty) return null;

  const handleBuyPack = async (packId: string) => {
    setLoading(packId);
    trackEvent("topup_pack_clicked", { product: packId, balance: user.creditBalance, source: `upsell_${variant}` });
    trackEvent("checkout_started", { kind: "pack", product: packId, currency: "ZAR", source: `upsell_${variant}` });
    try {
      const res = await fetch("/api/credits/buy-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // Silence here was the bug: the customer saw a spinner stop and nothing
      // else, and nothing was recorded either (2026-09-21).
      setError(data.error || "Checkout could not start. Please try again.");
      trackEvent("checkout_failed", { kind: "pack", product: packId, reason: String(data.error || res.status).slice(0, 80) });
    } catch {
      setError("Could not reach the payment page. Check your connection and try again.");
      trackEvent("checkout_failed", { kind: "pack", product: packId, reason: "network" });
    } finally {
      setLoading(null);
    }
  };

  const starter = CREDIT_PACKS.find((p) => p.id === STARTER_PACK_ID)!;
  const starterPrice = packPriceLabel(starter, payInfo).main;

  const handleUpgrade = async () => {
    setLoading("upgrade");
    try {
      const targetPlan = user.plan === "free" ? "creator" : user.plan === "creator" ? "pro" : "studio";
      const res = await fetch("/api/credits/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: targetPlan }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // Silence here was the bug: the customer saw a spinner stop and nothing
      // else, and nothing was recorded either (2026-09-21).
      setError(data.error || "Checkout could not start. Please try again.");
    } catch {
      setError("Could not reach the payment page. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  };

  // Banner variant — subtle top bar
  if (variant === "banner") {
    return (
      <div className="relative bg-gradient-to-r from-violet-500/10 via-cyan-500/5 to-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-4">
        {error && (
          <p className="mb-2 text-xs text-red-300">{error} Nothing has been charged.</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-zinc-300">
                {context === "insufficient" && shortfall
                  ? `You need ${shortfall} more credits for this`
                  : isEmpty
                    ? "You're out of credits!"
                    : `Only ${balance} credits remaining`}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEmpty || context === "insufficient"
                  ? "Top up to keep generating"
                  : "Top up now to avoid interruptions"}
                {" · "}One-time payment, no subscription
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleBuyPack(STARTER_PACK_ID)}
              disabled={!!loading}
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs"
            >
              {loading === STARTER_PACK_ID ? "..." : `${starter.credits} credits — ${starterPrice}`}
            </Button>
            {onDismiss && (
              <button onClick={onDismiss} className="p-1 text-zinc-400 hover:text-zinc-400">
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
          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error} Nothing has been charged.
            </p>
          )}
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
              <p className="text-xs text-zinc-400">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CREDIT_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => handleBuyPack(pack.id)}
                  disabled={!!loading}
                  className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.10] hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all text-center group"
                >
                  <div className="text-lg font-bold text-zinc-200 group-hover:text-violet-300 transition-colors">
                    {pack.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">credits</div>
                  <div className="text-sm font-semibold text-violet-400 mt-2">
                    {packPriceLabel(pack, payInfo).main}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {pack.id === STARTER_PACK_ID ? "Start here" : `About ${Math.floor(pack.credits / 30)} videos`}
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
