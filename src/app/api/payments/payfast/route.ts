import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createCreditPackPayment, createSubscriptionPayment, isPayFastConfigured } from "@/lib/payfast";
import { CREDIT_PACKS, PLANS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPayFastConfigured()) {
      return NextResponse.json({ error: "PayFast not configured" }, { status: 503 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { type, productId } = await req.json();
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (type === "credit_pack") {
      const pack = CREDIT_PACKS.find((p) => p.id === productId);
      if (!pack || !pack.priceZAR) {
        return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
      }

      const payment = createCreditPackPayment({
        userId: user.id,
        packId: pack.id,
        packName: `${pack.credits} Credits`,
        amountZAR: pack.priceZAR,
        userEmail: user.email,
        userName: user.name,
        returnUrl: `${appUrl}/settings?payment=success`,
        cancelUrl: `${appUrl}/pricing?payment=cancelled`,
        notifyUrl: `${appUrl}/api/webhooks/payfast`,
      });

      return NextResponse.json(payment);
    }

    if (type === "subscription") {
      const plan = PLANS.find((p) => p.id === productId);
      if (!plan || !plan.priceZAR || plan.id === "free") {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }

      const payment = createSubscriptionPayment({
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        monthlyAmountZAR: plan.priceZAR,
        userEmail: user.email,
        userName: user.name,
        returnUrl: `${appUrl}/settings?payment=success`,
        cancelUrl: `${appUrl}/pricing?payment=cancelled`,
        notifyUrl: `${appUrl}/api/webhooks/payfast`,
      });

      return NextResponse.json(payment);
    }

    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  } catch (error) {
    console.error("[PAYFAST] Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
