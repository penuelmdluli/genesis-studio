"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { PLANS, CREDIT_PACKS, ANNUAL_PLANS, REFERRAL_REWARDS } from "@/lib/constants";
import { PageTransition } from "@/components/ui/motion";
import { Check, X, Zap, CreditCard, Sparkles, Gift, Copy, Users } from "lucide-react";

const TIER_COPY: Record<string, { headline: string; subheading: string; outcome: string; bestFor: string }> = {
  free: {
    headline: "Try Genesis",
    subheading: "Free forever",
    outcome: "Around 1 short video a month to test the platform",
    bestFor: "Curious creators kicking the tyres",
  },
  creator: {
    headline: "For solo creators",
    subheading: "Most popular for individuals",
    outcome: "Around 60 short-form videos a month for TikTok, Reels, and Shorts",
    bestFor: "Solo content creators, hobbyists, side hustles",
  },
  pro: {
    headline: "For serious content",
    subheading: "Hollywood-tier audio",
    outcome: "Around 240 videos a month with Kling 2.6 Pro for cinematic motion and native audio",
    bestFor: "Full-time creators, small agencies, course makers",
  },
  studio: {
    headline: "For agencies and brands",
    subheading: "Top-tier quality",
    outcome: "Around 800 videos a month with Kling 3.0 Pro at 1080p",
    bestFor: "Agencies, production studios, brand teams",
  },
};

const FEATURE_ROWS: { label: string; free: string; creator: string; pro: string; studio: string }[] = [
  { label: "Videos per month (approx.)", free: "1", creator: "60", pro: "240", studio: "800" },
  { label: "Wan 2.2 (open-source)", free: "check", creator: "check", pro: "check", studio: "check" },
  { label: "Kling 2.6 Pro (Hollywood audio)", free: "x", creator: "x", pro: "check", studio: "check" },
  { label: "Kling 3.0 Pro (top-tier 1080p)", free: "x", creator: "x", pro: "x", studio: "check" },
  { label: "Brain Studio (multi-scene)", free: "x", creator: "check", pro: "check", studio: "check" },
  { label: "Voiceover (built-in)", free: "check", creator: "check", pro: "check", studio: "check" },
  { label: "Auto-captions", free: "check", creator: "check", pro: "check", studio: "check" },
  { label: "Max video length", free: "5s", creator: "10s", pro: "10s", studio: "10s" },
  { label: "Resolution", free: "720p", creator: "720p", pro: "720p", studio: "1080p" },
  { label: "Priority queue", free: "x", creator: "x", pro: "check", studio: "check" },
  { label: "Email support", free: "x", creator: "check", pro: "check", studio: "check" },
  { label: "Priority support", free: "x", creator: "x", pro: "check", studio: "check" },
];

function FeatureCell({ value }: { value: string }) {
  if (value === "check") return <Check className="w-4 h-4 text-violet-400 mx-auto" />;
  if (value === "x") return <X className="w-4 h-4 text-zinc-400 mx-auto" />;
  return <span className="text-sm text-zinc-300 font-medium">{value}</span>;
}

export default function PricingPage() {
  const { user, isInitialized } = useStore();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<"USD" | "ZAR">("ZAR");

  // Handle payment redirect outcomes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "true") {
      toast("Payment was cancelled or declined. Please try again or use a different card.", "error");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [toast]);
  const [referralData, setReferralData] = useState<{ code: string; shareUrl: string; referralCount: number; creditsEarned: number } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const formatPrice = (usd: number, zar?: number) => {
    if (currency === "ZAR" && zar) return `R${zar.toLocaleString()}`;
    return `$${usd}`;
  };

  const currencySymbol = currency === "ZAR" ? "R" : "$";

  const loadReferral = async () => {
    setReferralLoading(true);
    try {
      const res = await fetch("/api/referral");
      if (res.ok) setReferralData(await res.json());
    } catch { /* ignore */ }
    setReferralLoading(false);
  };

  // Yoco for ZAR (South Africa), Paystack for USD (international)
  const getProvider = () => currency === "ZAR" ? "yoco" : "paystack";

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/credits/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, provider: getProvider(), currency }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) toast(data.error, "error");
    } catch {
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
        body: JSON.stringify({ packId, provider: getProvider(), currency }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) toast(data.error, "error");
    } catch {
      toast("Failed to start checkout", "error");
    } finally {
      setLoadingPack(null);
    }
  };

  const planStyles: Record<string, { border: string; gradient: string }> = {
    free: { border: "border-white/[0.10]", gradient: "from-white/[0.02] to-transparent" },
    creator: { border: "border-emerald-500/20", gradient: "from-emerald-500/[0.04] to-transparent" },
    pro: { border: "border-violet-500/30 ring-1 ring-violet-500/20", gradient: "from-violet-500/[0.06] to-transparent" },
    studio: { border: "border-amber-500/20", gradient: "from-amber-500/[0.04] to-transparent" },
  };

  const faqs = [
    { q: "What is a credit?", a: "Credits are the currency you spend to generate videos. Different models cost different amounts. Wan 2.2 uses about 40 credits per 5-second video, while Hollywood models like Kling 2.6 Pro use around 100. Credits never expire." },
    { q: "Can I cancel anytime?", a: "Yes. Cancel anytime from your Settings page with no penalties. Your remaining credits stay in your account and never expire." },
    { q: "What happens to unused credits?", a: "They roll over forever. Credits from subscriptions and packs never expire, even if you cancel." },
    { q: "Can I upgrade or downgrade mid-month?", a: "Yes. Upgrading takes effect immediately and prorates the charge. Downgrading takes effect at the end of the current billing period." },
    { q: "Is my content really mine?", a: "Yes. You own all videos you generate on Genesis Studio. Use them commercially, post them anywhere, edit them however you like." },
    { q: "Do you offer team plans?", a: "Not yet. Studio plan supports agency workflows today. Dedicated team features are coming in a future update." },
    { q: "What payment methods do you accept?", a: "We accept all major credit and debit cards via Yoco — South Africa's trusted payment provider. Visa, Mastercard, and local bank cards all supported." },
    { q: "Do you offer refunds?", a: "Failed generations are automatically refunded. For subscription refunds, contact us within 14 days of your charge for a full refund." },
  ];

  return (
    <PageTransition className="space-y-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-glow-top opacity-50 -z-10" />
        <Badge variant="violet" className="mb-4">Pricing</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-3">
          How many videos will you make?
        </h1>
        <p className="text-zinc-400 max-w-lg mx-auto">
          Every plan includes voiceover, captions, and the core AI engine. Upgrade for Hollywood-tier models and multi-scene Brain Studio.
        </p>

        {/* Currency + Billing Toggles */}
        <div className="flex flex-col items-center gap-3 mt-6">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.10]">
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

          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingCycle === "monthly" ? "text-zinc-200" : "text-zinc-400"}`}>Monthly</span>
            <button
              onClick={() => setBillingCycle((prev) => prev === "monthly" ? "annual" : "monthly")}
              className={`relative w-12 h-6 rounded-full transition-colors ${billingCycle === "annual" ? "bg-violet-600" : "bg-white/10"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${billingCycle === "annual" ? "translate-x-7" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm ${billingCycle === "annual" ? "text-zinc-200" : "text-zinc-400"}`}>Annual</span>
            {billingCycle === "annual" && <Badge variant="emerald" className="text-[10px]">Save 20%</Badge>}
          </div>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {PLANS.map((plan) => {
          const isCurrentPlan = user?.plan === plan.id;
          const style = planStyles[plan.id] || planStyles.free;
          const copy = TIER_COPY[plan.id];
          const isAnnual = billingCycle === "annual" && ANNUAL_PLANS[plan.id];

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
              <CardContent className="p-5 space-y-4 pt-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-100">{copy.headline}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{copy.subheading}</p>
                  <div className="mt-3">
                    {isAnnual ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-extrabold text-zinc-100">
                          {currencySymbol}{currency === "ZAR" && plan.priceZAR
                            ? Math.round((plan.priceZAR * 12 * 0.8) / 12)
                            : Math.round(ANNUAL_PLANS[plan.id].annualPrice / 12)}
                        </span>
                        <span className="text-sm text-zinc-400">/mo</span>
                        <div className="text-xs text-emerald-400 mt-1">
                          Billed {currencySymbol}{currency === "ZAR" && plan.priceZAR
                            ? Math.round(plan.priceZAR * 12 * 0.8).toLocaleString()
                            : ANNUAL_PLANS[plan.id].annualPrice}/yr
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl sm:text-4xl font-extrabold text-zinc-100">
                          {formatPrice(plan.price, plan.priceZAR)}
                        </span>
                        {plan.price > 0 && <span className="text-sm text-zinc-400">/mo</span>}
                      </>
                    )}
                  </div>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed min-h-[3rem]">{copy.outcome}</p>
                <p className="text-xs text-zinc-400 italic">{copy.bestFor}</p>

                <Button
                  variant={plan.popular ? "primary" : plan.id === "free" ? "ghost" : "secondary"}
                  className={`w-full ${plan.popular ? "shadow-lg shadow-violet-600/20" : ""}`}
                  disabled={isCurrentPlan || plan.id === "free"}
                  loading={loadingPlan === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isCurrentPlan ? "Current Plan" : plan.id === "free" ? "Free Forever" : `Get ${plan.name}`}
                </Button>

                <p className="text-[10px] text-zinc-400 text-center">
                  {plan.credits.toLocaleString()} credits/mo
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Grid */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 text-center mb-6">Compare plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.10]">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-3 px-2 text-zinc-400 font-medium w-20">Free</th>
                <th className="text-center py-3 px-2 text-zinc-400 font-medium w-20">Creator</th>
                <th className="text-center py-3 px-2 text-violet-400 font-medium w-20">Pro</th>
                <th className="text-center py-3 px-2 text-zinc-400 font-medium w-20">Studio</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.04]">
                  <td className="py-2.5 px-4 text-zinc-300">{row.label}</td>
                  <td className="py-2.5 px-2 text-center"><FeatureCell value={row.free} /></td>
                  <td className="py-2.5 px-2 text-center"><FeatureCell value={row.creator} /></td>
                  <td className="py-2.5 px-2 text-center"><FeatureCell value={row.pro} /></td>
                  <td className="py-2.5 px-2 text-center"><FeatureCell value={row.studio} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor Comparison */}
      <Card className="border-white/[0.10]">
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-lg font-bold text-zinc-100 mb-2">How we compare</h3>
          <p className="text-sm text-zinc-400 mb-6">Genesis Studio is the only platform with full multi-scene production from a single prompt.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.10]">
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Tool</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Cheapest plan</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Approx. $/video</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Genesis equivalent</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tool: "Runway Gen-4", plan: "$15/mo", cost: "~$0.85", equiv: "Creator ($12/mo, ~$0.20/video)" },
                  { tool: "Veo 3 (API)", plan: "API only", cost: "$7.50/10s", equiv: "Studio ($79/mo) — Veo coming soon" },
                  { tool: "Sora (ChatGPT Pro)", plan: "$200/mo", cost: "~$1.00", equiv: "Studio ($79/mo, ~$0.10/video)" },
                  { tool: "Pika Labs Standard", plan: "$10/mo", cost: "~$0.07", equiv: "Free tier comparable" },
                ].map((row) => (
                  <tr key={row.tool} className="border-b border-white/[0.03]">
                    <td className="py-2.5 px-3 text-zinc-300">{row.tool}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{row.plan}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{row.cost}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-medium">{row.equiv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-2">Need more credits?</h2>
          <p className="text-sm text-zinc-400">One-time purchase. Never expire. Stack with your subscription.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} hover className="cursor-pointer">
              <CardContent className="p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 mx-auto flex items-center justify-center border border-emerald-500/15">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-zinc-100">{pack.credits.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">credits</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">{formatPrice(pack.price, pack.priceZAR)}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {currency === "ZAR" && pack.priceZAR
                      ? `${(pack.priceZAR / pack.credits).toFixed(1)}c per credit`
                      : `${(pack.price / pack.credits * 100).toFixed(1)}\u00A2 per credit`}
                  </div>
                </div>
                <Button variant="secondary" className="w-full" loading={loadingPack === pack.id} onClick={() => handleBuyPack(pack.id)}>
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
              <p className="text-sm text-zinc-400">
                Earn {REFERRAL_REWARDS.referrerCredits} credits for every friend who joins. They get {REFERRAL_REWARDS.refereeCredits} bonus credits too.
              </p>
            </div>
            {!referralData && (
              <Button variant="outline" size="sm" onClick={loadReferral} loading={referralLoading}>
                <Users className="w-4 h-4" /> Get My Link
              </Button>
            )}
          </div>
          {referralData && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 p-4 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                <label className="text-xs text-zinc-400 font-medium mb-2 block">Your Referral Link</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={referralData.shareUrl} className="flex-1 bg-white/[0.05] rounded-lg px-3 py-2 text-sm text-zinc-300 border border-white/[0.10] truncate" />
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(referralData.shareUrl); toast("Link copied!", "success"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-zinc-400 mt-2">Code: {referralData.code}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.05] border border-white/[0.10] space-y-3">
                <div><div className="text-2xl font-bold text-violet-300">{referralData.referralCount}</div><div className="text-xs text-zinc-400">Referrals</div></div>
                <div><div className="text-2xl font-bold text-emerald-300">{referralData.creditsEarned}</div><div className="text-xs text-zinc-400">Credits Earned</div></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-lg font-bold text-zinc-100 mb-6">Frequently asked questions</h3>
          <div className="space-y-0 divide-y divide-white/[0.06]">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-4 text-left text-sm font-semibold text-zinc-200 hover:text-zinc-100 transition-colors"
                >
                  {faq.q}
                  <span className={`text-zinc-400 transition-transform ${expandedFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {expandedFaq === i && (
                  <p className="text-sm text-zinc-400 leading-relaxed pb-4 -mt-1">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
