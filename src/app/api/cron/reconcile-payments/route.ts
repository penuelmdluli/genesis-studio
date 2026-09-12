// ============================================
// GENESIS STUDIO — Payment reconciliation (every 5 minutes)
// ============================================
// Settlement does not depend on webhooks any more.
//
//   Pass 1 — PayFast: pull the Transaction History API and credit every
//            payment we have not credited yet, keyed on PayFast's own
//            payment id. This catches first payments AND monthly
//            subscription renewals, and it is the only channel we control:
//            three real card payments on 2026-09-12 completed at PayFast
//            and not one ITN ever reached the Worker.
//
//   Pass 2 — Yoco: verify each pending checkout through its lookup API.
//
//   Pass 3 — anything still pending after 30 minutes is escalated to the
//            owner by email and Slack, once, and marked needs_review.
//
// Everything runs through processWebhookPayment, which refuses to credit
// the same payment or the same checkout twice.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { isProviderConfigured, getProvider } from "@/lib/payments";
import { processWebhookPayment } from "@/lib/payments/webhook-handler";
import { PayFastProvider } from "@/lib/payments/payfast";
import { sendSlackAlert } from "@/lib/alerts";
import { notifyOwner } from "@/lib/owner-notify";
import { CREDIT_PACKS } from "@/lib/constants";
import { sqlTimestamp } from "@/lib/job-finalizer";

export const maxDuration = 60;

const ESCALATE_AFTER_MIN = 30;
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
  const out = {
    payfast: { seen: 0, settled: 0, alreadyDone: 0, failed: 0 },
    yoco: { checked: 0, settled: 0 },
    escalated: 0,
  };

  // ── Pass 1: PayFast transaction feed ───────────────────────────────────
  if (isProviderConfigured("payfast")) {
    try {
      const provider = getProvider("payfast") as PayFastProvider;
      const rows = await provider.listTransactions(3);
      out.payfast.seen = rows.length;

      for (const row of rows) {
        if (!row.metadata.userId || !row.metadata.type) continue;

        // Keyed on PayFast's payment id: a renewal is a new payment for the
        // same checkout, so it must settle again — but never twice.
        const reference = row.pfPaymentId || row.mPaymentId;
        const { data: seen } = await db
          .from("webhook_events")
          .select("id")
          .eq("reference", reference)
          .eq("provider", "payfast")
          .maybeSingle();
        if (seen) {
          out.payfast.alreadyDone++;
          continue;
        }

        const metadata = { ...row.metadata };
        if (metadata.type === "credit_pack" && !metadata.credits) {
          metadata.credits = String(CREDIT_PACKS.find((p) => p.id === metadata.packId)?.credits || 0);
        }

        // A monthly renewal is a NEW payment against the SAME checkout id.
        // processWebhookPayment refuses to settle a checkout that is already
        // completed — correct for a replayed first payment, fatal for a
        // renewal. Once the original is settled, the pf_payment_id check
        // above is the idempotency guard, so the checkout id is dropped and
        // the renewal is allowed to extend the plan.
        if (metadata.checkoutId) {
          const { data: firstSettled } = await db
            .from("pending_checkouts")
            .select("status")
            .eq("id", metadata.checkoutId)
            .maybeSingle();
          if (firstSettled?.status === "completed") {
            console.log(`[RECONCILE] ${reference} is a renewal of ${metadata.checkoutId}`);
            delete metadata.checkoutId;
          }
        }

        const result = await processWebhookPayment(
          { event: "payment.success", reference, metadata, amount: row.amountCents },
          "payfast"
        );
        if (result.success) {
          out.payfast.settled++;
          console.log(`[RECONCILE] PayFast ${reference} settled from transaction feed: ${result.message}`);
        } else {
          out.payfast.failed++;
          console.error(`[RECONCILE] PayFast ${reference} could not settle: ${result.message}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[RECONCILE] PayFast feed failed:", msg);
      // A broken feed means payments stop settling — that is an outage.
      await notifyOwner({
        subject: "Payment reconciliation is failing",
        title: "PayFast transaction feed unreachable",
        body: `The 5-minute reconciliation could not read the PayFast transaction history, so new payments will not be credited automatically until this is fixed.<br><br><code>${msg}</code>`,
        severity: "critical",
      }).catch(() => {});
    }
  }

  // ── Pass 2: Yoco lookups for checkouts still pending ───────────────────
  const oldest = sqlTimestamp(new Date(Date.now() - MAX_AGE_HOURS * 3_600_000));
  const { data: pending } = await db
    .from("pending_checkouts")
    .select("id, provider, user_id, type, product_id, amount, currency, status, created_at")
    .eq("status", "pending")
    .gt("created_at", oldest)
    .limit(50);

  for (const c of pending || []) {
    if (c.provider !== "yoco" || !isProviderConfigured("yoco")) continue;
    out.yoco.checked++;
    try {
      const v = await getProvider("yoco").verifyPayment(c.id);
      if (!v.success) continue;
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
      if (r.success) out.yoco.settled++;
    } catch (err) {
      console.warn(`[RECONCILE] Yoco verify failed for ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Pass 3: escalate what is still unpaid-or-unexplained ───────────────
  const escalateBefore = sqlTimestamp(new Date(Date.now() - ESCALATE_AFTER_MIN * 60_000));
  const { data: stuck } = await db
    .from("pending_checkouts")
    .select("id, provider, user_id, type, product_id, amount, currency, created_at")
    .eq("status", "pending")
    .lt("created_at", escalateBefore)
    .gt("created_at", oldest)
    .limit(20);

  for (const c of stuck || []) {
    const { data: user } = await db.from("users").select("email").eq("id", c.user_id).maybeSingle();
    const amount = `${c.currency || "ZAR"} ${(c.amount / 100).toFixed(2)}`;
    await notifyOwner({
      subject: `Checkout not settled — ${user?.email || c.user_id}`,
      title: `Unsettled ${c.provider} checkout`,
      body:
        `<strong>${user?.email || c.user_id}</strong> started a ${c.type} checkout (${c.product_id}, ${amount}) ${ESCALATE_AFTER_MIN}+ minutes ago and it has not settled.<br><br>` +
        `Most likely they abandoned it. If the payment shows as complete in the ${c.provider} dashboard, settle it with:<br>` +
        `<code>POST /api/admin/settle-checkout {"checkoutId":"${c.id}"}</code>`,
      severity: "warning",
    }).catch(() => {});
    await sendSlackAlert({
      level: "warning",
      title: `Unsettled ${c.provider} checkout`,
      message: `${user?.email || c.user_id} — ${c.product_id} — ${amount} — ${c.id}`,
    }).catch(() => {});
    await db.from("pending_checkouts").update({ status: "needs_review" }).eq("id", c.id);
    out.escalated++;
  }

  if (out.payfast.settled || out.yoco.settled || out.escalated) {
    console.log(`[RECONCILE] ${JSON.stringify(out)}`);
  }
  return NextResponse.json(out);
}
