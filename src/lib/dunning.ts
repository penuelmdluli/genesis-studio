/**
 * Genesis Studio — Dunning (Failed Payment Recovery)
 *
 * Schedule:
 *   Day 0: Auto-retry charge via Stripe
 *   Day 3: Email "Update your payment method"
 *   Day 7: Downgrade to free plan
 *   Day 30: Archive account (remove from active processing)
 *
 * Triggered by Stripe webhook: invoice.payment_failed
 */

import { getDb } from "./db-driver";
import { sendDunningEmail, sendDowngradeEmail } from "./email-retention";

interface DunningState {
  userId: string;
  stripeCustomerId: string;
  invoiceId: string;
  failedAt: string;
  retryCount: number;
  status: "retry_pending" | "emailed" | "downgraded" | "archived" | "recovered";
}

/**
 * Handle a failed payment event from Stripe.
 * Creates or updates a dunning record.
 */
export async function handleFailedPayment(params: {
  stripeCustomerId: string;
  invoiceId: string;
  userId: string;
  userEmail: string;
  userName: string;
}) {
  const supabase = getDb();

  // Check if dunning record already exists
  const { data: existing } = await supabase
    .from("dunning_records")
    .select("id, retry_count")
    .eq("invoice_id", params.invoiceId)
    .maybeSingle();

  if (existing) {
    // Update retry count
    await supabase
      .from("dunning_records")
      .update({ retry_count: (existing.retry_count || 0) + 1 })
      .eq("id", existing.id);
    return;
  }

  // Create new dunning record
  await supabase.from("dunning_records").insert({
    user_id: params.userId,
    stripe_customer_id: params.stripeCustomerId,
    invoice_id: params.invoiceId,
    failed_at: new Date().toISOString(),
    retry_count: 0,
    status: "retry_pending",
  });

  console.log(`[DUNNING] Payment failed for user ${params.userId}, invoice ${params.invoiceId}`);
}

/**
 * Process dunning records — called by cron job daily.
 * Executes the Day 0/3/7/30 schedule.
 */
export async function processDunningQueue() {
  const supabase = getDb();
  const now = new Date();

  // Get all active dunning records
  const { data: rawRecords } = await supabase
    .from("dunning_records")
    .select("*")
    .in("status", ["retry_pending", "emailed"])
    .order("failed_at", { ascending: true });

  if (!rawRecords || rawRecords.length === 0) return { processed: 0 };

  // Fetch related user data separately (D1 doesn't support join syntax)
  // The original used !inner, so we skip records where the user doesn't exist
  const userIds = [...new Set(rawRecords.map((r: any) => r.user_id).filter(Boolean))];
  let usersMap: Record<string, { email: string; name: string; plan: string }> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name, plan")
      .in("id", userIds);
    for (const u of users ?? []) {
      usersMap[u.id] = { email: u.email, name: u.name, plan: u.plan };
    }
  }
  // Filter out records with no matching user (equivalent to !inner join)
  const records = rawRecords
    .filter((r: any) => usersMap[r.user_id])
    .map((r: any) => ({ ...r, users: usersMap[r.user_id] }));

  let processed = 0;

  for (const record of records) {
    const failedAt = new Date(record.failed_at);
    const daysSinceFailed = Math.floor((now.getTime() - failedAt.getTime()) / 86_400_000);
    const user = record.users as { email: string; name: string; plan: string };

    try {
      if (daysSinceFailed >= 30 && record.status !== "archived") {
        // Day 30: Archive
        await supabase
          .from("dunning_records")
          .update({ status: "archived" })
          .eq("id", record.id);
        console.log(`[DUNNING] Archived user ${record.user_id} after 30 days`);
        processed++;
      } else if (daysSinceFailed >= 7 && record.status !== "downgraded") {
        // Day 7: Downgrade to free
        await supabase
          .from("users")
          .update({ plan: "free", monthly_credits_limit: 100 })
          .eq("id", record.user_id);

        await supabase
          .from("dunning_records")
          .update({ status: "downgraded" })
          .eq("id", record.id);

        if (user?.email) {
          sendDowngradeEmail(user.email, user.name || "Creator").catch((err) =>
            console.error("[DUNNING] Downgrade email failed:", err)
          );
        }
        console.log(`[DUNNING] Downgraded user ${record.user_id} to free after 7 days`);
        processed++;
      } else if (daysSinceFailed >= 3 && record.status === "retry_pending") {
        // Day 3: Send dunning email
        if (user?.email) {
          sendDunningEmail(user.email, user.name || "Creator").catch((err) =>
            console.error("[DUNNING] Email failed:", err)
          );
        }

        await supabase
          .from("dunning_records")
          .update({ status: "emailed" })
          .eq("id", record.id);

        console.log(`[DUNNING] Sent dunning email to user ${record.user_id}`);
        processed++;
      }
    } catch (err) {
      console.error(`[DUNNING] Error processing record ${record.id}:`, err);
    }
  }

  return { processed };
}

/**
 * Mark a dunning record as recovered (payment succeeded).
 */
export async function recoverDunningRecord(invoiceId: string) {
  const supabase = getDb();
  await supabase
    .from("dunning_records")
    .update({ status: "recovered" })
    .eq("invoice_id", invoiceId);
}
