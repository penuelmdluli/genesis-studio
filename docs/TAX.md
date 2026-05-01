# South African VAT & Tax Documentation

## Overview

Genesis Studio is operated from South Africa. This document covers VAT obligations for SA-based SaaS businesses selling to domestic and international customers.

---

## South African VAT

### Rate

- **15% VAT** applies on sales to users located in South Africa.

### Registration Threshold

- VAT registration is **mandatory** once annual taxable turnover exceeds **R1,000,000** (one million rand).
- Below this threshold registration is **not required**, but plan ahead -- once you approach R800k+ annual revenue, begin preparing for registration.
- Voluntary registration is possible below threshold if desired.

### ZAR Pricing (Domestic)

- All ZAR pricing offered via **Yoco** or **PayFast** is treated as **VAT-inclusive**.
- This means the displayed price already includes VAT. No additional tax line is added at checkout.
- Once VAT-registered, the VAT portion must be extracted and remitted to SARS (price / 1.15 * 0.15).

### Stripe Tax

- When approaching the R1M threshold, enable the **Stripe Tax** addon.
- Stripe Tax can automatically calculate, collect, and report VAT based on customer location.
- This simplifies compliance for both domestic and cross-border sales.

---

## International Sales (USD Pricing)

- Sales to customers **outside South Africa** in USD: **no SA VAT applies**.
- These are zero-rated exports of services under SA VAT law.
- Ensure customer billing address / IP geolocation confirms non-SA location.

---

## EU VAT (MOSS / OSS)

- If sales to EU-based consumers exceed **EUR 10,000/year**, EU VAT obligations may be triggered under the One-Stop Shop (OSS) scheme.
- **Action**: Monitor EU revenue quarterly. If approaching the threshold, flag for review and consider registering for OSS via a single EU member state.
- Stripe Tax handles EU VAT calculation automatically when enabled.

---

## Invoices

- Once VAT-registered, all invoices **must** display:
  - Genesis Studio VAT registration number
  - The words "Tax Invoice"
  - Seller name, address, and VAT number
  - Buyer details
  - VAT amount or statement that price is VAT-inclusive
  - Invoice date and unique invoice number
- Stripe and payment providers can be configured to include VAT details on receipts.
- Update invoice templates in Stripe Dashboard under **Settings > Invoices** once registered.

---

## Key Actions

| Milestone | Action |
|---|---|
| Revenue approaching R800k | Begin VAT registration preparation |
| Revenue hits R1M | Register for VAT with SARS |
| After registration | Update invoices, enable Stripe Tax, extract VAT from ZAR prices |
| EU revenue approaching EUR 10k | Evaluate OSS registration |

---

## References

- [SARS VAT Guide](https://www.sars.gov.za/types-of-tax/value-added-tax/)
- [Stripe Tax Documentation](https://stripe.com/docs/tax)
- [EU OSS Scheme](https://vat-one-stop-shop.ec.europa.eu/)
