// ============================================
// GENESIS STUDIO — PayFast Payment Provider
// ============================================
// PayFast (by Network) — Instant EFT, cards, SnapScan, Zapper, Mobicred.
// The second ZAR rail next to Yoco; the one South Africans who do not want
// to type a card number into a website reach for.
//
// Two things this implementation gets right that the previous one did not:
//
//   1. The checkout signature is computed over the fields IN PAYFAST'S
//      DOCUMENTED ORDER, not alphabetically. PayFast rejects an alphabetical
//      signature with "signature mismatch" on the payment page, so no
//      customer could ever have reached the pay button.
//   2. The ITN (webhook) signature is computed over the fields in the order
//      PayFast sent them, and the notification is then confirmed with
//      PayFast's validate endpoint before any credit is granted.
//
// Enabled only when PAYFAST_ENABLED=true in addition to the merchant
// credentials, because a PayFast account takes live payments only once it
// is verified — offering it before then produces a dead end at checkout.

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

const SANDBOX_HOST = "https://sandbox.payfast.co.za";
const PRODUCTION_HOST = "https://www.payfast.co.za";

/** Field order for the payment-form signature, per PayFast's documentation. */
const CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
  "subscription_notify_email",
  "subscription_notify_webhook",
  "subscription_notify_buyer",
];

function ipInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  return (ipNum & mask) === (rangeNum & mask);
}

function isPayFastIP(ip: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) && PAYFAST_IP_RANGES.some((range) => ipInRange(ip, range));
}

/** PHP-style urlencode: spaces become "+", and !'()* are encoded too. */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * MD5 of `key=value&...` for the given keys in the given order, skipping
 * blanks, with the passphrase appended when one is set.
 */
export function pfSignature(params: Record<string, string>, order: string[], passphrase: string): string {
  const parts: string[] = [];
  for (const key of order) {
    const v = params[key];
    if (v === undefined || v === null || String(v) === "") continue;
    parts.push(`${key}=${pfEncode(String(v).trim())}`);
  }
  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${pfEncode(passphrase.trim())}`;
  return crypto.createHash("md5").update(str).digest("hex");
}

export class PayFastProvider implements PaymentProvider {
  name = "payfast";

  private get merchantId(): string {
    const id = process.env.PAYFAST_MERCHANT_ID;
    if (!id) throw new Error("PAYFAST_MERCHANT_ID is not configured");
    return id.trim();
  }

  private get merchantKey(): string {
    const key = process.env.PAYFAST_MERCHANT_KEY;
    if (!key) throw new Error("PAYFAST_MERCHANT_KEY is not configured");
    return key.trim();
  }

  private get passphrase(): string {
    return (process.env.PAYFAST_PASSPHRASE || "").trim();
  }

  private get isSandbox(): boolean {
    return process.env.PAYFAST_SANDBOX === "true";
  }

  private get host(): string {
    return this.isSandbox ? SANDBOX_HOST : PRODUCTION_HOST;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    if (params.currency !== "ZAR") {
      throw new Error("PayFast only accepts ZAR");
    }
    const amountInRands = (params.amount / 100).toFixed(2);
    const checkoutId = `pf_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const [nameFirst, ...rest] = (params.metadata.name || params.email.split("@")[0] || "Customer").split(" ");

    const pfParams: Record<string, string> = {
      merchant_id: this.merchantId,
      merchant_key: this.merchantKey,
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      notify_url: params.notifyUrl,
      name_first: nameFirst.slice(0, 100),
      name_last: rest.join(" ").slice(0, 100),
      email_address: params.email,
      m_payment_id: checkoutId,
      amount: amountInRands,
      item_name: params.description.slice(0, 100),
      item_description: params.description.slice(0, 255),
      custom_str1: params.userId,
      custom_str2: params.metadata.type || "",
      custom_str3: params.metadata.planId || params.metadata.packId || "",
      custom_str4: params.metadata.credits || "",
      custom_str5: checkoutId,
    };

    pfParams.signature = pfSignature(pfParams, CHECKOUT_FIELD_ORDER, this.passphrase);

    const query = [...CHECKOUT_FIELD_ORDER, "signature"]
      .filter((k) => pfParams[k] !== undefined && pfParams[k] !== "")
      .map((k) => `${k}=${pfEncode(pfParams[k])}`)
      .join("&");

    return {
      checkoutId,
      redirectUrl: `${this.host}/eng/process?${query}`,
      provider: this.name,
    };
  }

  /**
   * PayFast has no "look up by our reference" endpoint. The ITN is the
   * source of truth (PayFast retries it), so the post-checkout verify step
   * simply reports "not paid yet" and lets the ITN do the crediting.
   */
  async verifyPayment(reference: string): Promise<PaymentVerification> {
    return { success: false, amount: 0, reference, metadata: {} };
  }

  async handleWebhook(body: unknown, headers: Record<string, string>): Promise<WebhookResult> {
    const sourceIp = headers["cf-connecting-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || "";
    if (sourceIp && !this.isSandbox && !isPayFastIP(sourceIp)) {
      throw new Error(`Invalid PayFast source IP: ${sourceIp}`);
    }

    // Insertion order is the order PayFast sent the fields in.
    const data = body as Record<string, string>;
    const receivedSignature = data.signature;
    const orderedKeys = Object.keys(data).filter((k) => k !== "signature");
    const expected = pfSignature(data, orderedKeys, this.passphrase);
    if (!receivedSignature || receivedSignature !== expected) {
      throw new Error("Invalid PayFast ITN signature");
    }

    // Merchant id must be ours — an ITN for someone else's account is noise.
    if (data.merchant_id && data.merchant_id !== this.merchantId) {
      throw new Error("PayFast ITN for a different merchant");
    }

    // Confirm with PayFast before trusting it.
    const form = orderedKeys.map((k) => `${k}=${pfEncode(data[k] ?? "")}`).join("&");
    const res = await fetch(`${this.host}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const verdict = (await res.text()).trim();
    if (verdict !== "VALID") {
      throw new Error(`PayFast validate endpoint answered ${verdict || res.status}`);
    }

    let eventType: WebhookResult["event"] = "unknown";
    if (data.payment_status === "COMPLETE") eventType = "payment.success";
    else if (data.payment_status === "FAILED" || data.payment_status === "CANCELLED") eventType = "payment.failed";

    const checkoutId = data.m_payment_id || data.custom_str5 || "";
    const metadata: Record<string, string> = {
      userId: data.custom_str1 || "",
      type: data.custom_str2 || "",
      planId: data.custom_str2 === "subscription" ? data.custom_str3 || "" : "",
      packId: data.custom_str2 === "credit_pack" ? data.custom_str3 || "" : "",
      credits: data.custom_str4 || "",
      checkoutId,
    };

    const amountCents = data.amount_gross ? Math.round(parseFloat(data.amount_gross) * 100) : undefined;

    return {
      event: eventType,
      reference: data.pf_payment_id || checkoutId,
      metadata,
      amount: amountCents,
    };
  }
}

export function createPayFastProvider(): PayFastProvider | null {
  if (process.env.PAYFAST_ENABLED !== "true") return null;
  if (!process.env.PAYFAST_MERCHANT_ID || !process.env.PAYFAST_MERCHANT_KEY) return null;
  return new PayFastProvider();
}
