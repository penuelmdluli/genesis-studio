// ============================================
// GENESIS STUDIO — Payment reconciliation (every 5 minutes)
// ============================================
// A checkout that is still "pending" ten minutes after it was created is
// either abandoned or paid-but-unnotified. The second case is the one that
// costs customers: on 2026-09-12 two real PayFast card payments completed
// and no ITN ever reached us.
//
//   Yoco    → has a lookup API: verify and settle automatically.
//   PayFast → has no lookup API: raise a Slack alert with the exact
//             settle command so an operator closes it in one call.
//
// Idempotent: settlement goes through processWebhookPayment, which refuses
// to credit a checkout twice.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { isProviderConfigured, getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";
import { sendSlackAlert } from "@/lib/alerts";
import { CREDIT_PACKS } from "@/lib/constants";
import { sqlTimestamp } from "@/lib/job-finalizer";

export const maxDuration = 60;

const MIN_AGE_MIN = 10;
const MAX_AGE_HOURS = 48;

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const newest = sqlTimestamp(new Date(Date.now() - MIN_AGE_MIN * 60_000));
  const oldest = sqlTimestamp(new Date(Date.now() - MAX_AGE_HOURS * 3_600_000));

  const { data: pending } = await db
    .from("pending_checkouts")
    .select("id, provider, user_id, type, product_id, amount, currency, status, created_at")
    .eq("status", "pending")
    .lt("created_at", newest)
    .gt("created_at", oldest)
    .limit(50);

  const out = { checked: 0, settled: 0, alerted: 0, abandoned: 0 };

  for (const c of pending || []) {
    out.checked++;

    if (c.provider === "yoco" && isProviderConfigured("yoco")) {
      try {
        const v = await getProvider("yoco").verifyPayment(c.id);
        if (v.success) {
          const metadata: Record<string, string> = { type: c.type, userId: c.user_id, checkoutId: c.id };
          if (c.type === "subscription") metadata.planId = c.product_id;
          else {
            metadata.packId = c.product_id;
            metadata.credits = String(CREDIT_PACKS.find((p) => p.id === c.product_id)?.credits || 0);
          }
          const r = await processWebhookPayment(
            { event: "payment.success", reference: v.reference || c.id, metadata, amount: v.amount || c.amount },
            "yoco"
          );
          if (r.success) {
            out.settled++;
            continue;
          }
        }
      } catch (err) {
        console.warn(`[RECONCILE] Yoco verify failed for ${c.id}:`, err instanceof Error ? err.message : err);
      }
    }

    // PayFast (or an unverifiable Yoco): a human decides. Alert once by
    // marking the row so the same checkout does not page every 5 minutes.
    if (c.status === "pending") {
      const { data: user } = await db.from("users").select("email").eq("id", c.user_id).maybeSingle();
      await sendSlackAlert({
        level: "warning",
        title: `Unsettled ${c.provider} checkout (${c.type})`,
        message:
          `${user?.email || c.user_id} — ${c.product_id} — ${c.currency} ${(c.amount / 100).toFixed(2)} — created ${c.created_at}\n` +
          `If the payment shows Complete in the ${c.provider} dashboard, settle it:\n` +
          `curl -X POST https://ivideostudio.ai/api/admin/settle-checkout -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" -d '{"checkoutId":"${c.id}"}'`,
      }).catch(() => {});
      await db.from("pending_checkouts").update({ status: "needs_review" }).eq("id", c.id);
      out.alerted++;
    }
  }

  return NextResponse.json(out);
}
