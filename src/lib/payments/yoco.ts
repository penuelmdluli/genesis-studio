// ============================================
// GENESIS STUDIO — Yoco Payment Provider
// ============================================

import crypto from "crypto";
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  PaymentVerification,
  WebhookResult,
} from "./types";

const YOCO_API_BASE = "https://payments.yoco.com/api";

export class YocoProvider implements PaymentProvider {
  name = "yoco";

  private get secretKey(): string {
    const key = process.env.YOCO_SECRET_KEY;
    if (!key) throw new Error("YOCO_SECRET_KEY is not configured");
    return key;
  }

  private get webhookSecret(): string {
    const secret = process.env.YOCO_WEBHOOK_SECRET;
    if (!secret) throw new Error("YOCO_WEBHOOK_SECRET is not configured");
    return secret;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const response = await fetch(`${YOCO_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        failureUrl: params.cancelUrl,
        metadata: {
          ...params.metadata,
          userId: params.userId,
          email: params.email,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Yoco checkout creation failed: ${response.status} ${errorBody}`);
    }

    const data = await response.json();

    return {
      checkoutId: data.id,
      redirectUrl: data.redirectUrl,
      provider: this.name,
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const response = await fetch(`${YOCO_API_BASE}/checkouts/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Yoco verification failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: data.status === "completed",
      amount: data.amount,
      reference: data.id,
      metadata: data.metadata || {},
    };
  }

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    // Verify webhook signature
    const signature = headers["webhook-signature"] || headers["x-webhook-signature"];
    if (!signature) {
      throw new Error("Missing Yoco webhook signature");
    }

    const rawBody = typeof body === "string" ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new Error("Invalid Yoco webhook signature");
    }

    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const event = payload as {
      type: string;
      payload: {
        id: string;
        status: string;
        amount: number;
        metadata?: Record<string, string>;
      };
    };

    let eventType: WebhookResult["event"] = "unknown";
    if (event.type === "payment.succeeded" || event.type === "checkout.completed") {
      eventType = "payment.success";
    } else if (event.type === "payment.failed" || event.type === "checkout.failed") {
      eventType = "payment.failed";
    }

    return {
      event: eventType,
      reference: event.payload?.id || "",
      metadata: event.payload?.metadata || {},
      amount: event.payload?.amount,
    };
  }
}

export function createYocoProvider(): YocoProvider | null {
  if (!process.env.YOCO_SECRET_KEY) return null;
  return new YocoProvider();
}
