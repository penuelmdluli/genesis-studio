"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import { PageTransition, MotionSection } from "@/components/ui/motion";
import { getRandomPrompts, type SamplePrompt } from "@/lib/sample-prompts";
import { Sparkles, ArrowRight, Play, RefreshCw, Brain, Film } from "lucide-react";

const ONBOARDING_SKIP_KEY = "onboarding_skipped";
const REFERRAL_PROCESSED_KEY = "referral_processed";

type Step = "welcome" | "pick" | "generating" | "reveal" | "error";

const PROGRESS_MESSAGES = [
  "Crafting your scene...",
  "Rendering at 720p...",
  "Adding final touches...",
  "Almost there...",
];

export default function FirstVideoPage() {
  const router = useRouter();
  const { user, activeJobs, videos } = useStore();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("welcome");
  const [prompts] = useState<SamplePrompt[]>(() => getRandomPrompts(6));
  const [selectedPrompt, setSelectedPrompt] = useState<SamplePrompt | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState(PROGRESS_MESSAGES[0]);
  const [pollCount, setPollCount] = useState(0);

  // Skip onboarding if user already has videos
  useEffect(() => {
    if (videos.length > 0) {
      router.replace("/dashboard");
    }
  }, [videos, router]);

  // Process referral code from URL or cookie (runs once on first load)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(REFERRAL_PROCESSED_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || document.cookie.split(";").find((c) => c.trim().startsWith("ref="))?.split("=")[1];
    if (!ref) return;

    localStorage.setItem(REFERRAL_PROCESSED_KEY, "true");
    fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.creditsGranted) {
          toast(`Welcome bonus! You got ${d.creditsGranted} extra credits from a friend's referral 🎉`, "success");
        }
      })
      .catch(() => {});
  }, [toast]);

  // Cycle progress messages during generation
  useEffect(() => {
    if (step !== "generating") return;
    const interval = setInterval(() => {
      setPollCount((c) => {
        const next = c + 1;
        setProgressMsg(PROGRESS_MESSAGES[Math.min(next, PROGRESS_MESSAGES.length - 1)]);
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [step]);

  // Hard timeout — stop polling after 4 minutes
  useEffect(() => {
    if (step !== "generating") return;
    const timer = setTimeout(() => {
      setStep("error");
      toast("Generation is taking longer than expected. Check your gallery in a few minutes.", "error");
    }, 4 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [step, toast]);

  // Poll job status
  useEffect(() => {
    if (!jobId || step !== "generating") return;
    let consecutiveErrors = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= 10) {
            setStep("error");
            toast("Unable to check generation status. Please try again.", "error");
          }
          return;
        }
        consecutiveErrors = 0;
        const data = await res.json();
        if (data.status === "completed" && data.outputVideoUrl) {
          setVideoUrl(data.outputVideoUrl);
          setStep("reveal");
        } else if (data.status === "failed") {
          setStep("error");
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 10) {
          setStep("error");
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, step, toast]);

  const handleGenerate = useCallback(async (prompt: SamplePrompt) => {
    setSelectedPrompt(prompt);
    setStep("generating");
    setPollCount(0);
    setProgressMsg(PROGRESS_MESSAGES[0]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.prompt,
          modelId: prompt.recommendedModel,
          type: "t2v",
          duration: prompt.recommendedDuration,
          resolution: "720p",
          fps: 24,
          aspectRatio: "landscape",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as { error?: string }).error || "Generation failed", "error");
        setStep("error");
        return;
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch {
      toast("Something went wrong. Please try again.", "error");
      setStep("error");
    }
  }, [toast]);

  const handleSkip = () => {
    document.cookie = `${ONBOARDING_SKIP_KEY}=true; max-age=${60 * 60 * 24 * 30}; path=/`;
    router.replace("/dashboard");
  };

  const resolveVideoSrc = (url: string) => {
    if (url.startsWith("http")) return url;
    return `/api/videos/${url}`;
  };

  return (
    <PageTransition className="max-w-3xl mx-auto py-8 px-4">
      {/* Welcome */}
      {step === "welcome" && (
        <MotionSection className="space-y-8">
          {/* A first screen that shows the product rather than describing it.
              The old one was a title, a line of text and two buttons — a new
              creator could not tell what this thing made or where anything
              lived. */}
          <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/70 via-[#12121a] to-cyan-950/40 p-7 sm:p-10">
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold text-violet-200 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> {user?.creditBalance ?? 100} free credits
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-white leading-tight">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  Let&apos;s make something today.
                </span>
              </h1>
              <p className="mt-3 text-zinc-300 max-w-lg leading-relaxed">
                Everything here is built for creators growing a page — reels with sound,
                your face speaking any script, beats in your own genre. Start with a scene
                and you&apos;ll have a video in about 90 seconds.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => setStep("pick")} className="shadow-lg shadow-violet-600/30">
                  <Play className="w-5 h-5" /> Make my first video
                </Button>
                <Button variant="ghost" size="lg" onClick={handleSkip}>
                  Explore on my own
                </Button>
              </div>
            </div>
          </div>

          {/* Where things live. A new account otherwise has to guess what the
              sidebar words mean, so each one says what it is FOR. */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 px-1">What you can make here</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  href: "/generate",
                  icon: "🎬",
                  title: "Generate a video",
                  desc: "Describe a scene, get a cinematic clip with sound.",
                  tint: "from-violet-600/20 to-violet-600/5 border-violet-500/25",
                },
                {
                  href: "/tools",
                  icon: "🧰",
                  title: "Creator Tools",
                  badge: "NEW",
                  desc: "Add sound, dub into another language, remove a background, make a beat.",
                  tint: "from-cyan-600/20 to-cyan-600/5 border-cyan-500/25",
                },
                {
                  href: "/talking-avatar",
                  icon: "🗣️",
                  title: "AI Avatar",
                  desc: "Upload a face, paste a script — it speaks, in SA English if you like.",
                  tint: "from-fuchsia-600/20 to-fuchsia-600/5 border-fuchsia-500/25",
                },
                {
                  href: "/ai-singer",
                  icon: "🎤",
                  title: "AI Singer",
                  badge: "NEW",
                  desc: "Amapiano, gqom, gospel — your face singing your lyrics.",
                  tint: "from-amber-600/20 to-amber-600/5 border-amber-500/25",
                },
              ].map((c) => (
                <a
                  key={c.href}
                  href={c.href}
                  className={`group rounded-2xl border bg-gradient-to-br ${c.tint} p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{c.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100">{c.title}</span>
                        {c.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/30">
                            {c.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-zinc-400 leading-snug mt-1">{c.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-500 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* The one thing people miss: finished videos are not the end of the
              road, they are the input to everything else. */}
          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4">
            <p className="text-sm text-zinc-300">
              <strong className="text-white">Tip:</strong> every finished video lands in your{" "}
              <a href="/gallery" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">Gallery</a>,
              where one tap adds sound, captions or another language before you post it.
            </p>
          </div>
        </MotionSection>
      )}

      {/* Pick a prompt */}
      {step === "pick" && (
        <MotionSection className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">Pick a scene</h2>
            <p className="text-zinc-400">Click any card to generate it instantly</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prompts.map((p) => (
              <Card
                key={p.id}
                hover
                className="cursor-pointer transition-all hover:ring-1 hover:ring-violet-500/30"
                onClick={() => handleGenerate(p)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{p.thumbnailHint}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-200 truncate">{p.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.prompt}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <button
              onClick={() => { document.cookie = `${ONBOARDING_SKIP_KEY}=true; max-age=${60 * 60 * 24 * 30}; path=/`; router.push("/generate"); }}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Or write your own prompt <ArrowRight className="w-3 h-3 inline" />
            </button>
          </div>
        </MotionSection>
      )}

      {/* Generating */}
      {step === "generating" && (
        <MotionSection className="text-center space-y-8 py-16">
          <GenesisLoader />
          <div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">{progressMsg}</h2>
            {selectedPrompt && (
              <p className="text-sm text-zinc-400 max-w-md mx-auto">&quot;{selectedPrompt.title}&quot;</p>
            )}
          </div>
          <p className="text-xs text-zinc-400">This usually takes 60-120 seconds</p>
        </MotionSection>
      )}

      {/* Reveal */}
      {step === "reveal" && videoUrl && (
        <MotionSection className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">Your first video is ready</h2>
            <p className="text-zinc-400">This took about 90 seconds. You have {user?.creditBalance ?? 0} credits left.</p>
          </div>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <video
              src={resolveVideoSrc(videoUrl)}
              controls
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => router.push("/generate")}>
              <Film className="w-5 h-5" /> Make another
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push("/brain")}>
              <Brain className="w-5 h-5" /> Try Brain Studio
            </Button>
          </div>

          {/* Referral CTA — highest emotional moment */}
          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 text-center">
            <p className="text-sm font-medium text-zinc-200 mb-1">🎁 Love it? Share with a friend</p>
            <p className="text-xs text-zinc-400 mb-3">You both get bonus credits when they sign up</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const text = encodeURIComponent("I just made an AI video in 60 seconds — you need to try this! 🎬\n\nhttps://ivideostudio.ai/sign-up");
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText("https://ivideostudio.ai/sign-up");
                  toast("Link copied!", "success");
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-400">Your video is saved in your Gallery</p>
        </MotionSection>
      )}

      {/* Error */}
      {step === "error" && (
        <MotionSection className="text-center space-y-6 py-16">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
            <RefreshCw className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Something went wrong</h2>
          <p className="text-zinc-400 max-w-md mx-auto">
            We&apos;ve refunded your credits. Try a different prompt or skip onboarding for now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => setStep("pick")}>
              <RefreshCw className="w-4 h-4" /> Try a different prompt
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        </MotionSection>
      )}
    </PageTransition>
  );
}
