# Incident: Email Deliverability Drop

## Symptoms
- Users report not receiving transactional emails (welcome, receipts, password reset)
- Email open rates drop significantly in Resend/provider dashboard
- Emails landing in spam folders

## Diagnosis
1. Check Resend (or current provider) dashboard for bounce/complaint rates
2. Verify DNS records: SPF, DKIM, and DMARC must all pass — use https://mxtoolbox.com
3. Check if sending domain/IP is on any blocklists: https://mxtoolbox.com/blacklists.aspx
4. Review recent email content changes — spam filters may flag new wording

## Fix
- If DNS misconfigured: fix SPF/DKIM/DMARC records in Cloudflare DNS
- If blocklisted: submit delisting requests to the relevant blocklist operators
- If complaint rate high: review and reduce email frequency, add easy unsubscribe
- If provider issue: switch to backup sending domain or escalate with provider support

## Verification
- Send test emails to Gmail, Outlook, Yahoo — confirm inbox delivery
- SPF/DKIM/DMARC all show "pass" in email headers
- Bounce rate returns below 2% within 24-48 hours
