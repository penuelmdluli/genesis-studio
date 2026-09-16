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

const API_BASE = "https://api.payfast.co.za";
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
 * MD5 of `key=value&...` for the given keys in the given order, with the
 * passphrase appended when one is set.
 *
 * `keepBlanks` is the difference between the two signatures PayFast uses, and
 * getting it wrong is silent: the checkout form omits empty fields, but an ITN
 * is signed over every field PayFast posts, empty ones included. Skipping them
 * on the way in made every ITN fail verification, answer 400, and be retried
 * for two days - nine deliveries of one payment - while the payments themselves
 * were only settled later by the reconcile sweep.
 */
export function pfSignature(
  params: Record<string, string>,
  order: string[],
  passphrase: string,
  keepBlanks = false
): string {
  const parts: string[] = [];
  for (const key of order) {
    const v = params[key];
    if (v === undefined || v === null) continue;
    if (String(v) === "" && !keepBlanks) continue;
    parts.push(`${key}=${pfEncode(String(v).trim())}`);
  }
  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${pfEncode(passphrase.trim())}`;
  return crypto.createHash("md5").update(str).digest("hex");
}

export interface PayFastTransaction {
  date: string;
  type: string;
  mPaymentId: string;
  pfPaymentId: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
}

/** RFC-4180 row splitter — fields may be quoted and contain commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * The history endpoint answers in CSV. Only money actually received counts:
 * fees, payouts and reversals share the feed and must never credit anyone.
 */
export function parseTransactionCsv(csv: string): PayFastTransaction[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/"/g, "").trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const out: PayFastTransaction[] = [];

  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line).map((v) => v.replace(/^"|"$/g, "").trim());
    const type = f[idx("type")] || "";
    const sign = f[idx("sign")] || "";
    if (type !== "FUNDS_RECEIVED" || sign !== "CREDIT") continue;

    const gross = parseFloat(f[idx("gross")] || "0");
    if (!Number.isFinite(gross) || gross <= 0) continue;

    const metadata: Record<string, string> = {
      userId: f[idx("custom str1")] || "",
      type: f[idx("custom str2")] || "",
      credits: f[idx("custom str4")] || "",
      checkoutId: f[idx("custom str5")] || f[idx("m payment id")] || "",
    };
    const product = f[idx("custom str3")] || "";
    if (metadata.type === "subscription") metadata.planId = product;
    else metadata.packId = product;

    out.push({
      date: f[idx("date")] || "",
      type,
      mPaymentId: f[idx("m payment id")] || "",
      pfPaymentId: f[idx("pf payment id")] || "",
      amountCents: Math.round(gross * 100),
      currency: f[idx("currency")] || "ZAR",
      metadata,
    });
  }
  return out.reverse();
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
    // A plan is a real monthly subscription: PayFast bills the card again
    // every month on its own. Before this, "monthly" plans were one-off
    // payments with a 31-day expiry and a dunning email — every renewal
    // depended on the customer choosing to pay again.
    const isSubscription = params.metadata.type === "subscription" && params.metadata.recurring !== "false";

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

    if (isSubscription) {
      pfParams.subscription_type = "1";
      pfParams.recurring_amount = amountInRands;
      pfParams.frequency = "3"; // monthly
      pfParams.cycles = "0"; // until cancelled
    }

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
   * Look the payment up in PayFast's Transaction History API.
   *
   * This is what makes settlement independent of the ITN. Two real card
   * payments on 2026-09-12 completed on PayFast and no notification ever
   * reached the Worker, so the customer sat uncredited until settled by
   * hand. Polling is not a nicety here — it is the only channel we control.
   */
  async verifyPayment(reference: string): Promise<PaymentVerification> {
    const rows = await this.listTransactions(7);
    const row = rows.find((r) => r.mPaymentId === reference);
    if (!row) return { success: false, amount: 0, reference, metadata: {} };
    return {
      success: true,
      amount: row.amountCents,
      reference: row.pfPaymentId || reference,
      metadata: row.metadata,
    };
  }

  /**
   * Every successful payment in the last `days` days, newest first.
   * Used by verifyPayment and by the reconciliation sweep, which settles
   * first payments AND monthly subscription renewals from the same feed.
   */
  async listTransactions(days = 3): Promise<PayFastTransaction[]> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const query = { from: fmt(from), to: fmt(to) };

    // SAST timestamp; the signature covers the header params, the query
    // params and the passphrase, sorted alphabetically by key.
    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "+02:00");
    const signed: Record<string, string> = {
      "merchant-id": this.merchantId,
      timestamp,
      version: "v1",
      ...query,
    };
    if (this.passphrase) signed.passphrase = this.passphrase;
    const signature = pfSignature(signed, Object.keys(signed).sort(), "");

    const res = await fetch(`${API_BASE}/transactions/history?from=${query.from}&to=${query.to}`, {
      headers: {
        "merchant-id": this.merchantId,
        version: "v1",
        timestamp,
        signature,
      },
    });
    if (!res.ok) {
      throw new Error(`PayFast history API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return parseTransactionCsv(await res.text());
  }

  async handleWebhook(body: unknown, headers: Record<string, string>): Promise<WebhookResult> {
    // The source-IP allowlist is advisory only. PayFast's published ranges
    // lag their real infrastructure, and the signature + validate round
    // trip below already prove the notification is theirs — dropping a
    // genuine ITN over a stale IP list is how a paid customer stays unpaid.
    const sourceIp = headers["cf-connecting-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || "";
    if (sourceIp && !this.isSandbox && !isPayFastIP(sourceIp)) {
      console.warn(`[PAYFAST] ITN from unlisted IP ${sourceIp} — relying on signature + validate`);
    }

    // Insertion order is the order PayFast sent the fields in.
    const data = body as Record<string, string>;
    console.log(
      `[PAYFAST] ITN received: status=${data.payment_status} m_payment_id=${data.m_payment_id} pf_payment_id=${data.pf_payment_id} amount=${data.amount_gross} ip=${sourceIp}`
    );
    const receivedSignature = data.signature;
    const orderedKeys = Object.keys(data).filter((k) => k !== "signature");
    // keepBlanks: an ITN is signed over every field posted, empty ones included.
    const expected = pfSignature(data, orderedKeys, this.passphrase, true);
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
