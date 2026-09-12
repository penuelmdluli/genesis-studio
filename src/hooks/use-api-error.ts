"use client";

// ============================================
// GENESIS STUDIO — One way to report a failed request
// ============================================
// A dead end is worse than an error. "Insufficient credits" with no way to
// buy any, or "requires a Creator plan" with no way to upgrade, leaves the
// person holding a problem they cannot solve from where they are standing.
//
// Every page that calls a credit-spending endpoint runs its failures through
// this, so the two cases a customer can actually fix always come with the
// fix attached:
//
//   402  no credits   → open the top-up sheet
//   403  wrong plan   → send them to pricing
//
// Everything else gets the server's message, which already goes through
// lib/user-errors and always states what happened to their credits.

import { useCallback } from "react";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";

export interface ApiErrorBody {
  error?: string;
  required?: number;
  balance?: number;
  upgrade?: boolean;
  resetAt?: number;
}

export function useApiError() {
  const { toast } = useToast();
  const setCreditPurchaseOpen = useStore((s) => s.setCreditPurchaseOpen);

  /**
   * Report a failed response and, where possible, offer the way out.
   * Returns the message shown, so callers can also put it in their own
   * inline error slot.
   */
  return useCallback(
    (res: { status: number }, data: ApiErrorBody | null, fallback = "Something went wrong. Please try again."): string => {
      const message = data?.error || fallback;

      if (res.status === 402) {
        const needed = data?.required;
        const short = needed && data?.balance !== undefined ? Math.max(0, needed - data.balance) : 0;
        const text = short
          ? `You need ${short.toLocaleString()} more credits for this.`
          : "You don't have enough credits for this.";
        toast(text, "error");
        // The sheet is the answer to the problem, so open it rather than
        // asking them to find it.
        setCreditPurchaseOpen(true);
        return text;
      }

      if (res.status === 403 && (data?.upgrade || /plan/i.test(message))) {
        toast(message, "error");
        return `${message} Open Pricing to upgrade.`;
      }

      if (res.status === 429) {
        const wait = data?.resetAt ? Math.max(1, Math.ceil((data.resetAt - Date.now()) / 60000)) : null;
        const text = wait
          ? `You're going a bit fast — try again in ${wait} minute${wait === 1 ? "" : "s"}.`
          : "You're going a bit fast — give it a minute and try again.";
        toast(text, "error");
        return text;
      }

      toast(message, "error");
      return message;
    },
    [toast, setCreditPurchaseOpen]
  );
}
