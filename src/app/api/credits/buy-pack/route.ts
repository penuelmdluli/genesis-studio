import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createCheckoutSession, createStripeCustomer } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { CREDIT_PACKS } from "@/lib/constants";
import { getProvider, getDefaultProvider } from "@/lib/payments";

const PACK_PRICE_IDS: Record<string, string | undefined> = {
  "pack-500": process.env.STRIPE_CREDIT_PACK_500_PRICE_ID,
  "pack-2000": process.env.STRIPE_CREDIT_PACK_2000_PRICE_ID,
  "pack-10000": process.env.STRIPE_CREDIT_PACK_10000_PRICE_ID,
};

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

    const { packId, provider: providerName } = await req.json();
    const pack = CREDIT_PACKS.find((p) => p.id === packId);

    if (!pack) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const webhookBaseUrl = process.env.APP_URL || appUrl;

    // --- SA payment providers (Yoco, PayFast, Paystack) ---
    if (providerName && providerName !== "stripe") {
      const paymentProvider = getProvider(providerName);
      const priceZAR = pack.priceZAR;
      if (!priceZAR) {
        return NextResponse.json(
          { error: "ZAR pricing not available for this pack" },
          { status: 400 }
        );
      }

      const checkout = await paymentProvider.createCheckout({
        amount: priceZAR * 100, // cents
        currency: "ZAR",
        email: user.email,
        userId: user.id,
        description: `Genesis Studio ${pack.credits} Credit Pack`,
        metadata: {
          type: "credit_pack",
          packId: pack.id,
          credits: String(pack.credits),
          userId: user.id,
        },
        successUrl: `${appUrl}/dashboard?pack_success=true`,
        cancelUrl: `${appUrl}/pricing?cancelled=true`,
        notifyUrl: `${webhookBaseUrl}/api/webhooks/${paymentProvider.name}`,
      });

      return NextResponse.json({ url: checkout.redirectUrl });
    }

    // --- Auto-detect: use first available SA provider if no Stripe config ---
    const priceId = PACK_PRICE_IDS[packId];
    if (!priceId) {
      try {
        const defaultProvider = getDefaultProvider();
        const priceZAR = pack.priceZAR;
        if (!priceZAR) {
          return NextResponse.json(
            { error: "No pricing available for this pack" },
            { status: 400 }
          );
        }

        const checkout = await defaultProvider.createCheckout({
          amount: priceZAR * 100,
          currency: "ZAR",
          email: user.email,
          userId: user.id,
          description: `Genesis Studio ${pack.credits} Credit Pack`,
          metadata: {
            type: "credit_pack",
            packId: pack.id,
            credits: String(pack.credits),
            userId: user.id,
          },
          successUrl: `${appUrl}/dashboard?pack_success=true`,
          cancelUrl: `${appUrl}/pricing?cancelled=true`,
          notifyUrl: `${webhookBaseUrl}/api/webhooks/${defaultProvider.name}`,
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
      priceId,
      mode: "payment",
      successUrl: `${appUrl}/dashboard?pack_success=true`,
      cancelUrl: `${appUrl}/pricing?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Buy pack error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
