// Product events. Two sinks:
//   1. Plausible, if its script happens to be loaded (third-party, optional).
//   2. Our own /api/track/event, always — this is what the per-customer
//      timeline in /admin/customers is built from.
//
// Fire-and-forget. A failed beacon must never affect the page.

const CONSENT_KEY = "genesis-cookie-consent";
const VISITOR_KEY = "genesis-visitor-id";

function visitorId(): string | undefined {
  try {
    if (localStorage.getItem(CONSENT_KEY) !== "accepted") return undefined;
    return localStorage.getItem(VISITOR_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;

  const w = window as unknown as { plausible?: (n: string, o?: { props?: Record<string, unknown> }) => void };
  if (w.plausible) {
    try {
      w.plausible(name, { props });
    } catch {
      // Third-party; ignore.
    }
  }

  try {
    const payload = JSON.stringify({
      name,
      props,
      path: window.location.pathname,
      visitorId: visitorId(),
    });
    // sendBeacon survives navigation (a click that immediately routes away),
    // which is exactly when most interesting events happen.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track/event", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never let analytics break the page.
  }
}
