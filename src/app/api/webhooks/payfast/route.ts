// ============================================
// GENESIS STUDIO — PayFast ITN handler
// ============================================
// Goes through the same processWebhookPayment as Yoco, so PayFast payments
// get the same idempotency, amount check, plan expiry stamp, receipt email
// and pending-checkout settlement.
//
// PayFast expects a 200 quickly and retries otherwise. A signature or
// validation failure is answered 400 so it is visible in their dashboard.

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let rawForSupport = "";
  try {
    const text = await req.text();
    rawForSupport = text;
    // URLSearchParams preserves the order PayFast sent, which the ITN
    // signature depends on.
    const body: Record<string, string> = {};
    new URLSearchParams(text).forEach((value, key) => {
      body[key] = value;
    });

    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const provider = getProvider("payfast");
    const result = await provider.handleWebhook(body, headers);
    const { success, message } = await processWebhookPayment(result, "payfast");

    if (!success) {
      console.error("[PAYFAST WEBHOOK] Processing failed:", message);
    }

    return NextResponse.json({ received: true, message });
  } catch (error) {
    // Logged with the raw form so a rejected ITN can be replayed by hand
    // through /api/admin/settle-checkout instead of being lost.
    console.error("[PAYFAST WEBHOOK] Error:", error instanceof Error ? error.message : error, "body:", rawForSupport.slice(0, 1500));
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
