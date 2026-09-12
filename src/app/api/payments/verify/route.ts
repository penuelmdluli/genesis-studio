// ============================================
// GENESIS STUDIO — Post-checkout payment verification
// ============================================
// Called by the dashboard when a customer lands back from a checkout. It asks
// the provider directly whether each of the customer's recent pending
// checkouts was paid, and credits them on the spot. This is the belt to the
// webhook's braces: for months the webhook pointed at a dead host and every
// paying customer got nothing. With this, that failure mode credits the
// customer anyway the moment they return.
//
// Idempotent: processWebhookPayment keys on the checkout id, the same key the
// webhook uses, so a payment credited here is skipped when the webhook
// arrives, and vice versa.

import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";
import { listPendingCheckouts, markCheckout } from "@/lib/payments/pending";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const pending = await listPendingCheckouts(user.id);
    const results: Array<{ checkoutId: string; paid: boolean; message: string }> = [];

    for (const row of pending) {
      try {
        const provider = getProvider(row.provider);
        const verification = await provider.verifyPayment(row.id);
        if (!verification.success) {
          results.push({ checkoutId: row.id, paid: false, message: "not paid yet" });
          continue;
        }

        let storedMetadata: Record<string, string> = {};
        try {
          storedMetadata = JSON.parse(row.metadata || "{}");
        } catch {
          storedMetadata = {};
        }

        const outcome = await processWebhookPayment(
          {
            event: "payment.success",
            reference: row.id,
            // What we stored at checkout time is authoritative for what was
            // bought; the provider's copy fills in anything we did not keep.
            metadata: { ...verification.metadata, ...storedMetadata, checkoutId: row.id, userId: user.id },
            amount: verification.amount,
          },
          row.provider
        );
        results.push({ checkoutId: row.id, paid: true, message: outcome.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[PAYMENTS] Verify failed for ${row.id}:`, msg);
        results.push({ checkoutId: row.id, paid: false, message: "verification error" });
      }
    }

    // Anything paid is now settled either way.
    for (const r of results) {
      if (r.paid) await markCheckout(r.checkoutId, "completed");
    }

    const credited = results.some((r) => r.paid && !/duplicate/i.test(r.message));
    const alreadyCredited = results.some((r) => r.paid && /duplicate/i.test(r.message));

    return NextResponse.json({
      checked: pending.length,
      credited,
      alreadyCredited,
      results,
    });
  } catch (error) {
    console.error("[PAYMENTS] Verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
