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

    // Persist every hit before validating anything. Worker logs are not
    // retained, and two real payments produced no trace at all — this row
    // is how we tell "PayFast never called" from "we rejected it".
    try {
      const { getDb } = await import("@/lib/db-driver");
      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
      await getDb().from("webhook_log").insert({
        id: crypto.randomUUID(),
        provider: "payfast",
        ip,
        user_agent: req.headers.get("user-agent") || "",
        body: text.slice(0, 4000),
      });
    } catch (logErr) {
      console.warn("[PAYFAST WEBHOOK] webhook_log insert failed:", logErr);
    }
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
