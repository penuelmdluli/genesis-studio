// ============================================
// GENESIS STUDIO — PayFast ITN Webhook Handler
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";

export async function POST(req: NextRequest) {
  try {
    // PayFast sends ITN as application/x-www-form-urlencoded
    const formData = await req.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
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

    // PayFast expects a 200 OK with no body to acknowledge ITN
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[PAYFAST WEBHOOK] Error:", error);
    return new NextResponse("ERROR", { status: 400 });
  }
}
