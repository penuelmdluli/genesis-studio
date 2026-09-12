# Facebook App Review — submission checklist

Everything on the code side is built and deployed. What remains is done in
Meta's dashboard by a person with admin rights on the Business account.

**Why this matters:** `pages_manage_posts` does nothing for anyone outside
your own app testers until Meta approves it. Until then "Connect Page"
returns a clear "not switched on yet" message rather than a broken flow.

Typical timeline: **1–3 weeks**, longer if Business Verification is not done.

---

## 1. What is already live on our side

| Requirement | Status | Where |
|---|---|---|
| Privacy Policy URL | ✅ live | `https://ivideostudio.ai/privacy` (§6 covers Page data) |
| Terms of Service URL | ✅ live | `https://ivideostudio.ai/terms` |
| Data Deletion Request callback | ✅ live | `POST https://ivideostudio.ai/api/auth/facebook/data-deletion` |
| Deauthorize callback | ✅ live | `POST https://ivideostudio.ai/api/auth/facebook/deauthorize` |
| Facebook Login flow | ✅ built | `/api/auth/facebook/start` → `/callback` |
| OAuth redirect URI | ✅ built | `https://ivideostudio.ai/api/auth/facebook/callback` |
| Page token storage + disconnect | ✅ built | `social_connections` table, `/api/auth/facebook/disconnect` |
| Signed-request verification | ✅ built | HMAC-SHA256, timing-safe compare |

Both Meta callbacks verify the signature before deleting anything, which is
what their reviewer tests.

## 2. In the Meta dashboard (developers.facebook.com)

1. **Create or open the app** → type **Business**.
2. **Business Verification** — start this first, it is the slowest step.
   Needs company documents for DEVEDGE SOLUTIONS.
3. **Add product → Facebook Login for Business.**
4. **Settings → Basic:**
   - Privacy Policy URL: `https://ivideostudio.ai/privacy`
   - Terms of Service URL: `https://ivideostudio.ai/terms`
   - User Data Deletion → **Data Deletion Request URL**:
     `https://ivideostudio.ai/api/auth/facebook/data-deletion`
   - App Domain: `ivideostudio.ai`
   - Category: Business / Productivity
5. **Facebook Login → Settings:**
   - Valid OAuth Redirect URI: `https://ivideostudio.ai/api/auth/facebook/callback`
   - Deauthorize Callback URL: `https://ivideostudio.ai/api/auth/facebook/deauthorize`
   - Client OAuth Login: **On**, Web OAuth Login: **On**
   - Enforce HTTPS: **On**
6. **Copy the credentials to the Worker** (I can do this once you paste them):
   ```
   npx wrangler secret put FACEBOOK_APP_ID
   npx wrangler secret put FACEBOOK_APP_SECRET
   ```
   Nothing appears in the product until both are set — that is deliberate.

## 3. Permissions to request

Request exactly these three, with this justification:

| Permission | What to tell Meta |
|---|---|
| `pages_show_list` | "So the creator can choose which of their own Pages to publish to. We show the list returned by `/me/accounts` and store only the Page they pick." |
| `pages_manage_posts` | "To publish a video the creator made in iVideo Studio to their own Page, only when they press Publish. We never post without an explicit action." |
| `pages_read_engagement` | "To show the creator views and reactions on the posts they published through us, so they can see what worked." |

Do **not** request `pages_read_user_content`, `publish_to_groups`, or
anything about profiles or friends — extra scopes are the usual reason a
review is rejected.

## 4. The screencast they require

Record one continuous take (2–3 minutes, English, no cuts):

1. Sign in at `ivideostudio.ai` as a normal user.
2. Generate a short video (or open one from Gallery).
3. **Settings → Connect Facebook Page** → the Facebook consent dialog →
   grant → land back showing the connected Page name.
4. Publish that video to the Page.
5. Open the Page on Facebook and show the post is there.
6. **Settings → Disconnect** → show it is gone.

Step 6 matters: reviewers look for the person being able to revoke access.

## 5. Test users

Add a **Test User** or your own account under **Roles → Testers** so the
reviewer can sign in without your real password. Give them credentials in
the submission notes.

## 6. After approval

- Set `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` as Worker secrets.
- Switch the app from Development to **Live** mode.
- The Connect Page button becomes active on its own — no deploy needed,
  because the UI keys off whether the credentials are configured.

---

## Common rejection reasons, avoided here

- **No data deletion callback** — built and signature-verified.
- **Privacy policy that doesn't mention the Page data** — §6 states exactly
  what is taken, why, and how to remove it.
- **Asking for more than you use** — three scopes, each used.
- **Screencast that doesn't show revocation** — step 6 above.
