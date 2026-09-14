-- Brand Kit: a paid creator's own logo on their own videos.
-- Free accounts cannot set one; the columns simply stay null.
ALTER TABLE users ADD COLUMN brand_logo_url TEXT;
ALTER TABLE users ADD COLUMN brand_name TEXT;
ALTER TABLE users ADD COLUMN brand_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN brand_position TEXT DEFAULT 'bottom-right';
