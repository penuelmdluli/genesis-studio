// ============================================
// GENESIS STUDIO — Daily Spend Cap
// Defense-in-depth: prevents runaway costs even
// if credit limits are somehow bypassed.
// ============================================

import { getDb } from "./db-driver";
import { sendSlackAlert } from "./alerts";

const CREDIT_TO_USD = 0.024;

const DAILY_USD_CAP: Record<string, number> = {
  free: 0.50,
  creator: 5.00,
  pro: 15.00,
  studio: 40.00,
};

export class DailySpendCapExceeded extends Error {
  constructor(
    public readonly userId: string,
    public readonly tier: string,
    public readonly spentUsd: number,
    public readonly capUsd: number
  ) {
    super(
      `Daily spend cap reached: $${spentUsd.toFixed(2)} / $${capUsd.toFixed(2)} (${tier} tier)`
    );
    this.name = "DailySpendCapExceeded";
  }
}

export async function assertWithinDailyBudget(
  userId: string,
  tier: string
): Promise<void> {
  const cap = DAILY_USD_CAP[tier] ?? DAILY_USD_CAP.free;
  const sinceIso = new Date(Date.now() - 86_400_000).toISOString();

  const supabase = getDb();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "generation_debit")
    .gte("created_at", sinceIso);

  if (error) {
    console.error("[spend-guard] Failed to query daily spend, allowing through:", error.message);
    return;
  }

  const spentCredits = (data ?? []).reduce(
    (sum: any, row: any) => sum + Math.abs(row.amount),
    0
  );
  const spentUsd = spentCredits * CREDIT_TO_USD;

  if (spentUsd >= cap) {
    sendSlackAlert({
      level: "warning",
      title: "Daily spend cap reached",
      message: `User ${userId} (${tier}) hit $${spentUsd.toFixed(2)} / $${cap.toFixed(2)} cap`,
      context: { userId, tier, spentUsd, cap },
    }).catch(() => {});
    throw new DailySpendCapExceeded(userId, tier, spentUsd, cap);
  }
}
