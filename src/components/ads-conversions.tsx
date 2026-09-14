"use client";

// ============================================
// Google Ads conversions (account 708-396-6884)
// ============================================
// Fired from the pages a sign-up or a payment lands on, once each, so the
// campaigns optimise for customers rather than clicks. The Google tag itself
// is loaded in the root layout (with consent mode).

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SIGN_UP = "AW-17992284399/P0i1CIn00PccEO_xsYND";
const PURCHASE = "AW-17992284399/bmn1CIz00PccEO_xsYND";

function send(sendTo: string, onceKey: string, extra: Record<string, unknown> = {}) {
  try {
    if (localStorage.getItem(onceKey)) return;
  } catch {
    /* storage blocked: still report */
  }
  let tries = 0;
  const fire = () => {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    if (w.gtag) {
      w.gtag("event", "conversion", { send_to: sendTo, ...extra });
      try {
        localStorage.setItem(onceKey, String(Date.now()));
      } catch {
        /* ignore */
      }
    } else if (tries++ < 20) {
      setTimeout(fire, 500); // the tag loads after hydration
    }
  };
  fire();
}

export function AdsConversions() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    // New accounts (email and Google) are sent here exactly once.
    if (pathname === "/onboarding/first-video") {
      send(SIGN_UP, "ads_conv_signup");
    }
    // Checkout success returns: packs, subscriptions, PayFast.
    const paid =
      params.get("pack_success") === "true" ||
      params.get("success") === "true" ||
      params.get("payment") === "success";
    if (paid) {
      const id = `${pathname}-${Math.floor(Date.now() / 60000)}`;
      send(PURCHASE, `ads_conv_purchase_${id}`, { transaction_id: id });
    }
  }, [pathname, params]);

  return null;
}
