"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useStore } from "@/hooks/use-store";
import { CREDIT_PACKS } from "@/lib/constants";
import { Zap, ArrowRight, Loader2, Crown, Check } from "lucide-react";

export function CreditPurchaseModal() {
  const router = useRouter();
  const { user, creditPurchaseOpen, setCreditPurchaseOpen } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  const packs = CREDIT_PACKS.map((pack, i) => ({
    ...pack,
    popular: i === 1,
    perCredit: (pack.price / pack.credits * 100).toFixed(1),
    savings:
      i === 0 ? null :
      i === 1 ? "Save 17%" :
      "Best value",
  }));

  async function handleBuyPack(packId: string) {
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
      setLoading(null);
    }
  }

  return (
    <Modal
      open={creditPurchaseOpen}
      onClose={() => setCreditPurchaseOpen(false)}
      size="md"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-500/20">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">Add Credits</h2>
        <p className="text-sm text-zinc-500 mt-1">Credits never expire. Use them anytime.</p>
        {user && (
          <p className="text-xs text-zinc-600 mt-2">
            Current balance: <span className="text-violet-400 font-semibold">{user.creditBalance.toLocaleString()}</span> credits
          </p>
        )}
      </div>

      {/* Credit Packs */}
      <div className="space-y-2.5">
        {packs.map((pack) => (
          <button
            key={pack.id}
            onClick={() => handleBuyPack(pack.id)}
            disabled={loading !== null}
            className={`relative w-full flex items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 ${
              pack.popular
                ? "border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/20 shadow-lg shadow-violet-500/5"
                : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                pack.popular ? "bg-violet-500/20" : "bg-white/[0.06]"
              }`}>
                <Zap className={`w-5 h-5 ${pack.popular ? "text-violet-400" : "text-zinc-400"}`} />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">
                  {pack.credits.toLocaleString()} credits
                </p>
                <p className="text-[11px] text-zinc-500">
                  {pack.perCredit}¢ per credit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {pack.savings && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  {pack.savings}
                </span>
              )}
              <div className="text-right">
                <p className="text-white font-bold">${pack.price}</p>
              </div>
              {loading === pack.id ? (
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              )}
            </div>
            {pack.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[10px] text-white font-bold tracking-wide shadow-lg">
                POPULAR
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plan Upgrade CTA */}
      {user && user.plan !== "studio" && (
        <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-violet-950/60 to-fuchsia-950/40 border border-violet-500/15">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Crown className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Want more credits monthly?</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upgrade your plan for monthly credits + premium models.
              </p>
              <button
                onClick={() => {
                  setCreditPurchaseOpen(false);
                  router.push("/pricing");
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                View Plans <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What you get */}
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium mb-2">What credits cover</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "Video generation",
            "Motion control",
            "AI voiceover",
            "Auto captions",
            "Video upscaling",
            "AI thumbnails",
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
