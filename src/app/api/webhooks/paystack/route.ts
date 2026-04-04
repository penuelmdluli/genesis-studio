// ============================================
// GENESIS STUDIO — Paystack Webhook Handler
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const provider = getProvider("paystack");
    const result = await provider.handleWebhook(rawBody, headers);
    const { success, message } = await processWebhookPayment(
      result,
      "paystack"
    );

    if (!success) {
      console.error("[PAYSTACK WEBHOOK] Processing failed:", message);
    }

    return NextResponse.json({ received: true, message });
  } catch (error) {
    console.error("[PAYSTACK WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
