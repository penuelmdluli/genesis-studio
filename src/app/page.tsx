"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExploreVideoCard,
  type ExploreVideo,
} from "@/components/explore/video-card";
import { ShareModal } from "@/components/explore/share-modal";
import { RecreateModal } from "@/components/explore/recreate-modal";
import { VideoViewerModal } from "@/components/explore/video-viewer-modal";
import { HeroVideo } from "@/components/hero-video";
import {
  MotionSection,
  StaggerGroup,
  StaggerItem,
  AnimatedCounter,
  GlowCard,
  motion,
} from "@/components/ui/motion";
import {
  Sparkles,
  Film,
  Share2,
  ArrowRight,
  Check,
  Play,
  ChevronDown,
  Volume2,
  Brain,
  Flame,
  Clock,
  Zap,
} from "lucide-react";
import { PLANS, CREDIT_PACKS } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-events";
import { AppSchema, FAQSchema } from "@/components/structured-data";

// No hardcoded videos — everything pulled from API/database

// ============================================
// FILTER TABS
// ============================================

type FeedTab = "trending" | "latest" | "audio";

const feedTabs: { id: FeedTab; label: string; icon: typeof Flame }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "latest", label: "Latest", icon: Clock },
  { id: "audio", label: "With Audio", icon: Volume2 },
];

// ============================================
// HOW IT WORKS STEPS
// ============================================

const howItWorksSteps = [
  {
    num: "1",
    icon: Sparkles,
    title: "Describe your vision",
    description: "Type a scene, upload a photo, or paste a reference video",
  },
  {
    num: "2",
    icon: Film,
    title: "AI brings it to life",
    description: "10+ models compete to render the best result in seconds",
  },
  {
    num: "3",
    icon: Share2,
    title: "Post it everywhere",
    description: "Download HD, share to TikTok, Instagram, WhatsApp instantly",
  },
];

// ============================================
// CAPABILITIES
// ============================================

const capabilities = [
  {
    icon: Zap,
    title: "Mimic Studio",
    description: "Upload any character photo + a dance video. AI makes your character perform the moves. Viral content in minutes.",
    models: [],
    badge: "NEW",
  },
  {
    icon: Brain,
    title: "Brain Studio",
    description: "Type one concept, get a full short film with voiceover, music, captions, and transitions. AI directs everything.",
    models: [],
    badge: "HOT",
  },
  {
    icon: Volume2,
    title: "Native Audio",
    description: "Real dialogue, sound effects, and lip sync generated in the video. No editing or post-production needed.",
    models: [],
  },
  {
    icon: Film,
    title: "10+ AI Models",
    description: "From lightning-fast drafts to Hollywood-grade output. Pick the right model for your content, all in one place.",
    models: [],
  },
];

// ============================================
// LANDING PAGE
// ============================================

export default function LandingPage() {
  // Real platform stats
  const [stats, setStats] = useState<{ totalVideos: number; totalUsers: number; videosToday: number } | null>(null);

  // Community feed
  const [feedTab, setFeedTab] = useState<FeedTab>("trending");
  const [feedVideos, setFeedVideos] = useState<ExploreVideo[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Modals
  const [shareVideo, setShareVideo] = useState<ExploreVideo | null>(null);
  const [recreateVideo, setRecreateVideo] = useState<ExploreVideo | null>(null);
  const [viewerVideo, setViewerVideo] = useState<ExploreVideo | null>(null);

  // ---- Fetch community feed ----
  const fetchFeed = useCallback(async (tab: FeedTab) => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/explore?tab=${tab}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        if (data.videos && data.videos.length > 0) {
          setFeedVideos(data.videos);
        } else {
          setFeedVideos([]);
        }
      } else {
        setFeedVideos([]);
      }
    } catch {
      setFeedVideos([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(feedTab);
  }, [feedTab, fetchFeed]);

  // Fetch real stats
  useEffect(() => {
    fetch("/api/stats").then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, []);

  // ---- Modal handlers ----
  const handleRecreate = useCallback((video: ExploreVideo) => {
    setRecreateVideo(video);
  }, []);

  const handleShare = useCallback((video: ExploreVideo) => {
    setShareVideo(video);
  }, []);

  const handleVideoClick = useCallback((video: ExploreVideo) => {
    setViewerVideo(video);
  }, []);

  // ---- Pricing helpers ----
  const planCards = PLANS.slice(0, 3); // Free, Creator, Pro
  const studioPlan = PLANS[3]; // Studio

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />

      {/* ========================================
          SECTION 1: HERO — Full-screen video bg
      ======================================== */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* 3-layer instant-load hero: gradient (0ms) -> poster (~300ms) -> video (3-5s) */}
        <HeroVideo />

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 sm:px-6 text-center">
          <MotionSection>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
              <span className="gradient-text-hero">The AI video studio<br className="hidden sm:block" /> for creators.</span>
            </h1>
          </MotionSection>

          <MotionSection delay={0.1}>
            <p className="text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed">
              Text to video. Image to video. Dance transfer. Full short films.
              <br className="hidden sm:block" />
              10+ AI models. One platform. Made in South Africa.
            </p>
          </MotionSection>

          <MotionSection delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-6 w-full sm:w-auto px-4 sm:px-0">
              <Link href="/sign-up" className="w-full sm:w-auto" onClick={() => trackEvent("cta_click", { location: "hero" })}>
                <Button size="lg" className="text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
                  <Sparkles className="w-5 h-5" />
                  Get 100 Free Credits
                </Button>
              </Link>
              <Link href="#community" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </Button>
              </Link>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              No credit card required &bull; First video in 60 seconds
            </p>
          </MotionSection>

          {/* Real stats from DB */}
          <MotionSection delay={0.4} className="mt-8 sm:mt-12">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-zinc-400">
              <span className="flex items-center gap-2">
                <AnimatedCounter value={stats?.totalVideos ?? 0} suffix="+" className="font-semibold text-white" />
                <span>videos generated</span>
              </span>
              <span className="hidden sm:inline text-zinc-400">|</span>
              {(stats?.videosToday ?? 0) > 0 && (
                <>
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
                    <AnimatedCounter value={stats?.videosToday ?? 0} className="font-semibold text-white" />
                    <span>made today</span>
                  </span>
                  <span className="hidden sm:inline text-zinc-400">|</span>
                </>
              )}
              <span className="hidden sm:block text-zinc-400">
                Powered by 12 AI models
              </span>
            </div>
          </MotionSection>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="w-6 h-6 text-zinc-400" />
        </div>
      </section>

      {/* ========================================
          SECTION 2: LIVE COMMUNITY FEED
      ======================================== */}
      <section id="community" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <MotionSection className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              See what creators are making{" "}
              <span className="gradient-text">right now</span>
            </h2>
          </MotionSection>

          {/* Filter tabs */}
          <MotionSection delay={0.1} className="flex justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 overflow-x-auto px-2">
            {feedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFeedTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  feedTab === tab.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/[0.06] text-zinc-400 hover:bg-white/[0.10] hover:text-zinc-200"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </MotionSection>

          {/* Video grid */}
          {feedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video rounded-xl bg-white/[0.06]" />
                  <div className="mt-3 h-9 rounded-lg bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : feedVideos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-400 text-lg mb-4">Community feed is being built — check back soon!</p>
              <Link href="/generate">
                <Button variant="outline">
                  <Sparkles className="w-4 h-4" />
                  Create the first video
                </Button>
              </Link>
            </div>
          ) : (
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {feedVideos.map((video) => (
                <StaggerItem key={video.id}>
                  <ExploreVideoCard
                    video={video}
                    onRecreate={handleRecreate}
                    onShare={handleShare}
                    onClick={handleVideoClick}
                  />
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}

          {/* Explore all link */}
          {feedVideos.length > 0 && (
            <MotionSection className="text-center mt-10">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                Explore all videos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </MotionSection>
          )}
        </div>
      </section>

      {/* ========================================
          SECTION 3: HOW IT WORKS
      ======================================== */}
      <section className="py-24 px-4 border-t border-white/[0.10]">
        <div className="max-w-5xl mx-auto">
          <MotionSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold">
              Three steps. <span className="gradient-text">That&apos;s it.</span>
            </h2>
          </MotionSection>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorksSteps.map((step) => (
              <StaggerItem key={step.num}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 text-xl font-bold shadow-lg shadow-violet-600/30">
                    {step.num}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <step.icon className="w-6 h-6 text-violet-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ========================================
          SECTION 4: CAPABILITIES
      ======================================== */}
      <section className="py-24 px-4 border-t border-white/[0.10]">
        <div className="max-w-6xl mx-auto">
          <MotionSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything you need to{" "}
              <span className="gradient-text">create</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Professional tools that were impossible a year ago.
            </p>
          </MotionSection>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {capabilities.map((cap) => (
              <StaggerItem key={cap.title}>
                <GlowCard className="rounded-2xl border border-white/[0.10] bg-[#111118]/80 p-8 h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-violet-600/15 flex items-center justify-center">
                      <cap.icon className="w-6 h-6 text-violet-400" />
                    </div>
                    {(cap as { badge?: string }).badge && (
                      <Badge variant="violet" className="text-[10px] font-bold uppercase">
                        {(cap as { badge?: string }).badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {cap.description}
                  </p>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ========================================
          SECTION 5: PRICING
      ======================================== */}
      <section className="py-24 px-4 border-t border-white/[0.10]">
        <div className="max-w-6xl mx-auto">
          <MotionSection className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Simple, <span className="gradient-text">transparent</span> pricing
            </h2>
            <p className="text-zinc-400 text-lg">
              Start free. Scale as you grow.
            </p>
          </MotionSection>

          {/* 3 plan cards */}
          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {planCards.map((plan) => {
              const isPopular = plan.id === "creator";
              return (
                <StaggerItem key={plan.id}>
                  <div
                    className={`relative rounded-2xl border p-8 h-full flex flex-col ${
                      isPopular
                        ? "border-violet-500/40 bg-violet-500/[0.06] shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)]"
                        : "border-white/[0.10] bg-[#111118]/80"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="violet" className="px-3 py-1 text-xs font-bold uppercase">
                          Popular
                        </Badge>
                      </div>
                    )}

                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="text-4xl font-bold">
                        {plan.price === 0 ? "Free" : `$${plan.price}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-zinc-400 text-sm">/mo</span>
                      )}
                    </div>

                    <ul className="space-y-2.5 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                          <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Link href={plan.price === 0 ? "/sign-up" : "/pricing"}>
                      <Button
                        variant={isPopular ? "primary" : "secondary"}
                        className="w-full"
                      >
                        {plan.price === 0 ? "Get 100 Free Credits" : "Subscribe"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          {/* Studio plan — full-width */}
          <MotionSection className="mb-8">
            <div className="rounded-2xl border border-white/[0.10] bg-[#111118]/80 p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{studioPlan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold">${studioPlan.price}</span>
                  <span className="text-zinc-400 text-sm">/mo</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  {studioPlan.features.slice(0, 5).map((f) => (
                    <span key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-violet-400" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">
                  Subscribe
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </MotionSection>

          {/* Credit packs */}
          <MotionSection>
            <p className="text-center text-zinc-400 text-sm mb-4">
              Need more credits? Buy packs anytime.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {CREDIT_PACKS.map((pack) => (
                <Link key={pack.id} href="/pricing">
                  <div className="px-6 py-3 rounded-xl border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-center cursor-pointer">
                    <span className="block text-lg font-bold text-white">
                      {pack.credits.toLocaleString()}
                    </span>
                    <span className="text-sm text-zinc-400">${pack.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ========================================
          SECTION 6: FINAL CTA
      ======================================== */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 p-8 sm:p-12 md:p-16 text-center">
            <MotionSection>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Create your first AI video now.
              </h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-lg mx-auto">
                100 free credits. No credit card. Your first video renders in under 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/sign-up" onClick={() => trackEvent("cta_click", { location: "footer" })}>
                  <Button size="lg" className="text-base px-10 py-4">
                    <Sparkles className="w-5 h-5" />
                    Get 100 Free Credits
                  </Button>
                </Link>
                <Link href="/mimic">
                  <Button variant="outline" size="lg" className="text-base px-8 py-4">
                    <Zap className="w-5 h-5" />
                    Try Mimic Studio
                  </Button>
                </Link>
              </div>
            </MotionSection>
          </div>
        </div>
      </section>

      {/* ========================================
          SECTION 7: FOOTER
      ======================================== */}
      <footer className="border-t border-white/[0.10] py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-violet-600/20">
                  G
                </div>
                <span className="text-lg font-bold gradient-text">
                  Genesis Studio
                </span>
              </Link>
              <p className="text-sm text-zinc-400 leading-relaxed">
                AI video creation platform built in South Africa. 10+ models, Hollywood quality.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/generate", label: "Generate" },
                  { href: "/brain", label: "Brain Studio" },
                  { href: "/mimic", label: "Mimic Studio" },
                  { href: "/explore", label: "Explore" },
                  { href: "/pricing", label: "Pricing" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/docs", label: "API Docs" },
                  { href: "/tutorials", label: "Tutorials" },
                  { href: "/blog", label: "Blog" },
                  { href: "/changelog", label: "Changelog" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/about", label: "About" },
                  { href: "/terms", label: "Terms" },
                  { href: "/privacy", label: "Privacy" },
                  { href: "/contact", label: "Contact" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-4">Social</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "https://twitter.com/genesisstudio", label: "Twitter" },
                  { href: "https://github.com/genesisstudio", label: "GitHub" },
                ].map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-white/[0.10] text-center">
            <p className="text-sm text-zinc-400">
              &copy; 2026 Genesis Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ========================================
          MODALS
      ======================================== */}
      {viewerVideo && (
        <VideoViewerModal
          isOpen={!!viewerVideo}
          onClose={() => setViewerVideo(null)}
          video={viewerVideo}
          onShare={handleShare}
        />
      )}
      {shareVideo && (
        <ShareModal
          isOpen={!!shareVideo}
          onClose={() => setShareVideo(null)}
          video={shareVideo}
        />
      )}
      {recreateVideo && (
        <RecreateModal
          isOpen={!!recreateVideo}
          onClose={() => setRecreateVideo(null)}
          video={recreateVideo}
        />
      )}

      {/* JSON-LD Structured Data for SEO */}
      <AppSchema />
      <FAQSchema />
    </div>
  );
}
