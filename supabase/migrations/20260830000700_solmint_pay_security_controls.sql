-- Security-control schema for SolMint Pay.
-- This migration is intentionally not executed in production yet. It defines
-- server-enforced boundaries for credentials, rate limits, wallet challenges,
-- webhook delivery and administrative authorization.

create table if not exists public.pay_api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (key_hash),
  constraint pay_api_key_prefix_check check (char_length(key_prefix) between 8 and 32),
  constraint pay_api_key_name_check check (char_length(name) between 1 and 120)
);

create index if not exists pay_api_keys_merchant_idx
  on public.pay_api_keys (merchant_id, created_at desc);

create table if not exists public.pay_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, subject_hash, window_started_at),
  constraint pay_rate_request_count_check check (request_count >= 0)
);

create index if not exists pay_rate_limit_lookup_idx
  on public.pay_rate_limit_buckets (scope, subject_hash, window_started_at desc);

alter table public.pay_webhooks
  add column if not exists status text not null default 'active',
  add column if not exists failure_count integer not null default 0,
  add column if not exists disabled_at timestamptz,
  add constraint pay_webhooks_status_check check (status in ('active','paused','disabled'));

alter table public.pay_webhook_deliveries
  add column if not exists response_status integer,
  add column if not exists response_hash text,
  add column if not exists error_code text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add constraint pay_webhook_attempt_count_check check (attempt_count >= 0);

-- Wallet ownership challenges are one-time authentication artifacts. A partial
-- uniqueness rule prevents multiple active challenges from being consumed for
-- the same wallet simultaneously.
create unique index if not exists pay_wallet_challenges_active_wallet_uidx
  on public.pay_wallet_ownership_challenges (wallet_id)
  where status = 'issued' and consumed_at is null;

-- Do not allow a verified wallet to be deleted casually; production workflows
-- must first rotate/disable all active payment destinations.
alter table public.pay_merchant_wallets
  add column if not exists deactivated_at timestamptz;

comment on table public.pay_api_keys is 'Merchant-scoped bearer credentials. Only one-way key digests are persisted.';
comment on table public.pay_rate_limit_buckets is 'Persistent server-side rate limiting state; callers must use stable hashes for subjects.';
comment on table public.pay_webhook_deliveries is 'At-least-once delivery records with bounded retry metadata and operational lock fields.';
