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
