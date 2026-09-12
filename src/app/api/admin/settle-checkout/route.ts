// ============================================
// GENESIS STUDIO — Admin: settle a pending checkout by hand
// ============================================
// For the case that just happened: the customer paid (provider confirmation
// in hand) but the notification never reached us. Runs the exact same
// settlement as the webhook — plan, credits, expiry, ledger, idempotency
// guards — so a late-arriving ITN is deduped rather than double-crediting.
//
// POST { checkoutId, reference? }  — owner only. `reference` is the
// provider's payment id if known (pf_payment_id / Yoco payment id); it
// defaults to the checkout id.

import { NextRequest, NextResponse } from "next/server";
import { requireOwnerOrNotFound } from "@/lib/owner-only";
import { getDb } from "@/lib/db-driver";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";
import { CREDIT_PACKS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await requireOwnerOrNotFound();
  if (denied) return denied;

  const { checkoutId, reference } = (await req.json().catch(() => ({}))) as { checkoutId?: string; reference?: string };
  if (!checkoutId) return NextResponse.json({ error: "checkoutId required" }, { status: 400 });

  const db = getDb();
  const { data: pending } = await db.from("pending_checkouts").select("*").eq("id", checkoutId).maybeSingle();
  if (!pending) return NextResponse.json({ error: "No such checkout" }, { status: 404 });
  if (pending.status === "completed") {
    return NextResponse.json({ ok: true, message: "Already settled", checkout: pending });
  }

  const metadata: Record<string, string> = {
    type: pending.type,
    userId: pending.user_id,
    checkoutId: pending.id,
  };
  if (pending.type === "subscription") {
    metadata.planId = pending.product_id;
  } else {
    metadata.packId = pending.product_id;
    const pack = CREDIT_PACKS.find((p) => p.id === pending.product_id);
    metadata.credits = String(pack?.credits || 0);
  }

  const result = await processWebhookPayment(
    {
      event: "payment.success",
      reference: reference || pending.id,
      metadata,
      amount: pending.amount,
    },
    `${pending.provider}`
  );

  return NextResponse.json({ ok: result.success, message: result.message, checkout: pending.id });
}
