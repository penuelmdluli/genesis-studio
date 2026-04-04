"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MotionSection,
  StaggerGroup,
  StaggerItem,
  AnimatedCounter,
  GlowCard,
  Parallax,
  motion,
} from "@/components/ui/motion";
import {
  Sparkles,
  Zap,
  Shield,
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
  Volume2,
  VolumeX,
  CreditCard,
  Brain,
  Layers,
  Monitor,
  X,
  Pause,
  GitCompare,
  MessageSquare,
  Heart,
  Flag,
} from "lucide-react";
import { PLANS } from "@/lib/constants";

// ============================================
// CINEMATIC VIDEO ASSETS — Royalty-free from Mixkit
// ============================================

const heroVideos = [
  "https://assets.mixkit.co/videos/4880/4880-720.mp4",      // Ocean sunset cinematic
  "https://assets.mixkit.co/videos/44688/44688-720.mp4",     // City night aerial
  "https://assets.mixkit.co/videos/48107/48107-720.mp4",     // Forest light rays
  "https://assets.mixkit.co/videos/34563/34563-720.mp4",     // Abstract particles
  "https://assets.mixkit.co/videos/5016/5016-720.mp4",       // Beach waves golden
];

const showcaseVideos = [
  {
    url: "https://assets.mixkit.co/videos/4880/4880-720.mp4",
    prompt: "Ocean waves crashing on a rocky coastline at sunset, cinematic 4K",
    model: "Wan 2.2",
    resolution: "1080p",
    duration: "5s",
    label: "Cinematic",
    color: "violet" as const,
  },
  {
    url: "https://assets.mixkit.co/videos/44688/44688-720.mp4",
    prompt: "Aerial view of a busy city avenue at night, neon lights, timelapse",
    model: "HunyuanVideo",
    resolution: "1080p",
    duration: "5s",
    label: "Urban",
    color: "cyan" as const,
  },
  {
    url: "https://assets.mixkit.co/videos/48107/48107-720.mp4",
    prompt: "Ethereal light rays filtering through ancient forest trees, dreamlike",
    model: "Mochi 1",
    resolution: "720p",
    duration: "5s",
    label: "Nature",
    color: "emerald" as const,
  },
  {
    url: "https://assets.mixkit.co/videos/5016/5016-720.mp4",
    prompt: "Serene beach waves rolling onto golden sand, peaceful morning light",
    model: "LTX-Video",
    resolution: "720p",
    duration: "3s",
    label: "Fast",
    color: "amber" as const,
  },
];

const motionControlVideos = {
  reference: "https://assets.mixkit.co/videos/2213/2213-720.mp4",
  output: "https://assets.mixkit.co/videos/4880/4880-720.mp4",
};

const marqueeVideos = [
  "https://assets.mixkit.co/videos/4880/4880-720.mp4",
  "https://assets.mixkit.co/videos/44688/44688-720.mp4",
  "https://assets.mixkit.co/videos/48107/48107-720.mp4",
  "https://assets.mixkit.co/videos/5016/5016-720.mp4",
  "https://assets.mixkit.co/videos/2213/2213-720.mp4",
  "https://assets.mixkit.co/videos/34563/34563-720.mp4",
];

const modelShowcase = [
  { name: "Wan 2.2", tier: "FLAGSHIP", param: "A14B", desc: "Best cinematic quality. Complex motion.", color: "text-violet-400", bg: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/20", time: "~300s", video: "https://assets.mixkit.co/videos/4880/4880-720.mp4" },
  { name: "HunyuanVideo 1.5", tier: "WORKHORSE", param: "13B", desc: "Best efficiency/quality ratio.", color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/20", time: "~180s", video: "https://assets.mixkit.co/videos/48107/48107-720.mp4" },
  { name: "LTX-Video", tier: "SPEED KING", param: "13B", desc: "Fastest — real-time on H100.", color: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20", time: "~30s", video: "https://assets.mixkit.co/videos/5016/5016-720.mp4" },
  { name: "Mochi 1", tier: "REALISM", param: "10B", desc: "Best prompt adherence. Photorealistic.", color: "text-pink-400", bg: "from-pink-500/20 to-pink-500/5", border: "border-pink-500/20", time: "~180s", video: "https://assets.mixkit.co/videos/44688/44688-720.mp4" },
  { name: "CogVideoX-5B", tier: "BUDGET", param: "5B", desc: "Quick previews. Low cost.", color: "text-cyan-400", bg: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/20", time: "~90s", video: "https://assets.mixkit.co/videos/2213/2213-720.mp4" },
];

const competitors: Array<Record<string, string>> = [
  { name: "Runway", credits: "Expire monthly", gCredits: "Never expire", price: "$12-$95/mo", gPrice: "From R0/mo", api: "Paid plans only", gApi: "Every plan", models: "Proprietary", gModels: "Open-source" },
  { name: "Kling", credits: "Expire mid-sub", gCredits: "Never expire", price: "High failure rate", gPrice: "Auto refund", api: "Limited", gApi: "Full REST API", models: "Proprietary", gModels: "6 open models" },
  { name: "Pika", credits: "Limited", gCredits: "Buy packs anytime", price: "Basic only", gPrice: "4K output", api: "Basic", gApi: "Webhooks + SDK", models: "1 model", gModels: "6 models" },
];

const brainSteps = [
  { label: "Concept", text: "A 2-minute short film about a robot discovering emotions in a post-apocalyptic world..." },
  { label: "Shot List", items: ["Wide establishing shot — ruined cityscape, dawn", "Close-up — robot hand touching a flower", "Medium — robot looking at old photographs", "POV — robot's vision glitching with memories", "Wide — robot walking into sunrise, hopeful"] },
  { label: "Generating", scenes: [{ name: "Scene 1: Ruined City", progress: 100 }, { name: "Scene 2: The Flower", progress: 87 }, { name: "Scene 3: Old Photos", progress: 62 }, { name: "Scene 4: Memory Glitch", progress: 34 }, { name: "Scene 5: Sunrise Walk", progress: 12 }] },
  { label: "Complete", text: "5 scenes rendered. Audio mixed. Timeline assembled. Ready for export." },
];

const badgeColorMap: Record<string, "violet" | "cyan" | "emerald" | "amber"> = {
  violet: "violet",
  cyan: "cyan",
  emerald: "emerald",
  amber: "amber",
};

// ============================================
// LANDING PAGE COMPONENT
// ============================================

export default function LandingPage() {
  // Hero video crossfade state
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroFading, setHeroFading] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Showcase state
  const [activeShowcase, setActiveShowcase] = useState(0);
  const showcaseVideoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Brain demo state
  const [brainStep, setBrainStep] = useState(0);
  const [brainTyped, setBrainTyped] = useState("");

  // Motion control play state
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const outVideoRef = useRef<HTMLVideoElement>(null);

  // Model hover state
  const [hoveredModel, setHoveredModel] = useState<number | null>(null);

  // ---- Hero video crossfade cycle ----
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroFading(true);
      setTimeout(() => {
        setHeroIndex((prev) => (prev + 1) % heroVideos.length);
        setHeroFading(false);
      }, 1200);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // ---- Showcase auto-cycle ----
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveShowcase((prev) => (prev + 1) % showcaseVideos.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showcaseVideoRef.current) {
      showcaseVideoRef.current.load();
      showcaseVideoRef.current.play().catch(() => {});
    }
  }, [activeShowcase]);

  // ---- Brain demo infinite loop ----
  useEffect(() => {
    const stepDurations = [4000, 4000, 5000, 3000];
    const timer = setTimeout(() => {
      setBrainStep((prev) => (prev + 1) % brainSteps.length);
    }, stepDurations[brainStep]);
    return () => clearTimeout(timer);
  }, [brainStep]);

  // Brain typewriter effect
  useEffect(() => {
    if (brainStep === 0) {
      const text = brainSteps[0].text ?? "";
      let i = 0;
      setBrainTyped("");
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          setBrainTyped(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(typeInterval);
        }
      }, 30);
      return () => clearInterval(typeInterval);
    }
  }, [brainStep]);

  // Sync motion control videos
  const syncMotionVideos = useCallback(() => {
    if (refVideoRef.current && outVideoRef.current) {
      outVideoRef.current.currentTime = refVideoRef.current.currentTime;
    }
  }, []);

  const current = showcaseVideos[activeShowcase];

  return (
    <div className="min-h-screen bg-[#0A0A0F] relative overflow-x-hidden">
      <Navbar />

      {/* ============================================ */}
      {/* SECTION 1: CINEMATIC FULL-SCREEN HERO        */}
      {/* ============================================ */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Crossfading background videos with Ken Burns — HIGH VISIBILITY */}
        <div className="absolute inset-0">
          {heroVideos.map((src, i) => (
            <video
              key={src}
              autoPlay
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ${
                i === heroIndex ? (heroFading ? "opacity-0" : "opacity-40") : "opacity-0"
              }`}
              style={{
                animation: i === heroIndex ? "kenBurns 12s ease-in-out infinite alternate" : "none",
              }}
            >
              <source src={src} type="video/mp4" />
            </video>
          ))}
          {/* Gradient overlays — dark enough for text, light enough for video to shine */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/80 via-[#0A0A0F]/40 to-[#0A0A0F]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/20 via-transparent to-[#0A0A0F]/20" />
        </div>

        {/* Atmospheric glow — more vibrant */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-glow-top opacity-40" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-violet-600/[0.12] rounded-full blur-[180px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/[0.08] rounded-full blur-[140px]" />
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-pink-500/[0.06] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Badge variant="violet" className="mb-8 px-5 py-2 text-sm">
              <Sparkles className="w-3.5 h-3.5 mr-2" /> Open-Source AI Video Platform
            </Badge>
          </motion.div>

          <motion.h1
            className="text-6xl sm:text-8xl lg:text-9xl font-extrabold tracking-tighter mb-8 leading-[0.9]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <span className="gradient-text-hero block">From Nothing,</span>
            <span className="gradient-text block mt-2">Create Everything</span>
          </motion.h1>

          <motion.p
            className="text-xl sm:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Hollywood-grade AI video generation powered by open-source models
            and serverless GPUs. <span className="text-zinc-200 font-semibold">70-90% cheaper.</span>{" "}
            Credits never expire.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <Link href="/sign-up">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="text-lg px-10 h-14 shadow-2xl shadow-violet-600/30">
                  Start Creating Free <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <Link href="#showcase">
              <Button variant="outline" size="lg" className="text-lg px-10 h-14 border-white/10 hover:bg-white/[0.04]">
                <Play className="w-4 h-4" /> Watch Demo
              </Button>
            </Link>
          </motion.div>

          {/* Hero stats row */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {[
              { value: 6, label: "AI Models", icon: Star },
              { value: 70, label: "Cost Savings", icon: Zap, suffix: "%" },
              { value: 0, label: "Hardware Cost", icon: Shield, prefix: "$" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <stat.icon className="w-4 h-4 text-violet-400/60" />
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    className="text-3xl sm:text-4xl font-bold text-white"
                  />
                </div>
                <div className="text-xs sm:text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Globe className="w-4 h-4 text-violet-400/60" />
                <div className="text-3xl sm:text-4xl font-bold text-white">24/7</div>
              </div>
              <div className="text-xs sm:text-sm text-zinc-500">API Access</div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: "WATCH AI CREATE" SHOWCASE         */}
      {/* ============================================ */}
      <section id="showcase" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="max-w-7xl mx-auto relative z-10">
          <MotionSection className="text-center mb-12">
            <Badge variant="violet" className="mb-4">Live Showcase</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Watch AI <span className="gradient-text">Create</span> in Real-Time
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Every video below was generated by AI. Click to explore different models and styles.
            </p>
          </MotionSection>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main monitor frame */}
            <div className="lg:col-span-2">
              <motion.div
                className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0D0D14] shadow-2xl shadow-violet-500/[0.08]"
                animate={{
                  boxShadow: [
                    "0 0 40px rgba(139, 92, 246, 0.06)",
                    "0 0 80px rgba(139, 92, 246, 0.12)",
                    "0 0 40px rgba(139, 92, 246, 0.06)",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Monitor top bar */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent z-20" />

                {/* Video viewport */}
                <div className="aspect-video relative">
                  <video
                    ref={showcaseVideoRef}
                    autoPlay
                    muted={muted}
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    key={current.url}
                  >
                    <source src={current.url} type="video/mp4" />
                  </video>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Top bar — traffic lights + LIVE indicator */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono ml-1">Genesis Studio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMuted(!muted)}
                        className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors"
                      >
                        {muted ? <VolumeX className="w-3 h-3 text-zinc-400" /> : <Volume2 className="w-3 h-3 text-violet-400" />}
                      </button>
                      <motion.div
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </motion.div>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-3 left-3 right-3 z-10">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-zinc-300 font-medium mb-1.5 max-w-md leading-relaxed">
                          &ldquo;{current.prompt}&rdquo;
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeColorMap[current.color] || "violet"} className="text-[10px]">
                            {current.model}
                          </Badge>
                          <span className="text-[10px] text-zinc-500">{current.resolution} &middot; {current.duration}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.05] z-10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-violet-600 to-cyan-500"
                      key={activeShowcase}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 8, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Playlist sidebar */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1">Generated Samples</p>
              {showcaseVideos.map((video, index) => (
                <motion.button
                  key={index}
                  onClick={() => setActiveShowcase(index)}
                  className={`w-full flex gap-3 p-3 rounded-xl border transition-all duration-300 text-left ${
                    activeShowcase === index
                      ? "border-violet-500/30 bg-violet-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                  }`}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0 relative bg-[#0D0D14]">
                    <video src={video.url} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                    {activeShowcase === index && (
                      <div className="absolute inset-0 border-2 border-violet-500 rounded-lg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant={badgeColorMap[video.color] || "violet"} className="text-[9px]">
                        {video.label}
                      </Badge>
                      <span className="text-[10px] text-zinc-600">{video.model}</span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate leading-relaxed">{video.prompt}</p>
                  </div>
                </motion.button>
              ))}

              {/* Reel format preview */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold px-1 mb-3">Reel Format</p>
                <div className="relative w-24 mx-auto rounded-xl overflow-hidden border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
                  <div className="aspect-[9/16] relative">
                    <video
                      src="https://assets.mixkit.co/videos/2213/2213-720.mp4"
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5">
                      <Badge variant="cyan" className="text-[8px]">
                        <Smartphone className="w-2.5 h-2.5 mr-0.5" /> 9:16
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-scrolling marquee strip */}
          <div className="mt-12 overflow-hidden">
            <div className="flex gap-4 animate-scroll-left">
              {[...marqueeVideos, ...marqueeVideos, ...marqueeVideos].map((src, i) => (
                <div
                  key={i}
                  className="shrink-0 w-56 rounded-xl overflow-hidden border border-white/[0.06] bg-[#111118]/60 group"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <video
                      src={src}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white/80" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 3: MOTION CONTROL SPLIT-SCREEN        */}
      {/* ============================================ */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          >
            <source src="https://assets.mixkit.co/videos/34563/34563-720.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/90 via-[#0A0A0F]/60 to-[#0A0A0F]/90" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <MotionSection className="text-center mb-12">
            <Badge variant="cyan" className="mb-4">
              <Layers className="w-3 h-3 mr-1" /> Motion Control
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Reference In. <span className="gradient-text">AI Video Out.</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Upload a reference video or motion capture. The AI transfers the motion to your scene with perfect synchronization.
            </p>
          </MotionSection>

          <MotionSection delay={0.15}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Reference side */}
              <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#0D0D14]">
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="cyan" className="text-[10px] backdrop-blur-sm">
                    <GitCompare className="w-3 h-3 mr-1" /> Reference Input
                  </Badge>
                </div>
                <div className="aspect-video">
                  <video
                    ref={refVideoRef}
                    autoPlay muted loop playsInline
                    onTimeUpdate={syncMotionVideos}
                    className="w-full h-full object-cover"
                  >
                    <source src={motionControlVideos.reference} type="video/mp4" />
                  </video>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500/20">
                  <div className="h-full bg-cyan-500/60 w-full" />
                </div>
              </div>

              {/* AI output side */}
              <div className="relative rounded-2xl overflow-hidden border border-violet-500/20 bg-[#0D0D14]">
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="violet" className="text-[10px] backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 mr-1" /> AI Output
                  </Badge>
                </div>
                <div className="aspect-video">
                  <video
                    ref={outVideoRef}
                    autoPlay muted loop playsInline
                    className="w-full h-full object-cover"
                  >
                    <source src={motionControlVideos.output} type="video/mp4" />
                  </video>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-500/20">
                  <motion.div
                    className="h-full bg-violet-500/60"
                    initial={{ width: "0%" }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Sync indicator */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/20" />
              <motion.div
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-zinc-400">Frame-perfect sync</span>
              </motion.div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-violet-500/20" />
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 4: GENESIS BRAIN ANIMATED DEMO        */}
      {/* ============================================ */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <MotionSection className="text-center mb-12">
            <Badge variant="violet" className="mb-4">
              <Brain className="w-3 h-3 mr-1" /> Genesis Brain
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              One Prompt. <span className="gradient-text">Full Production.</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Describe your vision in natural language. Brain plans scenes, generates each one, mixes audio, and delivers a complete video.
            </p>
          </MotionSection>

          <MotionSection delay={0.15}>
            <div className="relative rounded-2xl overflow-hidden border border-violet-500/20 bg-[#0D0D14] shadow-2xl shadow-violet-500/[0.06]">
              {/* Terminal top bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                </div>
                <span className="text-xs text-zinc-500 ml-2 font-mono">Genesis Brain v2</span>
                <div className="flex-1" />
                {/* Step indicators */}
                <div className="flex items-center gap-1">
                  {brainSteps.map((s, i) => (
                    <div
                      key={s.label}
                      className={`w-2 h-2 rounded-full transition-all duration-500 ${
                        i === brainStep ? "bg-violet-500 scale-125" : i < brainStep ? "bg-violet-500/40" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Brain content area */}
              <div className="p-6 sm:p-8 min-h-[320px]">
                {/* Step 0: Typewriter concept input */}
                {brainStep === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-violet-300">Concept Input</span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-sm text-zinc-300 font-mono leading-relaxed">
                        {brainTyped}
                        <motion.span
                          className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-middle"
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Shot list generation */}
                {brainStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Film className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-300">Shot List Generated</span>
                    </div>
                    {brainSteps[1].items?.map((item, i) => (
                      <motion.div
                        key={item}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                      >
                        <span className="text-xs font-mono text-violet-400 mt-0.5 shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm text-zinc-400">{item}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Step 2: Generation progress bars */}
                {brainStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-300">Rendering Scenes</span>
                    </div>
                    {brainSteps[2].scenes?.map((scene, i) => (
                      <div key={scene.name} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{scene.name}</span>
                          <span className="text-xs font-mono text-zinc-500">{scene.progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              scene.progress === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-violet-600 to-cyan-500"
                            }`}
                            initial={{ width: "0%" }}
                            animate={{ width: `${scene.progress}%` }}
                            transition={{ duration: 1.5, delay: i * 0.2, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Step 3: Complete */}
                {brainStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center py-8"
                  >
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <Check className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                    <p className="text-lg font-semibold text-emerald-300 mb-2">Production Complete</p>
                    <p className="text-sm text-zinc-500">{brainSteps[3].text}</p>
                    <Link href="/sign-up" className="mt-4">
                      <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                        Try Brain Studio <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 5: SOCIAL PROOF / GROWTH STORY        */}
      {/* ============================================ */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-[0.15]"
          >
            <source src="https://assets.mixkit.co/videos/44688/44688-720.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/90 via-[#0A0A0F]/70 to-[#0A0A0F]/90" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <MotionSection className="text-center mb-16">
            <Badge variant="emerald" className="mb-4">
              <Users className="w-3 h-3 mr-1" /> Community
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Growing <span className="gradient-text">Every Day</span>
            </h2>
          </MotionSection>

          {/* Stats grid */}
          <StaggerGroup className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
            {[
              { value: 51000, label: "Community Members", suffix: "+", color: "text-violet-400" },
              { value: 10000, label: "Videos Generated", suffix: "+", color: "text-emerald-400" },
              { value: 99, label: "Uptime", suffix: ".9%", color: "text-cyan-400" },
              { value: 6, label: "AI Models", suffix: "", color: "text-amber-400" },
            ].map((stat) => (
              <StaggerItem key={stat.label}>
                <GlowCard className="p-6 rounded-xl border border-white/[0.06] bg-[#111118]/50 text-center">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    className={`text-3xl sm:text-4xl font-bold ${stat.color}`}
                    duration={1.5}
                  />
                  <div className="text-xs text-zinc-500 mt-2">{stat.label}</div>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerGroup>

          {/* Founder quote */}
          <MotionSection delay={0.2}>
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.02] border border-violet-500/15 text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="violet" className="px-3">
                  <Heart className="w-3 h-3 mr-1" /> From the Founder
                </Badge>
              </div>
              <p className="text-lg sm:text-xl text-zinc-300 italic leading-relaxed max-w-2xl mx-auto mt-4 mb-4">
                &ldquo;We started Genesis Studio because AI video shouldn&apos;t be locked behind proprietary models
                and expiring credits. Open-source models, serverless GPUs, and transparent pricing — that&apos;s how
                you democratize creation.&rdquo;
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  G
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-zinc-200">Genesis Team</p>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Made in South Africa
                  </p>
                </div>
              </div>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 6: MODEL SHOWCASE WITH VIDEO CARDS    */}
      {/* ============================================ */}
      <section id="models" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.02] to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <MotionSection className="text-center mb-16">
            <Badge variant="violet" className="mb-4">Model Arsenal</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">Open-Source</span> Power
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              All models are open-source, free to use, and running on serverless GPUs. No licensing fees.
            </p>
          </MotionSection>

          {/* Video cards grid */}
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {modelShowcase.slice(0, 3).map((m, index) => (
              <StaggerItem key={m.name}>
                <motion.div
                  className={`group relative rounded-2xl overflow-hidden border ${m.border} bg-[#0D0D14] cursor-pointer`}
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.25 }}
                  onMouseEnter={() => setHoveredModel(index)}
                  onMouseLeave={() => setHoveredModel(null)}
                >
                  <div className="aspect-video relative overflow-hidden">
                    <video
                      src={m.video}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D14] via-[#0D0D14]/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <Badge variant={badgeColorMap[m.color.replace("text-", "").replace("-400", "")] || "violet"} className="text-[10px]">
                        {m.tier}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-100">{m.name}</span>
                      <span className="text-xs text-zinc-600">{m.param}</span>
                    </div>
                    <p className="text-sm text-zinc-400 mb-2">{m.desc}</p>
                    <div className={`text-xs font-medium ${m.color}`}>{m.time} avg generation</div>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          {/* Remaining models as rows */}
          <div className="space-y-3 mb-8">
            {modelShowcase.slice(3).map((m, index) => (
              <MotionSection key={m.name} delay={index * 0.06}>
                <motion.div
                  className={`group flex items-center gap-4 p-4 rounded-xl border ${m.border} bg-gradient-to-r ${m.bg} transition-all duration-300`}
                  whileHover={{ scale: 1.01, x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-[#0D0D14]">
                    <video src={m.video} muted loop playsInline autoPlay className="w-full h-full object-cover" />
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

          {/* Same-prompt comparison strip */}
          <MotionSection delay={0.2}>
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-4 text-center">
                Same Prompt — Different Models
              </p>
              <p className="text-sm text-zinc-400 text-center mb-6 italic">
                &ldquo;Cinematic sunset over the ocean, golden hour, 4K&rdquo;
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {modelShowcase.map((m) => (
                  <div key={m.name} className={`rounded-xl overflow-hidden border ${m.border}`}>
                    <div className="aspect-video relative">
                      <video src={m.video} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5">
                        <span className={`text-[9px] font-bold ${m.color}`}>{m.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 7: PRICING WITH VIDEO BACKGROUND      */}
      {/* ============================================ */}
      <section id="pricing" className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-[0.18]"
          >
            <source src="https://assets.mixkit.co/videos/48107/48107-720.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/90 via-[#0A0A0F]/65 to-[#0A0A0F]/90" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <MotionSection className="text-center mb-12">
            <Badge variant="violet" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Simple, <span className="gradient-text">Transparent</span> Pricing
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Credits never expire. No watermarks on paid plans. API access on every tier.
            </p>
          </MotionSection>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLANS.map((plan) => (
              <StaggerItem key={plan.id}>
                <div
                  className={`relative p-5 rounded-xl border transition-all duration-300 backdrop-blur-sm ${
                    plan.popular
                      ? "border-violet-500/30 bg-violet-500/[0.08] ring-1 ring-violet-500/20 shadow-lg shadow-violet-500/10"
                      : "border-white/[0.06] bg-[#111118]/70 hover:border-white/[0.1]"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge variant="violet" className="text-[10px] px-2.5 shadow-lg shadow-violet-500/20">
                        <Sparkles className="w-2.5 h-2.5 mr-1" /> BEST VALUE
                      </Badge>
                    </div>
                  )}
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 pt-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-zinc-100">
                      R{(plan.priceZAR ?? 0).toLocaleString()}
                    </span>
                    <span className="text-sm text-zinc-500">/mo</span>
                    {plan.price > 0 && (
                      <div className="text-xs text-zinc-600 mt-0.5">${plan.price}/mo</div>
                    )}
                  </div>
                  <div className="space-y-2 mb-5">
                    {plan.features.slice(0, 4).map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                        <span className="text-zinc-400">{feature}</span>
                      </div>
                    ))}
                    {plan.features.length > 4 && (
                      <div className="text-xs text-zinc-600">+{plan.features.length - 4} more</div>
                    )}
                  </div>
                  <Link href="/pricing" className="block">
                    <Button
                      variant={plan.popular ? "primary" : "secondary"}
                      className={`w-full text-xs ${plan.popular ? "shadow-lg shadow-violet-600/20" : ""}`}
                      size="sm"
                    >
                      {plan.id === "free" ? "Start Free" : `Get ${plan.name}`}
                    </Button>
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <MotionSection delay={0.2} className="text-center">
            <Link href="/pricing">
              <Button variant="outline" className="text-sm">
                <CreditCard className="w-4 h-4" /> View Full Pricing & Credit Packs <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 8: COMPETITOR COMPARISON TABLE         */}
      {/* ============================================ */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/[0.01] to-transparent" />
        <div className="max-w-4xl mx-auto relative z-10">
          <MotionSection className="text-center mb-12">
            <Badge variant="red" className="mb-4">The Difference</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Genesis vs <span className="text-red-400">The Rest</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              The $2.4B AI video market is wide open. Here&apos;s why creators choose Genesis.
            </p>
          </MotionSection>

          <MotionSection delay={0.15}>
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0D0D14]">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-px bg-white/[0.04]">
                <div className="p-4 bg-[#0D0D14]">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Feature</span>
                </div>
                {competitors.map((c) => (
                  <div key={c.name} className="p-4 bg-[#0D0D14] text-center">
                    <span className="text-xs text-red-400/60 font-semibold">{c.name}</span>
                  </div>
                ))}
                <div className="p-4 bg-violet-500/[0.06] text-center border-b border-violet-500/20">
                  <span className="text-xs font-bold gradient-text">Genesis</span>
                </div>
              </div>

              {/* Comparison rows */}
              {[
                { label: "Credits", key: "credits", gKey: "gCredits" },
                { label: "Pricing", key: "price", gKey: "gPrice" },
                { label: "API Access", key: "api", gKey: "gApi" },
                { label: "Models", key: "models", gKey: "gModels" },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-5 gap-px bg-white/[0.02] border-t border-white/[0.04]">
                  <div className="p-4 bg-[#0D0D14]">
                    <span className="text-xs text-zinc-300 font-medium">{row.label}</span>
                  </div>
                  {competitors.map((c) => (
                    <div key={c.name} className="p-4 bg-[#0D0D14] text-center">
                      <span className="text-xs text-zinc-500">{(c as Record<string, string>)[row.key]}</span>
                    </div>
                  ))}
                  <div className="p-4 bg-violet-500/[0.03] text-center">
                    <span className="text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" />
                      {(competitors[0] as Record<string, string>)[row.gKey]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 9: FINAL CTA — FULL-SCREEN VIDEO BG   */}
      {/* ============================================ */}
      <section className="relative py-32 sm:py-40 px-4 overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-[0.35]"
          >
            <source src="https://assets.mixkit.co/videos/4880/4880-720.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/70 via-[#0A0A0F]/40 to-[#0A0A0F]/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/20 via-transparent to-[#0A0A0F]/20" />
        </div>
        <div className="absolute inset-0 bg-glow-center" />

        <MotionSection className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-violet-500/30"
          >
            <Play className="w-8 h-8 text-white ml-1" />
          </motion.div>

          <h2 className="text-4xl sm:text-6xl font-bold mb-6">
            Ready to <span className="gradient-text">Create</span>?
          </h2>
          <p className="text-zinc-400 mb-10 text-xl max-w-xl mx-auto leading-relaxed">
            50 free credits. No credit card required. Start generating AI videos
            in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link href="/sign-up">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="text-lg px-12 h-14 shadow-2xl shadow-violet-600/30">
                  Start Creating Free <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" size="lg" className="text-lg px-10 h-14">
                Compare Plans
              </Button>
            </Link>
          </div>

          <motion.div
            className="mt-8 flex items-center justify-center gap-6 text-sm text-zinc-500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> 50 free credits</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Credits never expire</span>
          </motion.div>
        </MotionSection>
      </section>

      {/* ============================================ */}
      {/* SECTION 10: ENHANCED FOOTER                    */}
      {/* ============================================ */}
      <footer className="border-t border-white/[0.06] py-16 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-violet-600/20">
                  G
                </div>
                <span className="text-lg font-bold gradient-text">Genesis Studio</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed mb-4 max-w-xs">
                From Nothing, Create Everything. Open-source AI video generation for everyone.
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Flag className="w-3.5 h-3.5 text-emerald-500" />
                <span>Proudly Made in South Africa</span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Product</h4>
              <div className="space-y-2.5">
                <Link href="#features" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</Link>
                <Link href="#models" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Models</Link>
                <Link href="/pricing" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</Link>
                <Link href="#api" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">API</Link>
                <Link href="/brain" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Brain className="w-3.5 h-3.5" /> Brain Studio
                  <Badge variant="violet" className="text-[8px] py-0 px-1.5">NEW</Badge>
                </Link>
                <Link href="/motion-control" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Layers className="w-3.5 h-3.5" /> Motion Control
                </Link>
              </div>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Resources</h4>
              <div className="space-y-2.5">
                <span className="block text-sm text-zinc-500">Documentation</span>
                <span className="block text-sm text-zinc-500">API Reference</span>
                <span className="block text-sm text-zinc-500">Status</span>
                <span className="block text-sm text-zinc-500">Changelog</span>
              </div>
            </div>

            {/* Community */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Community</h4>
              <div className="space-y-2.5">
                <span className="block text-sm text-zinc-500">Discord</span>
                <span className="block text-sm text-zinc-500">Twitter / X</span>
                <span className="block text-sm text-zinc-500">GitHub</span>
                <span className="block text-sm text-zinc-500">YouTube</span>
                <span className="block text-sm text-zinc-500">About</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} Genesis Studio. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs text-zinc-600">
              <span className="hover:text-zinc-400 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-zinc-400 cursor-pointer transition-colors">Terms</span>
              <span className="hover:text-zinc-400 cursor-pointer transition-colors">Cookies</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Ken Burns keyframe animation */}
      <style jsx global>{`
        @keyframes kenBurns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -1%); }
        }
      `}</style>
    </div>
  );
}
