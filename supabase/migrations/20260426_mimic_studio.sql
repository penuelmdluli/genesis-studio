-- Mimic Studio: customer-facing motion transfer
create table public.mimic_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  character_image_url text not null,
  reference_video_url text,
  reference_source_url text,

  prompt text,
  duration_sec int default 10,
  aspect_ratio text default '9:16',
  keep_video_sound boolean default true,

  status text not null default 'pending' check (status in (
    'pending', 'scraping', 'submitted', 'processing', 'completed', 'failed'
  )),

  fal_request_id text,
  output_video_url text,
  gallery_video_id uuid,

  credits_charged int default 1500,
  cost_usd numeric(10,4),

  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index idx_mimic_jobs_user on public.mimic_jobs(user_id);
create index idx_mimic_jobs_status on public.mimic_jobs(status);
