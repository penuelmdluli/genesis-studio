-- MBS Automation v1 — Characters, Jobs, Engagement

CREATE TABLE IF NOT EXISTS mbs_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  portrait_url TEXT NOT NULL,
  description TEXT,
  brand_traits JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mbs_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_video_url TEXT NOT NULL,
  reference_video_duration_sec INT,
  character_id UUID REFERENCES mbs_characters(id),
  prompt TEXT NOT NULL,
  setting TEXT,
  duration_sec INT DEFAULT 10,
  aspect_ratio TEXT DEFAULT '9:16',

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'completed', 'posted', 'failed', 'cancelled')),
  fal_request_id TEXT,
  finished_video_url TEXT,
  facebook_post_id TEXT,
  facebook_post_url TEXT,
  cost_usd NUMERIC(10, 4),

  caption TEXT,
  scheduled_post_at TIMESTAMPTZ,

  error_message TEXT,
  retry_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mbs_jobs_status ON mbs_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mbs_jobs_scheduled ON mbs_jobs(scheduled_post_at)
  WHERE status = 'completed';

CREATE TABLE IF NOT EXISTS mbs_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES mbs_jobs(id),
  facebook_post_id TEXT NOT NULL,
  views INT,
  reactions INT,
  comments INT,
  shares INT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 10 MBS characters (portrait_url = placeholder, Sabelo uploads real ones)
INSERT INTO mbs_characters (name, description, portrait_url, brand_traits) VALUES
  ('Naledi', '4yr old SA girl, joyful, traditional Zulu beaded necklace, vibrant red and yellow outfit', 'https://placehold.co/512x768/7c3aed/white?text=Naledi', '{"colors": ["red", "yellow"], "accessory": "beaded necklace"}'),
  ('Lwazi', '3yr old SA boy, curious explorer, denim dungarees, red sneakers', 'https://placehold.co/512x768/06b6d4/white?text=Lwazi', '{"colors": ["blue", "red"], "accessory": "dungarees"}'),
  ('Zintle', '5yr old SA girl, confident dancer, purple tutu, gold crown', 'https://placehold.co/512x768/a855f7/white?text=Zintle', '{"colors": ["purple", "gold"], "accessory": "crown"}'),
  ('Thando', '4yr old SA boy, gentle, green traditional outfit, wooden bead bracelet', 'https://placehold.co/512x768/22c55e/white?text=Thando', '{"colors": ["green", "brown"], "accessory": "bead bracelet"}'),
  ('Sipho', '3yr old SA boy, energetic, orange soccer jersey, white shorts', 'https://placehold.co/512x768/f97316/white?text=Sipho', '{"colors": ["orange", "white"], "accessory": "soccer ball"}'),
  ('Kgosi', '5yr old SA boy, leader, navy blazer, bow tie, confident stance', 'https://placehold.co/512x768/1e3a5f/white?text=Kgosi', '{"colors": ["navy", "white"], "accessory": "bow tie"}'),
  ('Amahle', '4yr old SA girl, dreamer, sky blue dress, butterfly hairclips', 'https://placehold.co/512x768/38bdf8/white?text=Amahle', '{"colors": ["sky blue", "pink"], "accessory": "butterfly clips"}'),
  ('Nandi', '3yr old SA girl, shy but brave, pink tutu, flower crown', 'https://placehold.co/512x768/ec4899/white?text=Nandi', '{"colors": ["pink", "white"], "accessory": "flower crown"}'),
  ('Zahra', '5yr old SA girl, wise, emerald hijab, gold earrings', 'https://placehold.co/512x768/10b981/white?text=Zahra', '{"colors": ["emerald", "gold"], "accessory": "hijab"}'),
  ('Bandile', '4yr old SA boy, comedian, yellow shirt, oversized sunglasses', 'https://placehold.co/512x768/eab308/white?text=Bandile', '{"colors": ["yellow", "black"], "accessory": "sunglasses"}')
ON CONFLICT (name) DO NOTHING;
