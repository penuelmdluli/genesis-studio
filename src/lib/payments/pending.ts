// ============================================
// GENESIS STUDIO — Pending checkout records
// ============================================
// One row per checkout we hand a customer off to. See migrations/0008.

import { getDb } from "@/lib/db-driver";

export interface PendingCheckout {
  id: string;
  provider: string;
  user_id: string;
  type: "subscription" | "credit_pack";
  product_id: string;
  amount: number;
  currency: string;
  metadata: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
}

export async function recordPendingCheckout(params: {
  checkoutId: string;
  provider: string;
  userId: string;
  type: "subscription" | "credit_pack";
  productId: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}): Promise<void> {
  const { error } = await getDb().from("pending_checkouts").insert({
    id: params.checkoutId,
    provider: params.provider,
    user_id: params.userId,
    type: params.type,
    product_id: params.productId,
    amount: params.amount,
    currency: params.currency,
    metadata: JSON.stringify(params.metadata),
    status: "pending",
  });
  // Never block a checkout on bookkeeping — the webhook path does not need
  // this row, it only makes the verify path and the admin view possible.
  if (error) console.error("[PAYMENTS] Failed to record pending checkout:", error.message);
}

/** Pending checkouts for a user, newest first, no older than `withinHours`. */
export async function listPendingCheckouts(
  userId: string,
  withinHours = 72
): Promise<PendingCheckout[]> {
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();
  const { data } = await getDb()
    .from("pending_checkouts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data || []) as PendingCheckout[];
}

export async function getPendingCheckout(checkoutId: string): Promise<PendingCheckout | null> {
  const { data } = await getDb()
    .from("pending_checkouts")
    .select("*")
    .eq("id", checkoutId)
    .maybeSingle();
  return (data as PendingCheckout | null) || null;
}

export async function markCheckout(
  checkoutId: string,
  status: "completed" | "failed"
): Promise<void> {
  if (!checkoutId) return;
  await getDb()
    .from("pending_checkouts")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", checkoutId);
}
