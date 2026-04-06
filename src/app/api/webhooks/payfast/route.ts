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
    const pfPaymentId = body.pf_payment_id || "";
    const paymentStatus = body.payment_status;
    const amountGross = parseFloat(body.amount_gross || "0");

    // Only process completed payments
    if (paymentStatus !== "COMPLETE") {
      console.log(`[PAYFAST] Payment ${paymentId} status: ${paymentStatus} — skipping`);
      return NextResponse.json({ received: true });
    }

    const supabase = createSupabaseAdmin();

    // --- Idempotency: check if this PayFast payment was already processed ---
    if (pfPaymentId) {
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("id")
        .eq("reference", pfPaymentId)
        .eq("provider", "payfast")
        .maybeSingle();

      if (existing) {
        console.log(`[PAYFAST] Duplicate ITN skipped (pf_payment_id: ${pfPaymentId})`);
        return NextResponse.json({ received: true });
      }
    }

    // Parse payment ID: userId_packId/planId_timestamp
    const parts = paymentId.split("_");
    if (parts.length < 3) {
      console.error("[PAYFAST] Invalid payment ID format:", paymentId);
      return NextResponse.json({ received: true });
    }

    const userId = parts[0];
    const productId = parts[1];

    // --- User validation: verify user exists before granting credits ---
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .single();

    if (!user) {
      console.error(`[PAYFAST] User not found: ${userId} (payment: ${paymentId})`);
      return NextResponse.json({ received: true });
    }

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
      await addCreditPackCredits(user.id, creditPacks[productId], `PayFast: ${creditPacks[productId]} credit pack (R${amountGross})`);
      console.log(`[PAYFAST] Granted ${creditPacks[productId]} credits to ${user.id}`);
    } else if (planIds[productId]) {
      // Subscription
      const plan = planIds[productId];
      const creditAmounts: Record<PlanId, number> = { free: 50, creator: 500, pro: 2000, studio: 8000 };
      await updateUserPlan(user.id, plan);
      await grantSubscriptionCredits(user.id, creditAmounts[plan]);
      console.log(`[PAYFAST] Subscription activated: ${user.id} -> ${plan} plan`);
    }

    // Record the PayFast transaction
    await supabase.from("payfast_transactions").insert({
      user_id: user.id,
      payment_id: paymentId,
      pf_payment_id: pfPaymentId,
      payment_status: paymentStatus,
      amount_gross: amountGross,
      amount_fee: parseFloat(body.amount_fee || "0"),
      amount_net: parseFloat(body.amount_net || "0"),
      item_name: body.item_name,
      raw_data: body,
    }).then(({ error }) => {
      if (error) console.error("[PAYFAST] Failed to record transaction:", error.message);
    });

    // Record webhook event for idempotency
    if (pfPaymentId) {
      await supabase.from("webhook_events").insert({
        reference: pfPaymentId,
        provider: "payfast",
        event: creditPacks[productId] ? "credit_pack" : "subscription",
        user_id: user.id,
        metadata: { paymentId, productId, amountGross: String(amountGross) },
        processed_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error("[PAYFAST] Failed to record webhook event:", error.message);
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PAYFAST] Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
