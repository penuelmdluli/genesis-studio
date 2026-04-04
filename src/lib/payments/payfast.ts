// ============================================
// GENESIS STUDIO — PayFast Payment Provider
// ============================================

import crypto from "crypto";
import {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  PaymentVerification,
  WebhookResult,
} from "./types";

// PayFast valid source IP ranges for ITN verification
const PAYFAST_IP_RANGES = [
  "197.97.145.144/28",
  "41.74.179.192/27",
  "197.110.64.128/27",
];

const SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
const PRODUCTION_URL = "https://www.payfast.co.za/eng/process";

function ipInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  const rangeNum = range
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  return (ipNum & mask) === (rangeNum & mask);
}

function isPayFastIP(ip: string): boolean {
  return PAYFAST_IP_RANGES.some((range) => ipInRange(ip, range));
}

export class PayFastProvider implements PaymentProvider {
  name = "payfast";

  private get merchantId(): string {
    const id = process.env.PAYFAST_MERCHANT_ID;
    if (!id) throw new Error("PAYFAST_MERCHANT_ID is not configured");
    return id;
  }

  private get merchantKey(): string {
    const key = process.env.PAYFAST_MERCHANT_KEY;
    if (!key) throw new Error("PAYFAST_MERCHANT_KEY is not configured");
    return key;
  }

  private get passphrase(): string {
    return process.env.PAYFAST_PASSPHRASE || "";
  }

  private get isSandbox(): boolean {
    return process.env.PAYFAST_SANDBOX === "true";
  }

  private get processUrl(): string {
    return this.isSandbox ? SANDBOX_URL : PRODUCTION_URL;
  }

  /**
   * Generate PayFast MD5 signature from sorted params + passphrase.
   */
  private generateSignature(params: Record<string, string>): string {
    // Sort parameters alphabetically and build query string
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys
      .filter((key) => params[key] !== undefined && params[key] !== "")
      .map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`)
      .join("&");

    // Append passphrase if set
    const signatureString = this.passphrase
      ? `${paramString}&passphrase=${encodeURIComponent(this.passphrase).replace(/%20/g, "+")}`
      : paramString;

    return crypto.createHash("md5").update(signatureString).digest("hex");
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // PayFast uses form-based redirects, not API-based checkout creation.
    // We build the redirect URL with signed params.
    const amountInRands = (params.amount / 100).toFixed(2);
    const checkoutId = `pf_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const pfParams: Record<string, string> = {
      merchant_id: this.merchantId,
      merchant_key: this.merchantKey,
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      notify_url: params.notifyUrl,
      email_address: params.email,
      amount: amountInRands,
      item_name: params.description,
      item_description: params.description,
      custom_str1: params.userId,
      custom_str2: params.metadata.type || "",
      custom_str3: params.metadata.planId || params.metadata.packId || "",
      custom_str4: checkoutId,
      custom_str5: JSON.stringify(params.metadata),
    };

    pfParams.signature = this.generateSignature(pfParams);

    // Build the redirect URL with all params
    const queryString = Object.entries(pfParams)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .join("&");

    return {
      checkoutId,
      redirectUrl: `${this.processUrl}?${queryString}`,
      provider: this.name,
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    // PayFast doesn't have a simple verification endpoint like Yoco/Paystack.
    // Verification is done via the ITN (webhook) callback.
    // For manual verification, we can query the PayFast API.
    const verifyUrl = this.isSandbox
      ? "https://sandbox.payfast.co.za/eng/query/validate"
      : "https://www.payfast.co.za/eng/query/validate";

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `pf_payment_id=${encodeURIComponent(reference)}`,
    });

    const text = await response.text();
    const isValid = text.trim() === "VALID";

    return {
      success: isValid,
      amount: 0, // Amount not returned from validation endpoint
      reference,
      metadata: {},
    };
  }

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    // Verify source IP
    const sourceIp =
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      headers["x-real-ip"] ||
      "";

    if (sourceIp && !this.isSandbox && !isPayFastIP(sourceIp)) {
      throw new Error(`Invalid PayFast source IP: ${sourceIp}`);
    }

    // Parse the ITN data
    const data = body as Record<string, string>;

    // Verify signature
    const receivedSignature = data.signature;
    const paramsWithoutSignature = { ...data };
    delete paramsWithoutSignature.signature;

    const expectedSignature = this.generateSignature(paramsWithoutSignature);
    if (receivedSignature !== expectedSignature) {
      throw new Error("Invalid PayFast ITN signature");
    }

    // Determine event type
    let eventType: WebhookResult["event"] = "unknown";
    const paymentStatus = data.payment_status;

    if (paymentStatus === "COMPLETE") {
      eventType = "payment.success";
    } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
      eventType = "payment.failed";
    }

    // Parse metadata from custom fields
    let metadata: Record<string, string> = {};
    try {
      metadata = data.custom_str5 ? JSON.parse(data.custom_str5) : {};
    } catch {
      metadata = {
        userId: data.custom_str1 || "",
        type: data.custom_str2 || "",
        planId: data.custom_str3 || "",
        packId: data.custom_str3 || "",
      };
    }

    const amountCents = data.amount_gross
      ? Math.round(parseFloat(data.amount_gross) * 100)
      : undefined;

    return {
      event: eventType,
      reference: data.pf_payment_id || data.custom_str4 || "",
      metadata,
      amount: amountCents,
    };
  }
}

export function createPayFastProvider(): PayFastProvider | null {
  if (!process.env.PAYFAST_MERCHANT_ID || !process.env.PAYFAST_MERCHANT_KEY) {
    return null;
  }
  return new PayFastProvider();
}
