# ivideostudio.ai — Domain Setup

## Status: Zone active on Cloudflare, needs DNS + redirect configuration

Zone ID: `e7cb33878e4d0a328185c298f08ef019`
Nameservers: `elaine.ns.cloudflare.com`, `lou.ns.cloudflare.com`

## Step 1: Add DNS Records (Cloudflare Dashboard, 2 min)

Go to: **Cloudflare Dashboard → ivideostudio.ai → DNS → Records**

Add these two records:

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `@` (or `ivideostudio.ai`) | `192.0.2.1` | Proxied (orange) | Auto |
| CNAME | `www` | `ivideostudio.ai` | Proxied (orange) | Auto |

The `192.0.2.1` IP is a dummy — Cloudflare will intercept the request before it reaches this IP because we're setting up a redirect rule.

## Step 2: Create Redirect Rule (Cloudflare Dashboard, 3 min)

Go to: **Cloudflare Dashboard → ivideostudio.ai → Rules → Redirect Rules → Create Rule**

**Rule 1: Root domain redirect**
- Rule name: `Redirect to Genesis Studio`
- When: `Hostname equals ivideostudio.ai` OR `Hostname equals www.ivideostudio.ai`
- Then: **Dynamic redirect**
  - Expression: `concat("https://genesisstudio.app", http.request.uri.path)`
  - Status code: `301` (permanent)
  - Preserve query string: Yes

This redirects:
- `ivideostudio.ai/` → `genesisstudio.app/`
- `ivideostudio.ai/pricing` → `genesisstudio.app/pricing`
- `www.ivideostudio.ai/anything` → `genesisstudio.app/anything`

## Step 3: Enable SSL (automatic, 1 min)

Go to: **Cloudflare Dashboard → ivideostudio.ai → SSL/TLS**
- Set mode to: **Full (strict)**
- Cloudflare auto-provisions a certificate for `ivideostudio.ai` + `*.ivideostudio.ai`
- Wait ~2 min for cert to issue

## Step 4: Verify (2 min)

```bash
# Root redirect
curl -I https://ivideostudio.ai/
# Expect: 301 → https://genesisstudio.app/

# www redirect
curl -I https://www.ivideostudio.ai/
# Expect: 301 → https://genesisstudio.app/

# Path preservation
curl -I https://ivideostudio.ai/pricing
# Expect: 301 → https://genesisstudio.app/pricing
```

## Future: Full Migration (NOT NOW)

If you later want `ivideostudio.ai` as the primary domain:
1. Add as custom domain in Vercel
2. Update Clerk domain settings
3. Update R2 CORS origins
4. Update CSP headers
5. Update Yoco webhook URLs
6. Update Facebook app redirect URIs
7. Update DKIM/SPF/DMARC DNS records
8. Update all hardcoded references in code

This is a 2-3 hour project. Do it only after brand decision is final.
For now, the 301 redirect captures all traffic and sends it to the working site.
