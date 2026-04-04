// ============================================
// GENESIS STUDIO — Paystack Payment Provider
// ============================================

import crypto from "crypto";
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  PaymentVerification,
  WebhookResult,
} from "./types";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export class PaystackProvider implements PaymentProvider {
  name = "paystack";

  private get secretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
    return key;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount, // Paystack expects amount in kobo/cents
        currency: params.currency,
        callback_url: params.successUrl,
        metadata: {
          ...params.metadata,
          userId: params.userId,
          cancel_action: params.cancelUrl,
          custom_fields: [
            {
              display_name: "Description",
              variable_name: "description",
              value: params.description,
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Paystack transaction initialization failed: ${response.status} ${errorBody}`
      );
    }

    const data = await response.json();

    if (!data.status) {
      throw new Error(`Paystack error: ${data.message}`);
    }

    return {
      checkoutId: data.data.reference,
      redirectUrl: data.data.authorization_url,
      provider: this.name,
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const response = await fetch(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Paystack verification failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: data.data?.status === "success",
      amount: data.data?.amount || 0,
      reference: data.data?.reference || reference,
      metadata: data.data?.metadata || {},
    };
  }

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    // Verify HMAC SHA512 signature
    const signature = headers["x-paystack-signature"];
    if (!signature) {
      throw new Error("Missing Paystack webhook signature");
    }

    const rawBody = typeof body === "string" ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac("sha512", this.secretKey)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new Error("Invalid Paystack webhook signature");
    }

    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const event = payload as {
      event: string;
      data: {
        reference: string;
        status: string;
        amount: number;
        metadata?: Record<string, string>;
      };
    };

    let eventType: WebhookResult["event"] = "unknown";
    if (event.event === "charge.success") {
      eventType = "payment.success";
    } else if (event.event === "charge.failed") {
      eventType = "payment.failed";
    } else if (event.event === "subscription.disable") {
      eventType = "subscription.cancelled";
    }

    return {
      event: eventType,
      reference: event.data?.reference || "",
      metadata: event.data?.metadata || {},
      amount: event.data?.amount,
    };
  }
}

export function createPaystackProvider(): PaystackProvider | null {
  if (!process.env.PAYSTACK_SECRET_KEY) return null;
  return new PaystackProvider();
}
