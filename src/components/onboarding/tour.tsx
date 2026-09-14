"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Film, Wand2, Share2, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";

const TOUR_KEY = "genesis-onboarding-complete";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to iVideo Studio!",
    description: "Let's make your first AI video in 90 seconds.",
    action: "Let's Go!",
  },
  {
    icon: Wand2,
    title: "Step 1: Write a Prompt",
    description: "Describe any scene — or click a suggestion to get started instantly. Our AI enhancer makes any prompt cinematic.",
    action: "Next",
  },
  {
    icon: Film,
    title: "Step 2: Pick a Model & Generate",
    description: "Choose from 10+ AI engines — each produces a different style. Pick one and hit Generate!",
    action: "Next",
  },
  {
    icon: Share2,
    title: "Step 3: Share Everywhere",
    description: "Download your video, share to WhatsApp, TikTok, or the Explore feed. Other creators can even recreate your style!",
    action: "Start Creating",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = useStore((s) => s.user);

  // The tour is for a brand-new free account. Owners and paying customers
  // already know the product; showing them "you have 100 free credits" is
  // wrong on both counts.
  const isNewFreeUser = !!user && user.plan === "free" && !user.isOwner;

  useEffect(() => {
    // Only show on dashboard, only if not completed
    if (pathname === "/dashboard" && isNewFreeUser && !localStorage.getItem(TOUR_KEY)) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [pathname, isNewFreeUser]);

  const complete = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
    router.push("/generate");
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  };

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
  };

  if (!visible || !isNewFreeUser) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const description =
    step === 0 && user
      ? `You have ${user.creditBalance.toLocaleString()} credits to start creating AI videos. ${current.description}`
      : current.description;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative bg-[#111118] border border-white/[0.12] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-violet-500" : i < step ? "w-4 bg-violet-500/40" : "w-4 bg-white/[0.08]"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-violet-400" />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-zinc-100 mb-2">{current.title}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">{description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button onClick={dismiss} className="text-xs text-zinc-400 hover:text-zinc-400 transition-colors">
            Skip tour
          </button>
          <Button size="sm" onClick={next}>
            {current.action} <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
