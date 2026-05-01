# Compliance: POPIA & GDPR

## Overview

Genesis Studio processes personal data of users in South Africa and internationally. This document outlines obligations under POPIA (South Africa) and GDPR (EU/EEA).

---

## POPIA (Protection of Personal Information Act)

### Information Officer

- A named **Information Officer** must appear on the `/privacy` page.
- The Information Officer is responsible for encouraging compliance, handling data subject requests, and liaising with the Information Regulator.
- Register the Information Officer with the [Information Regulator](https://inforegulator.org.za/).

### Data Retention

- Personal data must not be retained longer than necessary for the purpose it was collected.
- Define and document retention periods for each data category (account data, usage logs, generated content).
- Purge or anonymise data when no longer needed.

### Cross-Border Transfers

- POPIA requires disclosure when personal data is transferred outside South Africa.
- All sub-processors listed below are US or EU-based. This constitutes cross-border transfer and must be disclosed in the privacy policy.
- Transfers are permitted where the recipient is subject to comparable data protection laws, binding agreements, or user consent is obtained.

### Data Subject Rights

Users have the right to:

1. **Access** -- request a copy of their personal data
2. **Correction** -- request correction of inaccurate data
3. **Deletion** -- request deletion of their data (right to be forgotten)
4. **Objection** -- object to processing of their data for direct marketing or other purposes

Requests must be responded to within a **reasonable time** (POPIA does not specify exact days, but best practice is 30 days).

### Data Breach Notification

- In the event of a data breach, the **Information Regulator** and affected data subjects must be notified **as soon as reasonably possible**.
- Target: **72 hours** from discovery (aligning with GDPR best practice).
- Document the breach, its scope, and remedial actions taken.

---

## Sub-Processors

The following third-party services process user data on behalf of Genesis Studio:

| Service | Purpose | Location |
|---|---|---|
| **Vercel** | Hosting, edge functions | US |
| **Cloudflare** | CDN, DDoS protection, R2 storage | EU + US |
| **Supabase** | Database, authentication (backend) | US |
| **FAL.AI** | AI video/image generation | US |
| **RunPod** | Serverless GPU inference | US |
| **Stripe** | Payment processing | US |
| **Clerk** | User authentication, session management | US |
| **Resend** | Transactional email delivery | US |
| **Facebook (Meta)** | Social media posting integration | US |

All sub-processors must have Data Processing Agreements (DPAs) in place. Review and update this list whenever a new service is added.

---

## GDPR (General Data Protection Regulation)

Applies when processing data of EU/EEA residents.

### Lawful Basis for Processing

| Processing Activity | Lawful Basis |
|---|---|
| Account creation & authentication | Contract performance |
| Payment processing | Contract performance |
| AI content generation | Contract performance |
| Transactional emails | Legitimate interest |
| Analytics (if enabled) | Consent |
| Marketing emails | Consent |

### Data Processing Agreements

Ensure DPAs are signed with all sub-processors listed above. Most providers offer standard DPAs:

- [Vercel DPA](https://vercel.com/legal/dpa)
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Supabase DPA](https://supabase.com/legal/dpa)
- [Stripe DPA](https://stripe.com/legal/dpa)
- [Clerk DPA](https://clerk.com/legal/dpa)
- [Resend DPA](https://resend.com/legal/dpa)

### Data Subject Rights (GDPR)

Same as POPIA rights above, plus:

- **Data portability** -- provide data in a machine-readable format
- **Restriction of processing** -- pause processing while a complaint is resolved

Response deadline: **30 days** (extendable by 60 days for complex requests).

---

## Cookie Policy

- **Essential cookies only** by default (authentication, session, CSRF).
- Analytics cookies (if any) require **explicit opt-in consent** via a cookie banner.
- No third-party tracking cookies are used.
- Document all cookies in the privacy policy with their purpose and expiry.

---

## Key Actions

| Action | Owner | Status |
|---|---|---|
| Name Information Officer on /privacy | Operator | Pending |
| Register with Information Regulator | Operator | Pending |
| Sign DPAs with all sub-processors | Operator | Pending |
| Implement data export endpoint | Engineering | Pending |
| Implement account deletion flow | Engineering | Pending |
| Add cookie consent banner (if analytics added) | Engineering | Not needed yet |
| Document data retention schedule | Operator | Pending |
