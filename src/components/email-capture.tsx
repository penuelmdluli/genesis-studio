"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics-events";
import { useAuth } from "@/components/auth/auth-provider";
import { isInAppBrowser } from "@/lib/in-app-browser";

export function EmailCapture() {
  const [visible, setVisible] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    // Only show on homepage
    if (window.location.pathname !== "/") return;

    // A sign-up pitch is for people without an account. Wait until we know
    // who we are talking to; a signed-in user (including the owner) never
    // sees it.
    if (!isLoaded || isSignedIn) return;

    // Phones and in-app browsers (Facebook/Instagram ad traffic) never get the
    // interruption: the hero already carries the same offer, and a full-screen
    // overlay over the autoplaying hero video froze the Facebook browser.
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse || window.innerWidth < 768 || isInAppBrowser()) return;

    // Only show once per session
    try {
      if (sessionStorage.getItem("gs_email_shown")) return;
    } catch {
      return;
    }

    let shown = false;

    const show = () => {
      if (shown) return;
      shown = true;
      setVisible(true);
      try {
        sessionStorage.setItem("gs_email_shown", "1");
      } catch {}
      trackEvent("email_popup_shown");
    };

    // Timer: 8 seconds
    const timer = setTimeout(show, 8000);

    // Scroll: past 50%
    const onScroll = () => {
      const scrollPercent =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent >= 0.5) {
        show();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setVisible(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || isSignedIn) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setVisible(false)}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#111118] p-8 text-center shadow-2xl shadow-violet-600/10">
        {/* Dismiss button */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 p-2 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600/15">
          <Sparkles className="h-7 w-7 text-violet-400" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-white mb-2">Get 100 Free Credits</h2>

        {/* Subtext */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          Sign up and start creating AI videos in under 60 seconds. No credit card required.
        </p>

        {/* CTA */}
        <Link
          href="/sign-up"
          onClick={() => trackEvent("email_popup_click")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium px-8 py-3 transition-colors w-full"
        >
          <Sparkles className="w-4 h-4" />
          Start Creating
        </Link>
      </div>
    </div>
  );
}
