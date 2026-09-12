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

// Yoco recommends rejecting anything older than 3 minutes. Five gives their
// retry schedule (immediately, +5s, +5m ...) room without opening a replay
// window worth worrying about — every retry is re-signed with a fresh
// timestamp anyway.
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Yoco webhook signature.
 *
 * Yoco signs the string `${webhook-id}.${webhook-timestamp}.${rawBody}` with
 * HMAC-SHA256, keyed by the base64-DECODED secret (the part after "whsec_"),
 * and sends it base64-encoded in `webhook-signature` as a space-separated list
 * of `v1,<sig>` entries. The previous implementation hashed only the body,
 * used the raw "whsec_..." string as the key and compared hex — so it could
 * never match, and every real payment was rejected with "Invalid signature".
 *
 * Exported so it can be unit-tested and reused by the self-test tooling.
 */
export function verifyYocoSignature(params: {
  secret: string;
  rawBody: string;
  webhookId: string | undefined;
  timestamp: string | undefined;
  signatureHeader: string | undefined;
  now?: number; // seconds, injectable for tests
}): { ok: boolean; reason?: string } {
  const { secret, rawBody, webhookId, timestamp, signatureHeader } = params;

  if (!webhookId || !timestamp || !signatureHeader) {
    return { ok: false, reason: "missing webhook-id, webhook-timestamp or webhook-signature header" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "webhook-timestamp is not a number" };
  const now = params.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: `webhook-timestamp is ${Math.abs(now - ts)}s from now (limit ${TIMESTAMP_TOLERANCE_SECONDS}s)` };
  }

  const secretB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretB64, "base64");
  } catch {
    return { ok: false, reason: "YOCO_WEBHOOK_SECRET is not valid base64" };
  }
  if (secretBytes.length === 0) return { ok: false, reason: "YOCO_WEBHOOK_SECRET decoded to nothing" };

  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(`${webhookId}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  // The header may carry several signatures ("v1,abc v1,def"). Any match
  // wins — Yoco rotates secrets this way.
  for (const entry of signatureHeader.split(" ")) {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) continue;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no v1 signature matched" };
}

interface YocoCheckout {
  id: string;
  status: string; // created | started | processing | completed | cancelled | expired
  amount: number;
  currency: string;
  paymentId?: string | null;
  metadata?: Record<string, string>;
}

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
        // The merchant header on Yoco's page is the business trading name
        // and cannot be set per checkout (displayName/merchantName are
        // ignored). Line items do render, so this is where the customer
        // sees what — and whose product — they are paying for.
        lineItems: [
          {
            displayName: params.description.slice(0, 120),
            quantity: 1,
            pricingDetails: { price: params.amount },
          },
        ],
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

    const data = (await response.json()) as { id: string; redirectUrl: string };

    return {
      checkoutId: data.id,
      redirectUrl: data.redirectUrl,
      provider: this.name,
    };
  }

  /**
   * Look a checkout up by its id. Used by the post-checkout verify step so a
   * customer who lands back on the dashboard gets credited immediately, even
   * if the webhook is still on its way (or was never delivered).
   */
  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const response = await fetch(`${YOCO_API_BASE}/checkouts/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Yoco verification failed: ${response.status}`);
    }

    const data = (await response.json()) as YocoCheckout;

    return {
      success: data.status === "completed",
      amount: data.amount,
      reference: data.id,
      metadata: { ...(data.metadata || {}), checkoutId: data.id },
    };
  }

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    const rawBody = typeof body === "string" ? body : JSON.stringify(body);

    const check = verifyYocoSignature({
      secret: this.webhookSecret,
      rawBody,
      webhookId: headers["webhook-id"],
      timestamp: headers["webhook-timestamp"],
      signatureHeader: headers["webhook-signature"],
    });
    if (!check.ok) {
      throw new Error(`Invalid Yoco webhook signature: ${check.reason}`);
    }

    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const event = payload as {
      type: string;
      payload: {
        id: string;
        status: string;
        amount: number;
        mode?: string;
        metadata?: Record<string, string>;
      };
    };

    let eventType: WebhookResult["event"] = "unknown";
    if (event.type === "payment.succeeded" || event.type === "checkout.completed") {
      eventType = "payment.success";
    } else if (event.type === "payment.failed" || event.type === "checkout.failed") {
      eventType = "payment.failed";
    }

    const metadata = event.payload?.metadata || {};

    // Yoco copies the checkout id into the payment's metadata. Keying the
    // idempotency record on the checkout id (rather than the payment id) means
    // the webhook and the post-checkout verify step agree on what "already
    // processed" means, so a customer can never be credited twice.
    const reference = metadata.checkoutId || event.payload?.id || "";

    return {
      event: eventType,
      reference,
      metadata,
      amount: event.payload?.amount,
    };
  }
}

export function createYocoProvider(): YocoProvider | null {
  if (!process.env.YOCO_SECRET_KEY) return null;
  return new YocoProvider();
}
