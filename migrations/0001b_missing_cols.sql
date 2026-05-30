ALTER TABLE dev_trending_topics ADD COLUMN niches TEXT;
ALTER TABLE mbs_source_creators ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE support_tickets ADD COLUMN user_email TEXT;
ALTER TABLE support_tickets ADD COLUMN user_name TEXT;
ALTER TABLE support_tickets ADD COLUMN user_plan TEXT;
ALTER TABLE support_tickets ADD COLUMN ai_response TEXT;
ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT;
ALTER TABLE support_tickets ADD COLUMN source TEXT;
