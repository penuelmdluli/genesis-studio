// ============================================
// GENESIS STUDIO — Payment Provider Registry
// ============================================

import { PaymentProvider } from "./types";
import { createYocoProvider } from "./yoco";
import { createPayFastProvider } from "./payfast";
import { createPaystackProvider } from "./paystack";

// Re-export types for convenience
export type {
  PaymentProvider,
  CheckoutParams,
  CheckoutResult,
  PaymentVerification,
  WebhookResult,
} from "./types";

/**
 * Provider factory registry. Order determines default provider priority:
 * Yoco first (primary SA provider), then PayFast, then Paystack.
 */
const providerFactories: Array<{
  name: string;
  create: () => PaymentProvider | null;
}> = [
  { name: "yoco", create: createYocoProvider },
  { name: "payfast", create: createPayFastProvider },
  { name: "paystack", create: createPaystackProvider },
];

// Cached provider instances
const providerCache = new Map<string, PaymentProvider>();

/**
 * Get a specific payment provider by name.
 * Throws if the provider is not configured.
 */
export function getProvider(name: string): PaymentProvider {
  if (providerCache.has(name)) {
    return providerCache.get(name)!;
  }

  const factory = providerFactories.find((f) => f.name === name);
  if (!factory) {
    throw new Error(`Unknown payment provider: ${name}`);
  }

  const provider = factory.create();
  if (!provider) {
    throw new Error(
      `Payment provider "${name}" is not configured. Check environment variables.`
    );
  }

  providerCache.set(name, provider);
  return provider;
}

/**
 * Get the default (first configured) payment provider.
 * Returns Yoco if configured, then PayFast, then Paystack.
 */
export function getDefaultProvider(): PaymentProvider {
  for (const factory of providerFactories) {
    const provider = factory.create();
    if (provider) {
      providerCache.set(factory.name, provider);
      return provider;
    }
  }
  throw new Error(
    "No payment provider is configured. Set YOCO_SECRET_KEY, PAYFAST_MERCHANT_ID/KEY, or PAYSTACK_SECRET_KEY."
  );
}

/**
 * Get all configured/available payment providers.
 */
export function getAvailableProviders(): PaymentProvider[] {
  const available: PaymentProvider[] = [];
  for (const factory of providerFactories) {
    const provider = factory.create();
    if (provider) {
      providerCache.set(factory.name, provider);
      available.push(provider);
    }
  }
  return available;
}

/**
 * Check if a specific provider is available (env vars configured).
 */
export function isProviderAvailable(name: string): boolean {
  const factory = providerFactories.find((f) => f.name === name);
  if (!factory) return false;
  return factory.create() !== null;
}
