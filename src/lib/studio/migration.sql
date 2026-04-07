-- Studio Content Engine tables
CREATE TABLE IF NOT EXISTS studio_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  niche TEXT NOT NULL CHECK (niche IN ('news', 'finance', 'motivation', 'entertainment')),
  is_active BOOLEAN DEFAULT true,
  follower_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  niche TEXT NOT NULL,
  topic TEXT NOT NULL,
  headline TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  source TEXT,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id UUID REFERENCES studio_trends(id),
  page_id UUID REFERENCES studio_pages(id),
  niche TEXT NOT NULL,
  script TEXT NOT NULL,
  raw_video_url TEXT,
  branded_video_url TEXT,
  watermark_applied BOOLEAN DEFAULT false,
  caption TEXT,
  production_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','scripted','generating','branding','ready','posted','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES studio_videos(id),
  page_id UUID REFERENCES studio_pages(id),
  facebook_post_id TEXT,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','posted','failed')),
  views INTEGER DEFAULT 0,
  reactions INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  performance_score DECIMAL DEFAULT 0,
  pinned_comment_posted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
