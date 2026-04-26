-- Webhook event idempotency table
-- Prevents double-processing of Stripe/payment webhooks
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  provider text not null,
  event text,
  user_id text,
  metadata jsonb default '{}',
  processed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Unique constraint for idempotency: same event from same provider = skip
create unique index idx_webhook_events_ref_provider
  on public.webhook_events(reference, provider);
