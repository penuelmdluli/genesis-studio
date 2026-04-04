import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { grantSubscriptionCredits, addCreditPackCredits } from "@/lib/credits";
import { updateUserPlan } from "@/lib/db";
import { PlanId } from "@/types";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        // Find user by Stripe customer ID
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!user) break;

        if (session.mode === "subscription") {
          // Subscription checkout
          const subscription = await getStripe().subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = subscription.items.data[0]?.price.id;

          // Determine plan from price ID
          const planMap: Record<string, PlanId> = {
            [process.env.STRIPE_CREATOR_PRICE_ID!]: "creator",
            [process.env.STRIPE_PRO_PRICE_ID!]: "pro",
            [process.env.STRIPE_STUDIO_PRICE_ID!]: "studio",
          };

          const plan = planMap[priceId] || "creator";
          const creditAmounts: Record<PlanId, number> = {
            free: 50,
            creator: 500,
            pro: 2000,
            studio: 10000,
          };

          await updateUserPlan(
            user.id,
            plan,
            customerId,
            session.subscription as string
          );

          await grantSubscriptionCredits(user.id, creditAmounts[plan]);
        } else if (session.mode === "payment") {
          // One-time credit pack purchase
          const packCredits: Record<string, number> = {
            [process.env.STRIPE_CREDIT_PACK_500_PRICE_ID!]: 500,
            [process.env.STRIPE_CREDIT_PACK_2000_PRICE_ID!]: 2000,
            [process.env.STRIPE_CREDIT_PACK_10000_PRICE_ID!]: 10000,
          };

          const lineItems = await getStripe().checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0]?.price?.id;

          if (priceId && packCredits[priceId]) {
            await addCreditPackCredits(
              user.id,
              packCredits[priceId],
              `${packCredits[priceId]} credit pack`
            );
          }
        }
        break;
      }

      case "invoice.paid": {
        // Recurring subscription payment — grant monthly credits
        // IMPORTANT: Only handle renewal cycles here.
        // Initial subscription is handled by checkout.session.completed above.
        // billing_reason "subscription_create" = first invoice (skip to avoid double-credit)
        // billing_reason "subscription_cycle" = recurring renewal (grant credits)
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user && invoice.billing_reason === "subscription_cycle") {
          const creditAmounts: Record<string, number> = {
            free: 50,
            creator: 500,
            pro: 2000,
            studio: 10000,
          };
          const credits = creditAmounts[user.plan] || 0;
          if (credits > 0) {
            await grantSubscriptionCredits(user.id, credits);
            console.log(`[STRIPE] Granted ${credits} monthly credits to user ${user.id} (${user.plan} plan renewal)`);
          }
        } else if (user && invoice.billing_reason === "subscription_create") {
          // Skip — initial subscription credits already granted by checkout.session.completed
          console.log(`[STRIPE] Skipping invoice.paid for initial subscription (user ${user.id})`);
        }
        break;
      }

      case "customer.subscription.updated": {
        // Handle plan upgrades/downgrades mid-cycle
        const updatedSub = event.data.object as Stripe.Subscription;
        const updatedCustomerId = updatedSub.customer as string;

        const { data: updatedUser } = await supabase
          .from("users")
          .select("*")
          .eq("stripe_customer_id", updatedCustomerId)
          .single();

        if (updatedUser && updatedSub.status === "active") {
          const priceId = updatedSub.items.data[0]?.price.id;
          const planMap: Record<string, PlanId> = {
            [process.env.STRIPE_CREATOR_PRICE_ID!]: "creator",
            [process.env.STRIPE_PRO_PRICE_ID!]: "pro",
            [process.env.STRIPE_STUDIO_PRICE_ID!]: "studio",
          };
          const newPlan = planMap[priceId];
          if (newPlan && newPlan !== updatedUser.plan) {
            await updateUserPlan(updatedUser.id, newPlan, updatedCustomerId, updatedSub.id);
            console.log(`[STRIPE] Plan changed: user ${updatedUser.id} ${updatedUser.plan} → ${newPlan}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          // Downgrade to free plan but keep existing credits
          await updateUserPlan(user.id, "free", customerId);
          console.log(`[STRIPE] Subscription cancelled: user ${user.id} downgraded to free`);
        }
        break;
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
