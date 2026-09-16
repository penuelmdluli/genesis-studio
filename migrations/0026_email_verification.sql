-- Free credits are released only after the email address is proven real.
--
-- The 15-16 Sep farm used addresses that almost certainly do not exist
-- (ncrmk395@, jqtvx728@, and two that were not even valid domains). Holding the
-- credits until a link in the inbox is clicked costs a real customer one tap
-- and costs a farm the entire attack.

ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
-- What the account gets the moment it verifies. Risk scoring sets this to 0
-- for a sign-up that already looks like a duplicate, so verifying an address
-- does not buy a farmer their credits back.
ALTER TABLE users ADD COLUMN pending_credits INTEGER DEFAULT 0;

-- Everyone who signed up before this shipped keeps working exactly as before.
UPDATE users SET email_verified = 1, email_verified_at = datetime('now') WHERE COALESCE(suspended,0) = 0;
