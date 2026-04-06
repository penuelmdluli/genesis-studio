// ============================================
// GENESIS STUDIO — Shared Webhook Processing Logic
// ============================================
// Handles credit granting for Yoco, Paystack, and PayFast.
// Includes idempotency protection to prevent double-crediting.

import { createSupabaseAdmin } from "@/lib/supabase";
import { grantSubscriptionCredits, addCreditPackCredits } from "@/lib/credits";
import { updateUserPlan } from "@/lib/db";
import { PlanId } from "@/types";
import { PLANS, CREDIT_PACKS } from "@/lib/constants";
import { WebhookResult } from "./types";

const PLAN_CREDITS: Record<PlanId, number> = {
  free: 50,
  creator: 500,
  pro: 2000,
  studio: 8000,
};

/**
 * Check if a webhook has already been processed (idempotency guard).
 * Returns true if this is a DUPLICATE — caller should skip processing.
 */
async function isDuplicateWebhook(
  reference: string,
  provider: string
): Promise<boolean> {
  if (!reference) return false;
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("reference", reference)
    .eq("provider", provider)
    .maybeSingle();
  return !!data;
}

/**
 * Record a processed webhook to prevent future duplicates.
 */
async function recordWebhookEvent(
  reference: string,
  provider: string,
  event: string,
  userId: string,
  metadata: Record<string, string>
): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("webhook_events").insert({
    reference,
    provider,
    event,
    user_id: userId,
    metadata,
    processed_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error(`[${provider.toUpperCase()}] Failed to record webhook event:`, error.message);
  });
}

/**
 * Verify the payment amount matches expected pricing.
 * Returns true if amount is valid (or if amount is not provided — some providers omit it).
 */
function verifyPaymentAmount(
  result: WebhookResult,
  providerName: string
): boolean {
  if (!result.amount || result.amount <= 0) return true; // Amount not provided, skip check

  const { metadata } = result;
  const paymentType = metadata.type;

  if (paymentType === "subscription") {
    const plan = PLANS.find((p) => p.id === metadata.planId);
    if (!plan?.priceZAR) return true; // Can't verify without ZAR price
    const expectedCents = plan.priceZAR * 100;
    // Allow 5% tolerance for rounding/fees
    if (Math.abs(result.amount - expectedCents) > expectedCents * 0.05) {
      console.error(
        `[${providerName.toUpperCase()}] Amount mismatch: expected ${expectedCents} cents, got ${result.amount} cents (plan: ${metadata.planId})`
      );
      return false;
    }
  }

  if (paymentType === "credit_pack") {
    const pack = CREDIT_PACKS.find((p) => p.id === metadata.packId);
    if (!pack?.priceZAR) return true;
    const expectedCents = pack.priceZAR * 100;
    if (Math.abs(result.amount - expectedCents) > expectedCents * 0.05) {
      console.error(
        `[${providerName.toUpperCase()}] Amount mismatch: expected ${expectedCents} cents, got ${result.amount} cents (pack: ${metadata.packId})`
      );
      return false;
    }
  }

  return true;
}

/**
 * Process a verified webhook result — grant credits or update plan.
 * This is shared across all payment provider webhook routes.
 *
 * Security layers:
 * 1. Signature verified by provider-specific handler (before this function)
 * 2. Idempotency check (prevents double-crediting on webhook replay)
 * 3. Amount verification (prevents crediting wrong amount)
 * 4. User existence check (prevents crediting ghost accounts)
 */
export async function processWebhookPayment(
  result: WebhookResult,
  providerName: string
): Promise<{ success: boolean; message: string }> {
  if (result.event !== "payment.success") {
    console.log(
      `[${providerName.toUpperCase()}] Non-success event: ${result.event} (ref: ${result.reference})`
    );
    return { success: true, message: `Event ${result.event} acknowledged` };
  }

  // --- Idempotency: skip if already processed ---
  if (await isDuplicateWebhook(result.reference, providerName)) {
    console.log(
      `[${providerName.toUpperCase()}] Duplicate webhook skipped (ref: ${result.reference})`
    );
    return { success: true, message: "Duplicate webhook — already processed" };
  }

  // --- Amount verification ---
  if (!verifyPaymentAmount(result, providerName)) {
    return { success: false, message: "Payment amount does not match expected price" };
  }

  const { metadata } = result;
  const userId = metadata.userId;

  if (!userId) {
    console.error(
      `[${providerName.toUpperCase()}] No userId in webhook metadata (ref: ${result.reference})`
    );
    return { success: false, message: "Missing userId in metadata" };
  }

  const supabase = createSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (!user) {
    console.error(
      `[${providerName.toUpperCase()}] User not found: ${userId}`
    );
    return { success: false, message: "User not found" };
  }

  const paymentType = metadata.type; // "subscription" or "credit_pack"

  if (paymentType === "subscription") {
    const planId = metadata.planId as PlanId;
    if (!planId || !PLAN_CREDITS[planId]) {
      console.error(
        `[${providerName.toUpperCase()}] Invalid planId: ${planId}`
      );
      return { success: false, message: "Invalid plan" };
    }

    await updateUserPlan(user.id, planId);
    await grantSubscriptionCredits(user.id, PLAN_CREDITS[planId]);

    // Record successful processing for idempotency
    await recordWebhookEvent(result.reference, providerName, "subscription", user.id, metadata);

    console.log(
      `[${providerName.toUpperCase()}] Subscription activated: user ${user.id}, plan ${planId}, ${PLAN_CREDITS[planId]} credits`
    );
    return {
      success: true,
      message: `Subscription ${planId} activated for user ${user.id}`,
    };
  }

  if (paymentType === "credit_pack") {
    const packId = metadata.packId;
    const credits = parseInt(metadata.credits || "0", 10);

    if (!credits || credits <= 0) {
      console.error(
        `[${providerName.toUpperCase()}] Invalid credit amount for pack ${packId}`
      );
      return { success: false, message: "Invalid credit amount" };
    }

    await addCreditPackCredits(
      user.id,
      credits,
      `${credits} credit pack (${providerName})`
    );

    // Record successful processing for idempotency
    await recordWebhookEvent(result.reference, providerName, "credit_pack", user.id, metadata);

    console.log(
      `[${providerName.toUpperCase()}] Credit pack purchased: user ${user.id}, ${credits} credits (pack ${packId})`
    );
    return {
      success: true,
      message: `${credits} credits added for user ${user.id}`,
    };
  }

  console.warn(
    `[${providerName.toUpperCase()}] Unknown payment type: ${paymentType} (ref: ${result.reference})`
  );
  return { success: false, message: `Unknown payment type: ${paymentType}` };
}
