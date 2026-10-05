"use client";

// Where the visitor is and what currency they will really be charged in.
// One fetch per page load, shared by every price display.
//
// Why this exists: the top-up sheet showed "$10" and "$12" while PayFast
// charged R185, so a South African saw a dollar price and then a rand bill,
// and a visitor abroad saw a dollar price their card was never offered.

import { useEffect, useState } from "react";

export interface PaymentInfo {
  country: string | null;
  isSA: boolean;
  /** True only when a rail that bills in USD is live (Paystack). */
  usdCheckout: boolean;
  providers: string[];
}

const DEFAULT: PaymentInfo = { country: null, isSA: true, usdCheckout: false, providers: [] };
let cached: Promise<PaymentInfo> | null = null;

function load(): Promise<PaymentInfo> {
  if (!cached) {
    cached = fetch("/api/payments/methods")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return DEFAULT;
        const country = typeof d.country === "string" ? d.country : null;
        return {
          country,
          // Unknown country → treat as SA; that is where nearly all buyers are.
          isSA: !country || country === "ZA" || country === "XX",
          usdCheckout: !!d.usdCheckout,
          providers: Array.isArray(d.providers) ? d.providers : [],
        };
      })
      .catch(() => DEFAULT);
  }
  return cached;
}

export function usePaymentInfo(): PaymentInfo {
  const [info, setInfo] = useState<PaymentInfo>(DEFAULT);
  useEffect(() => {
    let live = true;
    load().then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, []);
  return info;
}

/** "R49", plus "≈ $3" for visitors outside SA so they know roughly what it is. */
export function packPriceLabel(pack: { price: number; priceZAR?: number }, info: PaymentInfo): { main: string; sub: string | null } {
  if (!pack.priceZAR) return { main: `$${pack.price}`, sub: null };
  return {
    main: `R${pack.priceZAR.toLocaleString("en-ZA")}`,
    sub: info.isSA ? null : `≈ $${pack.price} USD`,
  };
}
