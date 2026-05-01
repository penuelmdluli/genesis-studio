# Procedure: Handle POPIA Data Subject Request

## When This Applies
- A user (data subject) requests access to or deletion of their personal data
- Required under South Africa's Protection of Personal Information Act (POPIA)
- Must respond within 30 days of receiving the request

## Steps — Access Request
1. Verify the requester's identity (email match, ID document if needed)
2. Export user data from all systems:
   - Clerk: user profile, login history
   - Supabase: `users`, `generation_jobs`, `credit_transactions`, `subscriptions`
   - Stripe: payment history (`GET /v1/customers/{id}`)
   - R2: list stored video files for the user
3. Compile into a structured format (JSON or PDF) and send to the user's verified email

## Steps — Deletion Request
1. Verify identity as above
2. Delete or anonymize records:
   - Clerk: delete user account
   - Supabase: delete rows from `generation_jobs`, `credit_transactions`; anonymize `users` row
   - R2: delete all video/image files belonging to the user
   - Stripe: delete customer (or retain minimal records required for tax compliance)
3. Retain only what is legally required (tax invoices for 5 years per SARS)
4. Confirm deletion to the user in writing

## Verification
- All personal data removed or anonymized within 30 days
- Confirmation email sent to the data subject
- Log the request in the POPIA register for audit purposes
