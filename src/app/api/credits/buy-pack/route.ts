import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createCheckoutSession, createStripeCustomer } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { CREDIT_PACKS } from "@/lib/constants";

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

    const { packId } = await req.json();
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    const priceId = PACK_PRICE_IDS[packId];

    if (!pack || !priceId) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    // Create or get Stripe customer
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
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?pack_success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=true`,
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
