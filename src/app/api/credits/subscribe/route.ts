import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createCheckoutSession, createStripeCustomer } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { PLANS } from "@/lib/constants";
import { getProvider, getDefaultProvider } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { planId, provider: providerName } = await req.json();
    const plan = PLANS.find((p) => p.id === planId);

    if (!plan || plan.id === "free") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // --- SA payment providers (Yoco, PayFast, Paystack) ---
    if (providerName && providerName !== "stripe") {
      const paymentProvider = getProvider(providerName);
      const priceZAR = plan.priceZAR;
      if (!priceZAR) {
        return NextResponse.json(
          { error: "ZAR pricing not available for this plan" },
          { status: 400 }
        );
      }

      const checkout = await paymentProvider.createCheckout({
        amount: priceZAR * 100, // cents
        currency: "ZAR",
        email: user.email,
        userId: user.id,
        description: `Genesis Studio ${plan.name} Plan`,
        metadata: {
          type: "subscription",
          planId: plan.id,
          userId: user.id,
        },
        successUrl: `${appUrl}/dashboard?success=true`,
        cancelUrl: `${appUrl}/pricing?cancelled=true`,
        notifyUrl: `${appUrl}/api/webhooks/${paymentProvider.name}`,
      });

      return NextResponse.json({ url: checkout.redirectUrl });
    }

    // --- Auto-detect: use first available SA provider if no Stripe config ---
    if (!plan.stripePriceId) {
      try {
        const defaultProvider = getDefaultProvider();
        const priceZAR = plan.priceZAR;
        if (!priceZAR) {
          return NextResponse.json(
            { error: "No pricing available for this plan" },
            { status: 400 }
          );
        }

        const checkout = await defaultProvider.createCheckout({
          amount: priceZAR * 100,
          currency: "ZAR",
          email: user.email,
          userId: user.id,
          description: `Genesis Studio ${plan.name} Plan`,
          metadata: {
            type: "subscription",
            planId: plan.id,
            userId: user.id,
          },
          successUrl: `${appUrl}/dashboard?success=true`,
          cancelUrl: `${appUrl}/pricing?cancelled=true`,
          notifyUrl: `${appUrl}/api/webhooks/${defaultProvider.name}`,
        });

        return NextResponse.json({ url: checkout.redirectUrl });
      } catch {
        return NextResponse.json(
          { error: "No payment provider available" },
          { status: 500 }
        );
      }
    }

    // --- Stripe fallback (existing logic) ---
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await createStripeCustomer(user.email, user.name);
      customerId = customer.id;

      const supabase = createSupabaseAdmin();
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      mode: "subscription",
      successUrl: `${appUrl}/dashboard?success=true`,
      cancelUrl: `${appUrl}/pricing?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
