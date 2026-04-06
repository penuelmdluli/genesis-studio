import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { grantSubscriptionCredits, addCreditPackCredits } from "@/lib/credits";
import { sendPlanUpgradeEmail } from "@/lib/email";
import { updateUserPlan } from "@/lib/db";
import { PlanId } from "@/types";
import { handleFailedPayment, recoverDunningRecord } from "@/lib/dunning";
import Stripe from "stripe";

/** Idempotency guard — returns true if this Stripe event was already processed. */
async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("reference", eventId)
    .eq("provider", "stripe")
    .maybeSingle();
  return !!data;
}

async function recordStripeEvent(eventId: string, eventType: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("webhook_events").insert({
    reference: eventId,
    provider: "stripe",
    event: eventType,
    user_id: userId,
    metadata: { eventType },
    processed_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error("[STRIPE] Failed to record webhook event:", error.message);
  });
}

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

  // --- Idempotency: skip if this exact Stripe event was already processed ---
  if (await isStripeEventProcessed(event.id)) {
    console.log(`[STRIPE] Duplicate event skipped: ${event.id} (${event.type})`);
    return NextResponse.json({ received: true });
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
            studio: 8000,
          };

          await updateUserPlan(
            user.id,
            plan,
            customerId,
            session.subscription as string
          );

          await grantSubscriptionCredits(user.id, creditAmounts[plan]);
          await recordStripeEvent(event.id, "checkout.subscription", user.id);

          // Send plan upgrade email
          if (user.email) {
            sendPlanUpgradeEmail(user.email, user.name || "Creator", plan).catch((err) =>
              console.error("[STRIPE] Failed to send plan upgrade email:", err)
            );
          }
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
            await recordStripeEvent(event.id, "checkout.credit_pack", user.id);
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
            studio: 8000,
          };
          const credits = creditAmounts[user.plan] || 0;
          if (credits > 0) {
            await grantSubscriptionCredits(user.id, credits);
            await recordStripeEvent(event.id, "invoice.renewal", user.id);
            console.log(`[STRIPE] Granted ${credits} monthly credits to user ${user.id} (${user.plan} plan renewal)`);
          }
        } else if (user && invoice.billing_reason === "subscription_create") {
          // Skip — initial subscription credits already granted by checkout.session.completed
          console.log(`[STRIPE] Skipping invoice.paid for initial subscription (user ${user.id})`);
        }

        // Recover dunning record if payment succeeds after a previous failure
        recoverDunningRecord(invoice.id).catch(() => {});
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

            // Send plan change email
            if (updatedUser.email) {
              sendPlanUpgradeEmail(updatedUser.email, updatedUser.name || "Creator", newPlan).catch((err) =>
                console.error("[STRIPE] Failed to send plan change email:", err)
              );
            }
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

      case "invoice.payment_failed": {
        // Dunning: handle failed payment
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const { data: user } = await supabase
          .from("users")
          .select("id, email, name")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          handleFailedPayment({
            stripeCustomerId: customerId,
            invoiceId: invoice.id,
            userId: user.id,
            userEmail: user.email || "",
            userName: user.name || "Creator",
          }).catch((err) => console.error("[STRIPE] Dunning record failed:", err));
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
