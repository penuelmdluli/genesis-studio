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
        <MotionSection className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center mx-auto shadow-lg shadow-violet-600/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            Let&apos;s make your first AI video in under 90 seconds. Pick a scene below and watch the magic happen.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => setStep("pick")}>
              <Play className="w-5 h-5" /> Pick a scene
            </Button>
            <Button variant="ghost" size="lg" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
          <p className="text-xs text-zinc-500">You have {user?.creditBalance ?? 50} credits to start</p>
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
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{p.prompt}</p>
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
              <p className="text-sm text-zinc-500 max-w-md mx-auto">&quot;{selectedPrompt.title}&quot;</p>
            )}
          </div>
          <p className="text-xs text-zinc-500">This usually takes 60-120 seconds</p>
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
          <p className="text-center text-xs text-zinc-500">Your video is saved in your Gallery</p>
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
