# DNS Records — genesisstudio.app

## Current Records (managed by Vercel + Cloudflare)

| Type | Name | Value | Proxy | Notes |
|---|---|---|---|---|
| A | genesisstudio.app | Vercel IPs | N/A | Vercel manages |
| CNAME | www | cname.vercel-dns.com | N/A | www redirect |
| TXT | _vercel | dn-xxx | N/A | Domain verification |

## Recommended Additions

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | @ | v=spf1 include:_spf.resend.com ~all | SPF for email |
| CNAME | resend._domainkey | via Resend dashboard | DKIM signing |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@genesisstudio.app | DMARC monitoring |
| CNAME | cdn | (R2 custom domain) | Future: cdn.genesisstudio.app for R2 |
| CAA | @ | 0 issue "letsencrypt.org" | Certificate authority restriction |

## R2 Custom Domain Plan

When ready to migrate from `pub-*.r2.dev` to `cdn.genesisstudio.app`:
1. Cloudflare Dashboard → R2 → genesis-videos → Settings → Custom Domains → Connect Domain
2. Enter `cdn.genesisstudio.app`, ensure proxied (orange cloud)
3. Wait for cert provisioning (~2 min)
4. Update Vercel env: `R2_PUBLIC_URL=https://cdn.genesisstudio.app`
5. Redeploy
6. Verify: `curl -I https://cdn.genesisstudio.app/<key>.mp4`
