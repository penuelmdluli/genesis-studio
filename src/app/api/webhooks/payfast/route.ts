import { NextRequest, NextResponse } from "next/server";
import { validateITN } from "@/lib/payfast";
import { createSupabaseAdmin } from "@/lib/supabase";
import { addCreditPackCredits, grantSubscriptionCredits } from "@/lib/credits";
import { updateUserPlan } from "@/lib/db";
import { PlanId } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    params.forEach((value, key) => { body[key] = value; });

    // Validate ITN with PayFast
    const isValid = await validateITN(body);
    if (!isValid) {
      console.error("[PAYFAST] Invalid ITN received");
      return NextResponse.json({ error: "Invalid ITN" }, { status: 400 });
    }

    const paymentId = body.m_payment_id || "";
    const paymentStatus = body.payment_status;
    const amountGross = parseFloat(body.amount_gross || "0");

    // Only process completed payments
    if (paymentStatus !== "COMPLETE") {
      console.log(`[PAYFAST] Payment ${paymentId} status: ${paymentStatus} — skipping`);
      return NextResponse.json({ received: true });
    }

    // Parse payment ID: userId_packId/planId_timestamp
    const parts = paymentId.split("_");
    if (parts.length < 3) {
      console.error("[PAYFAST] Invalid payment ID format:", paymentId);
      return NextResponse.json({ received: true });
    }

    const userId = parts[0];
    const productId = parts[1];

    const supabase = createSupabaseAdmin();

    // Determine if this is a credit pack or subscription
    const creditPacks: Record<string, number> = {
      "pack-500": 500,
      "pack-2000": 2000,
      "pack-10000": 10000,
    };

    const planIds: Record<string, PlanId> = {
      "creator": "creator",
      "pro": "pro",
      "studio": "studio",
    };

    if (creditPacks[productId]) {
      // Credit pack purchase
      await addCreditPackCredits(userId, creditPacks[productId], `PayFast: ${creditPacks[productId]} credit pack (R${amountGross})`);
      console.log(`[PAYFAST] Granted ${creditPacks[productId]} credits to ${userId}`);
    } else if (planIds[productId]) {
      // Subscription
      const plan = planIds[productId];
      const creditAmounts: Record<PlanId, number> = { free: 50, creator: 500, pro: 2000, studio: 10000 };
      await updateUserPlan(userId, plan);
      await grantSubscriptionCredits(userId, creditAmounts[plan]);
      console.log(`[PAYFAST] Subscription activated: ${userId} -> ${plan} plan`);
    }

    // Record the PayFast transaction (fire-and-forget)
    try {
      await supabase.from("payfast_transactions").insert({
        user_id: userId,
        payment_id: paymentId,
        pf_payment_id: body.pf_payment_id,
        payment_status: paymentStatus,
        amount_gross: amountGross,
        amount_fee: parseFloat(body.amount_fee || "0"),
        amount_net: parseFloat(body.amount_net || "0"),
        item_name: body.item_name,
        raw_data: body,
      });
    } catch (err) {
      console.error("[PAYFAST] Failed to record transaction:", err);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PAYFAST] Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
