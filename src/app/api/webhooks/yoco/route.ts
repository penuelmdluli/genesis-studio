// ============================================
// GENESIS STUDIO — Yoco Webhook Handler
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    try {
      const { getDb } = await import("@/lib/db-driver");
      await getDb().from("webhook_log").insert({
        id: crypto.randomUUID(),
        provider: "yoco",
        ip: req.headers.get("cf-connecting-ip") || "",
        user_agent: req.headers.get("user-agent") || "",
        body: rawBody.slice(0, 4000),
      });
    } catch (logErr) {
      console.warn("[YOCO WEBHOOK] webhook_log insert failed:", logErr);
    }
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const provider = getProvider("yoco");
    const result = await provider.handleWebhook(rawBody, headers);
    const { success, message } = await processWebhookPayment(result, "yoco");

    if (!success) {
      console.error("[YOCO WEBHOOK] Processing failed:", message);
    }

    return NextResponse.json({ received: true, message });
  } catch (error) {
    console.error("[YOCO WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
