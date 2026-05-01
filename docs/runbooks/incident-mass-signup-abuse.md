# Incident: Mass Signup Abuse

## Symptoms
- Sudden spike in new user registrations (Clerk dashboard or analytics)
- Many accounts share the same IP, IP range, or ASN
- Free-tier credits being consumed rapidly across throwaway accounts

## Diagnosis
1. Check Clerk logs for signup volume: filter by last 1-4 hours, sort by creation time
2. Query signups with shared metadata: `SELECT ip_address, COUNT(*) as cnt FROM auth_events WHERE event = 'signup' AND created_at > now() - interval '4 hours' GROUP BY ip_address HAVING COUNT(*) > 5 ORDER BY cnt DESC;`
3. Look up the ASN for top offending IPs (use ipinfo.io or similar)
4. Check if the accounts have already consumed credits or triggered generations

## Fix
- Block offending IPs/ASN at Cloudflare (WAF rule or IP Access Rules)
- In Clerk, suspend the abusive accounts in bulk
- If credits were consumed: no refund needed (they were free-tier)
- Consider enabling Clerk's bot protection or CAPTCHA for signups

## Verification
- Signup rate returns to baseline within 30 minutes
- Blocked IPs receive 403 on signup attempts
- Monitor for rotation to new IPs — escalate to rate-limit by fingerprint if needed
