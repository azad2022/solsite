-- Canonical wallet ownership challenge schema.
-- This migration intentionally has no foreign keys to Pay tables because the
-- merchant/wallet tables are created by the following foundation migration.
-- Later hardening migrations add/validate cross-table invariants.

create table if not exists public.pay_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  wallet_address text not null,
  message text not null,
  nonce_hash text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  status text not null default 'issued',
  created_at timestamptz not null default now(),
  constraint pay_wallet_challenge_window_check check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes'),
  constraint pay_wallet_challenge_nonce_hash_check check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint pay_wallet_challenge_status_check check (status in ('issued','verified','rejected','expired'))
);

create unique index if not exists pay_wallet_challenges_active_wallet_idx
  on public.pay_wallet_challenges (merchant_id, wallet_address)
  where consumed_at is null;

create index if not exists pay_wallet_challenges_expiry_idx
  on public.pay_wallet_challenges (expires_at);

alter table public.pay_wallet_challenges enable row level security;
revoke all on table public.pay_wallet_challenges from public, anon, authenticated;
