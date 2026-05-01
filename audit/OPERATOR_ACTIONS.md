# Operator Actions (Manual)

Actions that require manual operator intervention and could not be automated. Complete these before or shortly after launch.

---

## One-Time Setup

### 1. Sentry Account Setup

- Create a Sentry project for Genesis Studio at [sentry.io](https://sentry.io).
- Obtain the DSN and set the `SENTRY_DSN` environment variable in Vercel.
- Verify errors are flowing by triggering a test error in development.

### 2. Status Page Setup

- Set up a public status page using **BetterStack** (recommended) or **Instatus**.
- Configure monitors for: app (genesisstudio.app), API endpoints, Supabase, payment processing.
- Add the status page URL to the app footer and support documentation.

### 3. Verify Supabase PITR is Enabled

- Log into the Supabase dashboard and navigate to **Database > Backups**.
- Confirm that **Point-in-Time Recovery (PITR)** is enabled on the production project.
- PITR requires a Pro plan or higher. If not enabled, upgrade and enable it immediately.

### 4. Verify Stripe Keys are Live

- Confirm that the Stripe keys in production environment variables use the `sk_live_` and `pk_live_` prefixes.
- Test mode keys (`sk_test_`, `pk_test_`) must **never** be used in production.
- Verify by checking the Vercel environment variables or running a test charge.

### 5. Name POPIA Information Officer

- Update the `/privacy` page to include the named Information Officer (full name, contact email).
- Register the Information Officer with the [Information Regulator](https://inforegulator.org.za/).
- This is a legal requirement under POPIA for any entity processing personal information.

### 6. Run Mail Tester on Outbound Email

- Send a test email from the production Resend setup to [mail-tester.com](https://www.mail-tester.com/).
- Target a score of **9/10 or higher**.
- Fix any issues flagged: SPF, DKIM, DMARC records, content formatting, blacklist presence.

### 7. Set Up GitHub Branch Protection on Main

- Go to the GitHub repository **Settings > Branches > Branch protection rules**.
- Add a rule for `main` with:
  - Require pull request reviews before merging (at least 1 approval)
  - Require status checks to pass (CI/lint/tests)
  - Do not allow force pushes
  - Do not allow deletions

### 8. Consider Custom R2 Domain

- Evaluate setting up a custom domain for Cloudflare R2 storage: `cdn.genesisstudio.app`.
- This provides branded URLs for generated video assets instead of default R2 URLs.
- Configure via Cloudflare dashboard: **R2 > Custom Domains**.

### 9. Review and Approve PRs Before Merge

- All pull requests to `main` must be reviewed and approved by the operator before merging.
- Check for: security issues, environment variable leaks, breaking changes, cost implications.
- Automated checks (CI, linting, tests) must pass before review.

---

## Monthly Recurring Actions

### 10. Rotate Secrets Per Schedule

- Review and rotate the following on a monthly or quarterly basis:
  - Supabase service role key
  - Stripe webhook signing secret
  - Clerk secret key
  - Resend API key
  - FAL.AI API key
  - RunPod API key
- Update rotated secrets in Vercel environment variables and redeploy.
- Document the rotation date in a secure log.

### 11. Review Cost Dashboard

- Monthly review of costs across all services:
  - **Vercel**: bandwidth, function invocations, edge middleware
  - **Supabase**: database size, bandwidth, auth MAUs
  - **Cloudflare R2**: storage volume, egress
  - **FAL.AI / RunPod**: GPU compute spend vs. credit revenue
  - **Stripe**: transaction fees, disputes
  - **Clerk**: MAU count vs. plan limits
  - **Resend**: email volume
- Flag any unexpected spikes or cost overruns.
- Compare GPU spend against credit revenue to ensure positive unit economics.

---

## Checklist Summary

| # | Action | Frequency | Status |
|---|---|---|---|
| 1 | Sentry setup + SENTRY_DSN | One-time | Pending |
| 2 | Status page setup | One-time | Pending |
| 3 | Verify Supabase PITR | One-time | Pending |
| 4 | Verify Stripe live keys | One-time | Pending |
| 5 | Name POPIA Information Officer | One-time | Pending |
| 6 | Run mail-tester.com | One-time | Pending |
| 7 | GitHub branch protection | One-time | Pending |
| 8 | Custom R2 domain | One-time | Pending |
| 9 | Review PRs before merge | Ongoing | Pending |
| 10 | Rotate secrets | Monthly | Pending |
| 11 | Review cost dashboard | Monthly | Pending |
