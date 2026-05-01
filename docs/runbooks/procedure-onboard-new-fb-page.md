# Procedure: Onboard a New Facebook Page

## Prerequisites
- Facebook Business account with admin access to the page
- Meta App configured with `pages_manage_posts` and `pages_read_engagement` permissions

## Steps
1. Go to Meta Business Settings > Accounts > Pages — confirm the page is claimed
2. In the Meta App dashboard, add the page to the app's assets
3. Generate a long-lived Page Access Token via the Graph API Explorer:
   - Select the app, request `pages_manage_posts` permission
   - Exchange the short-lived token: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}`
   - Get page token: `GET /me/accounts` — copy the page's `access_token`
4. Store the page token in Supabase `facebook_pages` table: `INSERT INTO facebook_pages (page_id, page_name, access_token, user_id) VALUES (...);`
5. Verify posting works: trigger a test post via the auto-publish flow
6. Set up the page's webhook subscription for engagement tracking (optional)

## Verification
- Test post appears on the Facebook page
- Page shows up in the Genesis Studio dashboard under connected pages
- Token expiry is set to 60+ days (long-lived tokens)
