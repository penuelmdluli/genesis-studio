"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { PLANS, CREDIT_PACKS } from "@/lib/constants";
import { PageTransition, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { Check, Zap, CreditCard, ArrowRight, Sparkles } from "lucide-react";

export default function PricingPage() {
  const { user } = useStore();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/credits/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Subscribe failed:", err);
      toast("Failed to start checkout", "error");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId);
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
    } catch (err) {
      console.error("Buy pack failed:", err);
      toast("Failed to start checkout", "error");
    } finally {
      setLoadingPack(null);
    }
  };

  const planStyles: Record<string, { border: string; gradient: string; badge: string }> = {
    free: { border: "border-white/[0.06]", gradient: "from-white/[0.02] to-transparent", badge: "default" },
    creator: { border: "border-emerald-500/20", gradient: "from-emerald-500/[0.04] to-transparent", badge: "emerald" },
    pro: { border: "border-violet-500/30 ring-1 ring-violet-500/20", gradient: "from-violet-500/[0.06] to-transparent", badge: "violet" },
    studio: { border: "border-amber-500/20", gradient: "from-amber-500/[0.04] to-transparent", badge: "amber" },
  };

  return (
    <PageTransition className="space-y-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-glow-top opacity-50 -z-10" />
        <Badge variant="violet" className="mb-4">Pricing</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-zinc-400 max-w-lg mx-auto">
          Credits never expire. No watermarks on paid plans. API access on every tier.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrentPlan = user?.plan === plan.id;
          const style = planStyles[plan.id] || planStyles.free;
          return (
            <Card
              key={plan.id}
              className={`relative ${style.border} bg-gradient-to-b ${style.gradient} ${plan.popular ? "ring-2 ring-violet-500 shadow-lg shadow-violet-500/10" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="violet" className="px-3 shadow-lg shadow-violet-500/20">
                    <Sparkles className="w-3 h-3 mr-1" /> BEST VALUE
                  </Badge>
                </div>
              )}
              <CardContent className="p-5 space-y-5 pt-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-extrabold text-zinc-100">${plan.price}</span>
                    <span className="text-sm text-zinc-500">/mo</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <span className="text-zinc-400">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={plan.popular ? "primary" : plan.id === "free" ? "ghost" : "secondary"}
                  className={`w-full ${plan.popular ? "shadow-lg shadow-violet-600/20" : ""}`}
                  disabled={isCurrentPlan || plan.id === "free"}
                  loading={loadingPlan === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isCurrentPlan
                    ? "Current Plan"
                    : plan.id === "free"
                    ? "Free Forever"
                    : plan.id === "studio"
                    ? "Contact Us"
                    : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Credit Packs */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-2">
            Credit Packs
          </h2>
          <p className="text-sm text-zinc-500">
            One-time purchase. Never expire. Stack with your subscription.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} hover className="cursor-pointer">
              <CardContent className="p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 mx-auto flex items-center justify-center border border-emerald-500/15">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-zinc-100">
                    {pack.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">credits</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">${pack.price}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    ${(pack.price / pack.credits * 100).toFixed(1)}&cent; per credit
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={loadingPack === pack.id}
                  onClick={() => handleBuyPack(pack.id)}
                >
                  <CreditCard className="w-4 h-4" /> Buy Pack
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Frequently Asked</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 text-sm">
            {[
              {
                q: "Do credits expire?",
                a: "Never. Your credits are yours forever, whether from subscription or one-time packs.",
              },
              {
                q: "What if a generation fails?",
                a: "Full refund. Every time. Failed generations are automatically refunded to your account.",
              },
              {
                q: "Can I use the API on the free plan?",
                a: "Yes! API access is available on every plan, including free. No gatekeeping.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel anytime with no penalties. Your remaining credits stay in your account.",
              },
            ].map((faq) => (
              <div key={faq.q}>
                <p className="font-semibold text-zinc-200 mb-1.5">{faq.q}</p>
                <p className="text-zinc-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
