"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Saves the ?ref= parameter as a cookie so it persists through Clerk's auth flow.
 * The onboarding page reads it and processes the referral.
 */
export function SaveReferral() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref");
    if (ref) {
      document.cookie = `ref=${ref}; max-age=${60 * 60 * 24}; path=/`; // 24h
    }
  }, [params]);

  return null;
}

/** Shown on sign-up when someone arrives through a friend's invite link. */
export function InviteBanner() {
  const params = useSearchParams();
  if (!params.get("ref")) return null;
  return (
    <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
      <p className="text-sm font-semibold text-emerald-200">🎁 Your friend invited you</p>
      <p className="text-xs text-zinc-300 mt-0.5">Join free and get 50 bonus credits on top of your free credits.</p>
    </div>
  );
}
