/**
 * Genesis Studio — Tax & Invoicing Helpers
 *
 * Tax strategy:
 * - SA: 15% VAT when revenue exceeds R1M (SARS requirement)
 * - EU: Country-specific VAT via Stripe Tax
 * - US: Sales tax via Stripe Tax
 *
 * Enable Stripe Tax in your Stripe dashboard:
 * 1. Go to Settings → Tax
 * 2. Enable automatic tax calculation
 * 3. Add your business registration (SA VAT number when applicable)
 * 4. Stripe handles all country-specific rates automatically
 */

// South Africa VAT rate
export const SA_VAT_RATE = 0.15;

// VAT registration threshold (SA: R1,000,000 annual turnover)
export const SA_VAT_THRESHOLD_ZAR = 1_000_000;

/**
 * Calculate price with VAT for South African customers.
 */
export function addSAVat(priceZAR: number): { priceExVat: number; vat: number; total: number } {
  const vat = Math.round(priceZAR * SA_VAT_RATE * 100) / 100;
  return {
    priceExVat: priceZAR,
    vat,
    total: priceZAR + vat,
  };
}

/**
 * Extract VAT from a VAT-inclusive price.
 */
export function extractSAVat(inclusivePrice: number): { priceExVat: number; vat: number } {
  const priceExVat = Math.round((inclusivePrice / (1 + SA_VAT_RATE)) * 100) / 100;
  const vat = Math.round((inclusivePrice - priceExVat) * 100) / 100;
  return { priceExVat, vat };
}

/**
 * Determine if Stripe Tax should be enabled for a checkout session.
 * Returns the automatic_tax parameter for Stripe.
 */
export function getStripeTaxConfig(): { automatic_tax: { enabled: boolean } } {
  // Enable when Stripe Tax is configured in dashboard
  const taxEnabled = process.env.STRIPE_TAX_ENABLED === "true";
  return {
    automatic_tax: { enabled: taxEnabled },
  };
}

/**
 * Format a price for display with currency.
 */
export function formatPrice(amount: number, currency: "usd" | "zar" = "usd"): string {
  if (currency === "zar") {
    return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

/**
 * Monthly revenue tracking for VAT threshold monitoring.
 * Call this from admin dashboard to check if VAT registration is needed.
 */
export function checkVatThreshold(annualRevenueZAR: number): {
  needsRegistration: boolean;
  percentOfThreshold: number;
  message: string;
} {
  const pct = (annualRevenueZAR / SA_VAT_THRESHOLD_ZAR) * 100;
  return {
    needsRegistration: annualRevenueZAR >= SA_VAT_THRESHOLD_ZAR,
    percentOfThreshold: Math.round(pct * 10) / 10,
    message: pct >= 100
      ? "VAT registration REQUIRED — you've exceeded the R1M threshold"
      : pct >= 80
        ? `WARNING: At ${pct.toFixed(0)}% of VAT threshold — register soon`
        : `${pct.toFixed(0)}% of VAT threshold — no action needed yet`,
  };
}
