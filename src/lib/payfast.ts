// ============================================
// GENESIS STUDIO — PayFast Integration (SA Payments)
// ============================================

import crypto from "crypto";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || "";
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || "";
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || "";
const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX === "true";

const PAYFAST_URL = PAYFAST_SANDBOX
  ? "https://sandbox.payfast.co.za/eng/process"
  : "https://www.payfast.co.za/eng/process";

const PAYFAST_VALIDATE_URL = PAYFAST_SANDBOX
  ? "https://sandbox.payfast.co.za/eng/query/validate"
  : "https://www.payfast.co.za/eng/query/validate";

export interface PayFastPaymentData {
  // Required
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  // Buyer
  name_first?: string;
  name_last?: string;
  email_address?: string;
  // Transaction
  m_payment_id: string; // Our internal payment ID
  amount: string; // ZAR, formatted to 2 decimal places
  item_name: string;
  item_description?: string;
  // Subscription
  subscription_type?: "1" | "2"; // 1 = subscription, 2 = ad-hoc
  billing_date?: string;
  recurring_amount?: string;
  frequency?: "3" | "4" | "5" | "6"; // 3=monthly, 4=quarterly, 5=biannual, 6=annual
  cycles?: string; // 0 = indefinite
  // Security
  signature?: string;
}

/**
 * Generate PayFast payment signature.
 */
function generateSignature(data: Record<string, string>, passphrase?: string): string {
  // Sort alphabetically and create query string (excluding signature and empty values)
  const orderedData = Object.keys(data)
    .filter(key => key !== "signature" && data[key] !== "")
    .sort()
    .map(key => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, "+")}`)
    .join("&");

  const signatureString = passphrase
    ? `${orderedData}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : orderedData;

  return crypto.createHash("md5").update(signatureString).digest("hex");
}

/**
 * Create a one-time credit pack payment via PayFast.
 */
export function createCreditPackPayment(params: {
  userId: string;
  packId: string;
  packName: string;
  amountZAR: number;
  userEmail: string;
  userName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): { url: string; formData: PayFastPaymentData } {
  const paymentData: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    name_first: params.userName.split(" ")[0] || "",
    email_address: params.userEmail,
    m_payment_id: `${params.userId}_${params.packId}_${Date.now()}`,
    amount: params.amountZAR.toFixed(2),
    item_name: params.packName,
    item_description: `Genesis Studio Credit Pack: ${params.packName}`,
  };

  paymentData.signature = generateSignature(paymentData, PAYFAST_PASSPHRASE || undefined);

  return {
    url: PAYFAST_URL,
    formData: paymentData as unknown as PayFastPaymentData,
  };
}

/**
 * Create a subscription payment via PayFast.
 */
export function createSubscriptionPayment(params: {
  userId: string;
  planId: string;
  planName: string;
  monthlyAmountZAR: number;
  userEmail: string;
  userName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): { url: string; formData: PayFastPaymentData } {
  const paymentData: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    name_first: params.userName.split(" ")[0] || "",
    email_address: params.userEmail,
    m_payment_id: `${params.userId}_${params.planId}_${Date.now()}`,
    amount: params.monthlyAmountZAR.toFixed(2),
    item_name: `Genesis Studio ${params.planName} Plan`,
    item_description: `Monthly subscription: ${params.planName}`,
    subscription_type: "1",
    recurring_amount: params.monthlyAmountZAR.toFixed(2),
    frequency: "3", // Monthly
    cycles: "0", // Indefinite
  };

  paymentData.signature = generateSignature(paymentData, PAYFAST_PASSPHRASE || undefined);

  return {
    url: PAYFAST_URL,
    formData: paymentData as unknown as PayFastPaymentData,
  };
}

/**
 * Validate a PayFast ITN (Instant Transaction Notification).
 */
export async function validateITN(body: Record<string, string>): Promise<boolean> {
  // Step 1: Verify signature
  const receivedSignature = body.signature;
  const computedSignature = generateSignature(body, PAYFAST_PASSPHRASE || undefined);

  if (receivedSignature !== computedSignature) {
    console.error("[PAYFAST] Signature mismatch");
    return false;
  }

  // Step 2: Confirm with PayFast servers
  try {
    const params = new URLSearchParams(body);
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const result = await res.text();
    return result.trim() === "VALID";
  } catch (err) {
    console.error("[PAYFAST] Validation request failed:", err);
    return false;
  }
}

/**
 * Check if PayFast is configured.
 */
export function isPayFastConfigured(): boolean {
  return !!(PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY);
}
