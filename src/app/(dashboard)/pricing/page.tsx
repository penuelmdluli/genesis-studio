"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { PLANS, CREDIT_PACKS } from "@/lib/constants";
import { Check, Zap, CreditCard, ArrowRight } from "lucide-react";

export default function PricingPage() {
  const { user } = useStore();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
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
    } finally {
      setLoadingPack(null);
    }
  };

  const planColors: Record<string, string> = {
    free: "border-zinc-700",
    creator: "border-emerald-500/30",
    pro: "border-violet-500",
    studio: "border-amber-500/30",
  };

  const planCtaColors: Record<string, string> = {
    free: "secondary",
    creator: "secondary",
    pro: "primary",
    studio: "outline",
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-100">Pricing</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Credits never expire. No watermarks on paid plans. API on every tier.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrentPlan = user?.plan === plan.id;
          return (
            <Card
              key={plan.id}
              className={`relative ${planColors[plan.id]} ${plan.popular ? "ring-2 ring-violet-500" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="violet" className="px-3">BEST VALUE</Badge>
                </div>
              )}
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-300">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-extrabold text-zinc-100">${plan.price}</span>
                    <span className="text-sm text-zinc-500">/mo</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <span className="text-zinc-400">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={planCtaColors[plan.id] as "primary" | "secondary" | "outline"}
                  className="w-full"
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
        <h2 className="text-xl font-bold text-zinc-100 text-center mb-2">
          Credit Packs
        </h2>
        <p className="text-sm text-zinc-500 text-center mb-6">
          One-time purchase. Never expire. Stack with your subscription.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id}>
              <CardContent className="p-5 text-center space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 mx-auto flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-100">
                    {pack.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-500">credits</div>
                </div>
                <div className="text-xl font-bold text-emerald-400">${pack.price}</div>
                <div className="text-xs text-zinc-500">
                  ${(pack.price / pack.credits * 100).toFixed(1)}¢ per credit
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
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-zinc-100 mb-4">Frequently Asked</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
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
                <p className="font-medium text-zinc-200 mb-1">{faq.q}</p>
                <p className="text-zinc-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
