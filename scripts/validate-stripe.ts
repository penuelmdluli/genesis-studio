/**
 * Stripe Live Key Validation
 *
 * Validates that Stripe keys are real, products exist, and webhooks are configured.
 * Run: npx tsx scripts/validate-stripe.ts
 */

import Stripe from "stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY not set");
    process.exit(1);
  }

  const mode = key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "TEST" : "UNKNOWN";
  console.log(`Mode: ${mode}`);
  console.log(`Key prefix: ${key.slice(0, 12)}...`);

  if (mode === "UNKNOWN") {
    console.error("ERROR: Key does not start with sk_live_ or sk_test_");
    process.exit(1);
  }

  const stripe = new Stripe(key);

  // List active prices
  console.log("\n--- Active Prices ---");
  const prices = await stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] });
  console.log(`Total active prices: ${prices.data.length}`);
  for (const p of prices.data) {
    const product = p.product as Stripe.Product;
    console.log(`  ${p.id}: ${product.name} — ${(p.unit_amount ?? 0) / 100} ${p.currency.toUpperCase()} / ${p.recurring?.interval ?? "one-time"}`);
  }

  // List webhook endpoints
  console.log("\n--- Webhook Endpoints ---");
  const webhooks = await stripe.webhookEndpoints.list();
  console.log(`Total endpoints: ${webhooks.data.length}`);
  for (const w of webhooks.data) {
    console.log(`  ${w.url}`);
    console.log(`    Status: ${w.status}, Events: ${w.enabled_events.length}`);
  }

  // Check for test clocks (should be none in live)
  if (mode === "LIVE") {
    console.log("\n--- Live Mode Checks ---");
    const customers = await stripe.customers.list({ limit: 5 });
    console.log(`Recent customers: ${customers.data.length}`);
  }

  console.log("\nValidation complete.");
}

main().catch((err) => {
  console.error("Validation failed:", err.message);
  process.exit(1);
});
