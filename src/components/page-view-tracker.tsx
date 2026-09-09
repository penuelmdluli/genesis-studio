"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Fires one page view per navigation.
//
// Consent, matching the banner in components/ui/cookie-consent.tsx:
//
//   accepted  → send a persistent visitor id, so visits can be stitched into a
//               journey (landing page → signup).
//   declined  → still send the view, with NO identifier. We learn that a visit
//               happened and where it came from; nothing is tied to a person
//               or joined across visits.
//   undecided → same as declined until they choose.
//
// Counting an anonymous visit is what keeps aggregate traffic honest. Dropping
// those rows entirely would have made the numbers wrong in the one direction
// that matters — undercounting exactly the visitors who bounce.

const CONSENT_KEY = "genesis-cookie-consent";
const VISITOR_KEY = "genesis-visitor-id";

function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    // Private mode, or storage blocked. Treat as no consent.
    return false;
  }
}

function visitorId(): string | undefined {
  if (!hasAnalyticsConsent()) return undefined;
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // React re-runs effects on fast refresh and on some param churn; without
  // this the same view would be counted several times.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // The referrer only means anything on the first page of a session — after
    // that document.referrer is our own previous page, which is not a source.
    const isFirstView = lastSent.current === null;
    const key = pathname;
    if (lastSent.current === key) return;
    lastSent.current = key;

    const payload = {
      path: pathname,
      referrer: isFirstView ? document.referrer || undefined : undefined,
      utmSource: searchParams.get("utm_source") || undefined,
      utmMedium: searchParams.get("utm_medium") || undefined,
      utmCampaign: searchParams.get("utm_campaign") || undefined,
      visitorId: visitorId(),
    };

    const body = JSON.stringify(payload);

    // sendBeacon survives the page being closed, which is exactly the visit we
    // most want to count — someone who bounces. fetch is the fallback.
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      // Fall through to fetch.
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never surface an error on a working page.
    });
  }, [pathname, searchParams]);

  return null;
}
