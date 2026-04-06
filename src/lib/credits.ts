// ============================================
// GENESIS STUDIO — Credit Ledger System
// ============================================

import { createSupabaseAdmin } from "./supabase";
import { CreditTransactionType } from "@/types";
import { sendLowCreditsEmail } from "./email";

function getSupabase() {
  return createSupabaseAdmin();
}

/** Check if a user is an owner (skips credit deduction, costs still tracked). */
export function isOwnerClerkId(clerkId: string): boolean {
  const ownerIds = process.env.OWNER_CLERK_IDS?.split(",").filter(s => s.trim()).map((s) => s.trim()) ?? [];
  return ownerIds.includes(clerkId);
}

export function isOwnerUserId(userId: string, clerkId: string): boolean {
  return isOwnerClerkId(clerkId);
}

export async function getCreditBalance(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Failed to get credit balance: ${error.message}`);
  return data.credit_balance;
}

export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string,
  description: string
): Promise<{ success: boolean; newBalance: number }> {
  // Atomic deduction: only succeeds if balance >= amount at write time.
  // Uses .gte filter to prevent race conditions where two concurrent
  // requests could both read a sufficient balance and both deduct.
  const { data: user, error: userError } = await getSupabase()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(`Failed to get user: ${userError.message}`);

  if (user.credit_balance < amount) {
    return { success: false, newBalance: user.credit_balance };
  }

  const newBalance = user.credit_balance - amount;

  // Atomic update: only applies if credit_balance still >= amount (prevents double-spend)
  const { data: updated, error: updateError } = await getSupabase()
    .from("users")
    .update({
      credit_balance: newBalance,
    })
    .eq("id", userId)
    .gte("credit_balance", amount)
    .select("credit_balance")
    .single();

  if (updateError || !updated) {
    // Balance changed between read and write — re-read actual balance
    const { data: fresh } = await getSupabase()
      .from("users")
      .select("credit_balance")
      .eq("id", userId)
      .single();
    return { success: false, newBalance: fresh?.credit_balance ?? 0 };
  }

  const actualNewBalance = updated.credit_balance;

  // Record transaction
  await recordTransaction(
    userId,
    "generation_debit",
    -amount,
    actualNewBalance,
    description,
    jobId
  );

  // Send low-credits warning when balance drops below 10 (fire-and-forget)
  if (actualNewBalance < 10 && actualNewBalance + amount >= 10) {
    Promise.resolve(
      getSupabase()
        .from("users")
        .select("email, name")
        .eq("id", userId)
        .single()
    )
      .then(({ data }) => {
        if (data?.email) {
          sendLowCreditsEmail(data.email, data.name || "Creator", actualNewBalance).catch((err) =>
            console.error("[CREDITS] Low credits email failed:", err)
          );
        }
      })
      .catch((err) => console.error("[CREDITS] Low credits lookup failed:", err));
  }

  return { success: true, newBalance: actualNewBalance };
}

export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string,
  description: string
): Promise<number> {
  const { data: user, error: userError } = await getSupabase()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(`Failed to get user: ${userError.message}`);

  const newBalance = user.credit_balance + amount;

  const { error: updateError } = await getSupabase()
    .from("users")
    .update({ credit_balance: newBalance })
    .eq("id", userId);

  if (updateError)
    throw new Error(`Failed to refund credits: ${updateError.message}`);

  await recordTransaction(
    userId,
    "generation_refund",
    amount,
    newBalance,
    description,
    jobId
  );

  return newBalance;
}

export async function grantSubscriptionCredits(
  userId: string,
  credits: number
): Promise<number> {
  const { data: user, error: userError } = await getSupabase()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(`Failed to get user: ${userError.message}`);

  const newBalance = user.credit_balance + credits;

  const { error: updateError } = await getSupabase()
    .from("users")
    .update({
      credit_balance: newBalance,
      monthly_credits_used: 0,
    })
    .eq("id", userId);

  if (updateError)
    throw new Error(`Failed to grant credits: ${updateError.message}`);

  await recordTransaction(
    userId,
    "subscription_grant",
    credits,
    newBalance,
    `Monthly subscription credit grant: ${credits} credits`
  );

  return newBalance;
}

export async function addCreditPackCredits(
  userId: string,
  credits: number,
  packName: string
): Promise<number> {
  const { data: user, error: userError } = await getSupabase()
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(`Failed to get user: ${userError.message}`);

  const newBalance = user.credit_balance + credits;

  const { error: updateError } = await getSupabase()
    .from("users")
    .update({ credit_balance: newBalance })
    .eq("id", userId);

  if (updateError)
    throw new Error(`Failed to add credits: ${updateError.message}`);

  await recordTransaction(
    userId,
    "pack_purchase",
    credits,
    newBalance,
    `Credit pack purchase: ${packName}`
  );

  return newBalance;
}

async function recordTransaction(
  userId: string,
  type: CreditTransactionType,
  amount: number,
  balance: number,
  description: string,
  jobId?: string
) {
  const { error } = await getSupabase().from("credit_transactions").insert({
    user_id: userId,
    type,
    amount,
    balance,
    description,
    job_id: jobId,
  });

  if (error)
    console.error("Failed to record credit transaction:", error.message);
}

export async function getTransactionHistory(
  userId: string,
  limit = 50,
  offset = 0
) {
  const { data, error } = await getSupabase()
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get transactions: ${error.message}`);
  return data;
}
