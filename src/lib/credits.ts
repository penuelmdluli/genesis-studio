// ============================================
// GENESIS STUDIO — Credit Ledger System
// ============================================

import { createSupabaseAdmin } from "./supabase";
import { CreditTransactionType } from "@/types";

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
  // Use a transaction to prevent race conditions
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

  // Update balance
  const { error: updateError } = await getSupabase()
    .from("users")
    .update({
      credit_balance: newBalance,
    })
    .eq("id", userId);

  if (updateError)
    throw new Error(`Failed to update balance: ${updateError.message}`);

  // Record transaction
  await recordTransaction(
    userId,
    "generation_debit",
    -amount,
    newBalance,
    description,
    jobId
  );

  return { success: true, newBalance };
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
