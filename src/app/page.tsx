"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MotionSection,
  StaggerGroup,
  StaggerItem,
  AnimatedCounter,
  Parallax,
  GlowCard,
  motion,
} from "@/components/ui/motion";
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
  Play,
  Users,
  Globe,
  Clock,
  ChevronRight,
  Smartphone,
  Music,
  Terminal,
} from "lucide-react";

const models = [
  { name: "Wan 2.2", tier: "FLAGSHIP", param: "A14B", desc: "Best cinematic quality. Complex motion.", color: "text-violet-400", bg: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/20", time: "~300s" },
  { name: "HunyuanVideo 1.5", tier: "WORKHORSE", param: "13B", desc: "Best efficiency/quality ratio.", color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/20", time: "~180s" },
  { name: "LTX-Video", tier: "SPEED KING", param: "13B", desc: "Fastest — real-time on H100.", color: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20", time: "~30s" },
  { name: "Mochi 1", tier: "REALISM", param: "10B", desc: "Best prompt adherence. Photorealistic.", color: "text-pink-400", bg: "from-pink-500/20 to-pink-500/5", border: "border-pink-500/20", time: "~180s" },
  { name: "CogVideoX-5B", tier: "BUDGET", param: "5B", desc: "Quick previews. Low cost.", color: "text-cyan-400", bg: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/20", time: "~90s" },
];

const features = [
  { icon: Film, title: "Text-to-Video", desc: "Describe anything, watch it come to life. Multiple quality tiers from draft to cinema-grade.", accent: "violet" },
  { icon: ImageIcon, title: "Image-to-Video", desc: "Animate any still image. Upload a photo and add motion, depth, and life.", accent: "emerald" },
  { icon: Smartphone, title: "Reels & Shorts", desc: "Vertical 9:16 video optimized for TikTok, Instagram Reels, and YouTube Shorts.", accent: "cyan" },
  { icon: Music, title: "Background Audio", desc: "Built-in royalty-free music library. Cinematic, electronic, lo-fi, and more.", accent: "pink" },
  { icon: RefreshCw, title: "Draft then Refine", desc: "Fast 3-second preview, then HD render. Saves 70% on credits.", accent: "amber" },
  { icon: Terminal, title: "API from Day 1", desc: "REST API on every plan. Build AI video into your app. No gatekeeping.", accent: "violet" },
];

const accentColors: Record<string, { icon: string; bg: string; border: string }> = {
  violet: { icon: "text-violet-400", bg: "bg-violet-500/10", border: "group-hover:border-violet-500/30" },
  emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10", border: "group-hover:border-emerald-500/30" },
  cyan: { icon: "text-cyan-400", bg: "bg-cyan-500/10", border: "group-hover:border-cyan-500/30" },
  pink: { icon: "text-pink-400", bg: "bg-pink-500/10", border: "group-hover:border-pink-500/30" },
  amber: { icon: "text-amber-400", bg: "bg-amber-500/10", border: "group-hover:border-amber-500/30" },
};

const heroStats = [
  { value: 6, label: "AI Models", icon: Star },
  { value: 70, label: "Cost Savings", icon: Zap, suffix: "%" },
  { value: 0, label: "Hardware Cost", icon: Shield, prefix: "$" },
];

const competitors = [
  { name: "Runway", issue: "$12-$95/mo, credits expire monthly" },
  { name: "Kling", issue: "Credits expire mid-subscription, high failure rates" },
  { name: "Pika", issue: "Limited model selection, basic API access" },
  { name: "Sora", issue: "Discontinued. $15M/day burn rate." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] relative">
      <Navbar />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 overflow-hidden">
        {/* Atmospheric layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-glow-top" />
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="violet" className="mb-6 px-4 py-1.5 text-xs">
              <Sparkles className="w-3 h-3 mr-1.5" /> Open-Source AI Video Platform
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="gradient-text-hero block">From Nothing,</span>
            <span className="gradient-text block mt-1">Create Everything</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Hollywood-grade AI video generation powered by open-source models
            and serverless GPUs. <span className="text-zinc-200 font-medium">70-90% cheaper.</span> Credits never expire.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/sign-up">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="text-base px-8 h-12 shadow-xl shadow-violet-600/25">
                  Start Creating Free <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                View Pricing
              </Button>
            </Link>
          </motion.div>

          {/* Stats row with animated counters */}
          <motion.div
            className="flex items-center justify-center gap-6 sm:gap-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {heroStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <stat.icon className="w-4 h-4 text-violet-400 opacity-50" />
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    className="text-2xl sm:text-3xl font-bold text-white"
                  />
                </div>
                <div className="text-xs sm:text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Globe className="w-4 h-4 text-violet-400 opacity-50" />
                <div className="text-2xl sm:text-3xl font-bold text-white">24/7</div>
              </div>
              <div className="text-xs sm:text-sm text-zinc-500">API Access</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== VIDEO SHOWCASE ===== */}
      <MotionSection className="py-4 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-white/[0.06] bg-[#111118]/60 backdrop-blur-sm overflow-hidden shadow-2xl shadow-violet-600/5">
            <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-violet-900/20 via-[#111118] to-cyan-900/10 relative">
              <div className="absolute inset-0 bg-grid opacity-20" />
              <div className="relative text-center p-8">
                <motion.div
                  className="w-20 h-20 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4"
                  animate={{ boxShadow: ["0 0 20px rgba(139, 92, 246, 0.1)", "0 0 60px rgba(139, 92, 246, 0.3)", "0 0 20px rgba(139, 92, 246, 0.1)"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Play className="w-8 h-8 text-violet-400 ml-1" />
                </motion.div>
                <p className="text-zinc-400 text-sm">AI-generated video showcase</p>
                <p className="text-zinc-600 text-xs mt-1">Generate your first video to see it here</p>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* ===== SOCIAL PROOF ===== */}
      <MotionSection className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-zinc-600">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">500+ creators</span>
            </div>
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4" />
              <span className="text-sm">10,000+ videos generated</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">99.9% uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Failed gens = full refund</span>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* ===== WHY GENESIS ===== */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <MotionSection className="text-center mb-16">
            <Badge variant="red" className="mb-4">The Problem</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              The Competition is <span className="text-red-400">Broken</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto leading-relaxed">
              The $2.4B AI video market is wide open. Here&apos;s why we&apos;re different.
            </p>
          </MotionSection>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {competitors.map((c) => (
              <StaggerItem key={c.name}>
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] group hover:border-red-500/20 transition-colors">
                  <span className="text-red-400/60 mt-0.5 text-sm">&#x2715;</span>
                  <div>
                    <span className="font-semibold text-red-300/80">{c.name}</span>
                    <span className="text-zinc-500 ml-1">{c.issue}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <MotionSection delay={0.2}>
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/[0.06] to-cyan-500/[0.03] border border-emerald-500/20 text-center card-glow">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-lg font-bold text-emerald-300">Genesis Studio</span>
              </div>
              <p className="text-zinc-400 max-w-lg mx-auto">
                Open models, transparent pricing, credits never expire, API from
                day one, failed generations = full refund.
              </p>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <MotionSection className="text-center mb-16">
            <Badge variant="violet" className="mb-4">Capabilities</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Everything You Need to <span className="gradient-text">Create</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              From text prompts to social-ready reels, with built-in audio and an API for developers.
            </p>
          </MotionSection>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => {
              const colors = accentColors[f.accent];
              return (
                <StaggerItem key={f.title}>
                  <GlowCard
                    className={`group p-6 rounded-xl border border-white/[0.06] bg-[#111118]/50 hover:bg-[#111118]/80 transition-all duration-300 ${colors.border}`}
                  >
                    <motion.div
                      className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-4 transition-colors`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <f.icon className={`w-5 h-5 ${colors.icon}`} />
                    </motion.div>
                    <h3 className="text-base font-semibold text-zinc-100 mb-2">{f.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                  </GlowCard>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ===== MODELS ===== */}
      <section id="models" className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <MotionSection className="text-center mb-16">
            <Badge variant="violet" className="mb-4">Model Arsenal</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">Open-Source</span> Power
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              All models are open-source, free to use, and running on serverless GPUs. No licensing fees.
            </p>
          </MotionSection>

          <div className="space-y-3">
            {models.map((m, index) => (
              <MotionSection key={m.name} delay={index * 0.06}>
                <motion.div
                  className={`group flex items-center gap-4 p-4 rounded-xl border ${m.border} bg-gradient-to-r ${m.bg} transition-all duration-300`}
                  whileHover={{ scale: 1.01, x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Star className={`w-5 h-5 ${m.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-zinc-100">{m.name}</span>
                      <Badge variant="violet" className="text-[10px]">{m.tier}</Badge>
                      <span className="text-xs text-zinc-600">{m.param}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{m.desc}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className={`text-sm font-medium ${m.color}`}>{m.time}</div>
                    <div className="text-xs text-zinc-600">avg generation</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0 group-hover:text-zinc-400 transition-colors" />
                </motion.div>
              </MotionSection>
            ))}
          </div>

          <MotionSection delay={0.3} className="mt-8">
            <div className="p-5 rounded-xl bg-gradient-to-r from-amber-500/[0.06] to-amber-500/[0.02] border border-amber-500/15 text-center">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">PRO TIP</span>
              </div>
              <p className="text-sm text-zinc-400">
                Use &ldquo;Draft then Refine&rdquo; — generate fast previews with LTX/CogVideo, then render final quality with Wan 2.2.
              </p>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ===== API SECTION ===== */}
      <section id="api" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <MotionSection>
              <Badge variant="cyan" className="mb-4">Developer API</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Build with <span className="gradient-text">Genesis</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                REST API on every plan, including free. Generate videos programmatically,
                poll for status, and integrate AI video into your product.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  "API key authentication with Bearer tokens",
                  "Webhook callbacks for job completion",
                  "All models accessible via single endpoint",
                  "Automatic refunds on failed generations",
                ].map((item, i) => (
                  <motion.div
                    key={item}
                    className="flex items-center gap-2 text-sm"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-zinc-300">{item}</span>
                  </motion.div>
                ))}
              </div>
              <Link href="/sign-up">
                <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                  <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                    Get API Key <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              </Link>
            </MotionSection>

            {/* Code block */}
            <MotionSection delay={0.15}>
              <div className="rounded-xl border border-white/[0.06] bg-[#0D0D14] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                  </div>
                  <span className="text-xs text-zinc-600 ml-2">generate.sh</span>
                </div>
                <div className="p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-zinc-500">{"# Generate a video with one API call"}</div>
                  <div className="text-cyan-400 mt-2">curl <span className="text-zinc-300">-X POST \</span></div>
                  <div className="text-zinc-300 pl-4">https://api.genesisstudio.ai/api/v1/generate \</div>
                  <div className="text-zinc-300 pl-4">-H <span className="text-amber-300">{'"Authorization: Bearer gs_..."'}</span> \</div>
                  <div className="text-zinc-300 pl-4">-H <span className="text-amber-300">{'"Content-Type: application/json"'}</span> \</div>
                  <div className="text-zinc-300 pl-4">-d <span className="text-emerald-300">{"'{\"prompt\": \"A sunset over the ocean\",'"}</span></div>
                  <div className="text-emerald-300 pl-8">{'     "model": "ltx-video",'}</div>
                  <div className="text-emerald-300 pl-8">{"     \"resolution\": \"720p\"\\}'"}</div>
                </div>
              </div>
            </MotionSection>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-glow-center" />
        <div className="absolute inset-0 bg-grid opacity-20" />

        <MotionSection className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            Ready to <span className="gradient-text">Create</span>?
          </h2>
          <p className="text-zinc-400 mb-8 text-lg max-w-xl mx-auto">
            50 free credits. No credit card required. Start generating AI videos
            in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="text-base px-10 h-12 shadow-xl shadow-violet-600/25">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" size="lg" className="text-base px-10 h-12">
                Compare Plans
              </Button>
            </Link>
          </div>
        </MotionSection>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.06] py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-8">
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white">
                  G
                </div>
                <span className="text-sm font-bold gradient-text">Genesis Studio</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                From Nothing, Create Everything.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Product</h4>
              <div className="space-y-2">
                <Link href="#features" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</Link>
                <Link href="#models" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Models</Link>
                <Link href="/pricing" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</Link>
                <Link href="#api" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">API</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Resources</h4>
              <div className="space-y-2">
                <span className="block text-sm text-zinc-500">Documentation</span>
                <span className="block text-sm text-zinc-500">API Reference</span>
                <span className="block text-sm text-zinc-500">Status</span>
                <span className="block text-sm text-zinc-500">Changelog</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Company</h4>
              <div className="space-y-2">
                <span className="block text-sm text-zinc-500">About</span>
                <span className="block text-sm text-zinc-500">Twitter</span>
                <span className="block text-sm text-zinc-500">Discord</span>
                <span className="block text-sm text-zinc-500">GitHub</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} Genesis Studio. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs text-zinc-600">
              <span className="hover:text-zinc-400 cursor-pointer">Privacy</span>
              <span className="hover:text-zinc-400 cursor-pointer">Terms</span>
              <span className="hover:text-zinc-400 cursor-pointer">Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
