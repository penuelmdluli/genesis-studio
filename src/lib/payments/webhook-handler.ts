// ============================================
// GENESIS STUDIO — Shared Webhook Processing Logic
// ============================================

import { createSupabaseAdmin } from "@/lib/supabase";
import { grantSubscriptionCredits, addCreditPackCredits } from "@/lib/credits";
import { updateUserPlan } from "@/lib/db";
import { PlanId } from "@/types";
import { WebhookResult } from "./types";

const PLAN_CREDITS: Record<PlanId, number> = {
  free: 50,
  creator: 500,
  pro: 2000,
  studio: 10000,
};

/**
 * Process a verified webhook result — grant credits or update plan.
 * This is shared across all payment provider webhook routes.
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
