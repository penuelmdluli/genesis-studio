"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { PLANS, CREDIT_PACKS, ANNUAL_PLANS, REFERRAL_REWARDS } from "@/lib/constants";
import { PageTransition, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { Check, Zap, CreditCard, ArrowRight, Sparkles, Gift, Copy, Users } from "lucide-react";

export default function PricingPage() {
  const { user } = useStore();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<"USD" | "ZAR">("ZAR");
  const [referralData, setReferralData] = useState<{ code: string; shareUrl: string; referralCount: number; creditsEarned: number } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  const formatPrice = (usd: number, zar?: number) => {
    if (currency === "ZAR" && zar) return `R${zar.toLocaleString()}`;
    return `$${usd}`;
  };

  const currencySymbol = currency === "ZAR" ? "R" : "$";

  const loadReferral = async () => {
    setReferralLoading(true);
    try {
      const res = await fetch("/api/referral");
      if (res.ok) {
        const data = await res.json();
        setReferralData(data);
      }
    } catch { /* ignore */ }
    setReferralLoading(false);
  };

  const getProvider = () => currency === "ZAR" ? "yoco" : undefined;

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/credits/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, provider: getProvider() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast(data.error, "error");
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
        body: JSON.stringify({ packId, provider: getProvider() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast(data.error, "error");
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

        {/* Currency + Billing Toggles */}
        <div className="flex flex-col items-center gap-3 mt-6">
          {/* Currency selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={() => setCurrency("ZAR")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currency === "ZAR" ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              ZAR (R)
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currency === "USD" ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              USD ($)
            </button>
          </div>

          {/* Billing cycle toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingCycle === "monthly" ? "text-zinc-200" : "text-zinc-500"}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle((prev) => prev === "monthly" ? "annual" : "monthly")}
              className={`relative w-12 h-6 rounded-full transition-colors ${billingCycle === "annual" ? "bg-violet-600" : "bg-white/10"}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${billingCycle === "annual" ? "translate-x-7" : "translate-x-1"}`}
              />
            </button>
            <span className={`text-sm ${billingCycle === "annual" ? "text-zinc-200" : "text-zinc-500"}`}>
              Annual
            </span>
            {billingCycle === "annual" && (
              <Badge variant="emerald" className="text-[10px]">Save 20%</Badge>
            )}
          </div>
        </div>
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
                    {billingCycle === "annual" && ANNUAL_PLANS[plan.id] ? (
                      <>
                        <span className="text-4xl font-extrabold text-zinc-100">
                          {currencySymbol}{currency === "ZAR" && plan.priceZAR
                            ? Math.round((plan.priceZAR * 12 * 0.8) / 12)
                            : Math.round(ANNUAL_PLANS[plan.id].annualPrice / 12)}
                        </span>
                        <span className="text-sm text-zinc-500">/mo</span>
                        <div className="text-xs text-emerald-400 mt-1">
                          {currencySymbol}{currency === "ZAR" && plan.priceZAR
                            ? Math.round(plan.priceZAR * 12 * 0.8).toLocaleString()
                            : ANNUAL_PLANS[plan.id].annualPrice}/yr — save 20%
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-zinc-100">
                          {formatPrice(plan.price, plan.priceZAR)}
                        </span>
                        <span className="text-sm text-zinc-500">/mo</span>
                      </>
                    )}
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
                  <div className="text-xl font-bold text-emerald-400">
                    {formatPrice(pack.price, pack.priceZAR)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {currency === "ZAR" && pack.priceZAR
                      ? `${(pack.priceZAR / pack.credits).toFixed(1)}c per credit`
                      : `${(pack.price / pack.credits * 100).toFixed(1)}\u00A2 per credit`}
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

      {/* Referral Program */}
      <Card className="border-violet-500/15 bg-gradient-to-br from-violet-500/[0.03] to-transparent overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold text-zinc-100">Referral Program</h3>
              </div>
              <p className="text-sm text-zinc-500">
                Earn {REFERRAL_REWARDS.referrerCredits} credits for every friend who joins. They get {REFERRAL_REWARDS.refereeCredits} bonus credits too.
              </p>
            </div>
            {!referralData && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadReferral}
                loading={referralLoading}
              >
                <Users className="w-4 h-4" /> Get My Link
              </Button>
            )}
          </div>

          {referralData && (
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Referral Link */}
              <div className="sm:col-span-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <label className="text-xs text-zinc-500 font-medium mb-2 block">Your Referral Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={referralData.shareUrl}
                    className="flex-1 bg-white/[0.03] rounded-lg px-3 py-2 text-sm text-zinc-300 border border-white/[0.06] truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(referralData.shareUrl);
                      toast("Link copied!", "success");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-zinc-600 mt-2">Code: {referralData.code}</p>
              </div>

              {/* Stats */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <div>
                  <div className="text-2xl font-bold text-violet-300">{referralData.referralCount}</div>
                  <div className="text-xs text-zinc-500">Referrals</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-300">{referralData.creditsEarned}</div>
                  <div className="text-xs text-zinc-500">Credits Earned</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
