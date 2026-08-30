-- Wallet ownership challenges are one-time, merchant-scoped proofs.
create table if not exists public.pay_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  wallet_address text not null,
  message text not null,
  nonce_hash text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pay_wallet_challenge_window_check check (expires_at > issued_at),
  constraint pay_wallet_challenge_nonce_hash_check check (nonce_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists pay_wallet_challenges_active_wallet_idx
  on public.pay_wallet_challenges (merchant_id, wallet_address)
  where consumed_at is null;

create index if not exists pay_wallet_challenges_expiry_idx
  on public.pay_wallet_challenges (expires_at);

-- The same business event may legitimately be delivered to multiple webhook endpoints.
-- Uniqueness therefore belongs to an endpoint, not to the entire merchant platform.
drop index if exists public.pay_webhook_deliveries_event_id_key;
alter table public.pay_webhook_deliveries drop constraint if exists pay_webhook_deliveries_event_id_key;
create unique index if not exists pay_webhook_deliveries_webhook_event_uidx
  on public.pay_webhook_deliveries (webhook_id, event_id);

-- Prevent direct client access to challenge material and delivery internals.
alter table public.pay_wallet_challenges enable row level security;
alter table public.pay_webhook_deliveries enable row level security;
revoke all on table public.pay_wallet_challenges from anon, authenticated;
revoke all on table public.pay_webhook_deliveries from anon, authenticated;

comment on table public.pay_wallet_challenges is 'Short-lived one-time wallet ownership challenges. Never expose nonce hashes or reusable challenge material to clients after issuance.';
comment on index public.pay_webhook_deliveries_webhook_event_uidx is 'A webhook endpoint may receive each event once; the same event can be delivered to multiple endpoints.';
