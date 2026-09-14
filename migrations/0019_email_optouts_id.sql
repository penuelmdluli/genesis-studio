-- The D1 shim adds an `id` to every insert; without the column, opt-outs
-- silently failed to save.
ALTER TABLE email_optouts ADD COLUMN id TEXT;
