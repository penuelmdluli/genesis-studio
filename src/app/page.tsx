"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Zap,
  Shield,
  Code,
  Film,
  Image as ImageIcon,
  RefreshCw,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";

const models = [
  { name: "Wan 2.2", tier: "FLAGSHIP", desc: "Best cinematic quality. Complex motion.", color: "text-violet-400", bg: "bg-violet-500/10" },
  { name: "HunyuanVideo 1.5", tier: "WORKHORSE", desc: "Best efficiency/quality ratio.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { name: "LTX-Video 13B", tier: "SPEED KING", desc: "Fastest — real-time on H100.", color: "text-amber-400", bg: "bg-amber-500/10" },
  { name: "Mochi 1", tier: "REALISM", desc: "Best prompt adherence. Photorealistic.", color: "text-pink-400", bg: "bg-pink-500/10" },
  { name: "CogVideoX-5B", tier: "BUDGET", desc: "Quick previews. Low cost.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
];

const features = [
  { icon: Film, title: "Text-to-Video", desc: "Describe anything, watch it come to life. Multiple quality tiers from draft to cinema." },
  { icon: ImageIcon, title: "Image-to-Video", desc: "Animate any still image. Upload a photo and add motion, depth, and life." },
  { icon: RefreshCw, title: "Draft → Refine", desc: "Fast 3-second preview, then HD render. Saves 80% on GPU costs." },
  { icon: Code, title: "API from Day 1", desc: "REST API on every plan. Build AI video into your app. No gatekeeping." },
  { icon: Shield, title: "Credits Never Expire", desc: "Your credits are yours forever. No monthly expiry. Stack with subscriptions." },
  { icon: Zap, title: "Serverless GPUs", desc: "Scale from 0 to 1000s of GPUs in seconds. Pay per millisecond. $0 when idle." },
];

const competitors = [
  { name: "Runway", issue: "$12–$95/mo, credits expire monthly" },
  { name: "Kling", issue: "Credits expire mid-subscription, 30-40% failure rates" },
  { name: "Pika", issue: "1.6★ Trustpilot, 87% one-star reviews" },
  { name: "Sora", issue: "Dead. $15M/day burn rate killed it." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.12),transparent_70%)]" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <Badge variant="violet" className="mb-6 px-4 py-1.5">
            <Sparkles className="w-3 h-3 mr-1" /> Open-Source AI Video Platform
          </Badge>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6">
            <span className="gradient-text-hero">From Nothing,</span>
            <br />
            <span className="gradient-text">Create Everything</span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Hollywood-grade AI video generation powered by open-source models
            and serverless GPUs. 70-90% cheaper than competitors. Credits never
            expire.
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Link href="/sign-up">
              <Button size="lg" className="text-base px-8">
                Start Creating Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="text-base px-8">
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 sm:gap-16">
            {[
              { value: "6", label: "AI Models" },
              { value: "70%", label: "Cost Savings" },
              { value: "$0", label: "Hardware Cost" },
              { value: "24/7", label: "API Access" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-xs sm:text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="py-20 px-4 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The Competition is <span className="text-red-400">Broken</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Sora shut down burning $15M/day. The $2.4B AI video market is
              wide open. Here&apos;s why we win.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {competitors.map((c) => (
              <div
                key={c.name}
                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/10"
              >
                <span className="text-red-400 mt-0.5">&#x2715;</span>
                <div>
                  <span className="font-semibold text-red-300">{c.name}:</span>{" "}
                  <span className="text-zinc-400">{c.issue}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-lg font-bold text-emerald-300">Genesis Studio</span>
            </div>
            <p className="text-zinc-400">
              Open models, transparent pricing, credits never expire, API from
              day one, failed generations = full refund.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to <span className="gradient-text">Create</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-violet-500/30 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section id="models" className="py-20 px-4 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="gradient-text">Open-Source</span> Model Arsenal
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              All models are open-source, free to use, and running on serverless
              GPUs. No licensing fees. Full control.
            </p>
          </div>

          <div className="space-y-3">
            {models.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <Star className={`w-5 h-5 ${m.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100">{m.name}</span>
                    <Badge variant="violet" className="text-[10px]">{m.tier}</Badge>
                  </div>
                  <p className="text-sm text-zinc-400 truncate">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-center">
            <p className="text-sm text-amber-300">
              <strong>STRATEGY:</strong> &ldquo;Draft then Refine&rdquo; — Generate fast
              previews with LTX/CogVideo, then render final with Wan 2.2.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to <span className="gradient-text">Create</span>?
          </h2>
          <p className="text-zinc-400 mb-8 text-lg">
            50 free credits. No credit card required. Start generating AI videos
            in under a minute.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="text-base px-10">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-white">
              G
            </div>
            <span className="text-sm font-semibold text-zinc-400">
              Genesis Studio
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Genesis Studio. From Nothing,
            Create Everything.
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <Link href="/pricing" className="hover:text-zinc-300">Pricing</Link>
            <span className="hover:text-zinc-300 cursor-pointer">Docs</span>
            <span className="hover:text-zinc-300 cursor-pointer">API</span>
            <span className="hover:text-zinc-300 cursor-pointer">Twitter</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
