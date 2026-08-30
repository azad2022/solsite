-- SolMint Pay security controls.
-- This migration intentionally does NOT expose Pay tables to browser clients.
-- The existing SolMint application uses server-owned authentication, so Pay
-- sensitive operations must execute through server functions with explicit
-- merchant authorization.

-- API credentials: only a one-way hash is persisted. The plaintext secret is
-- returned once at creation and must never be recoverable from the database.
create table if not exists public.pay_api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{payments:read,payments:write}',
  status text not null default 'active',
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint pay_api_key_prefix_check check (key_prefix ~ '^[A-Za-z0-9_-]{4,32}$'),
  constraint pay_api_key_status_check check (status in ('active','revoked','expired')),
  constraint pay_api_key_expiry_check check (expires_at is null or expires_at > created_at)
);

create index if not exists pay_api_keys_merchant_status_idx
  on public.pay_api_keys (merchant_id, status);

-- One-time wallet ownership challenges. A consumed/expired challenge can never
-- be reused to authenticate another request.
alter table public.pay_wallet_ownership_challenges
  add column if not exists signature_base58 text,
  add column if not exists signer_public_key text,
  add column if not exists rejection_reason text;

create unique index if not exists pay_wallet_challenge_verified_uidx
  on public.pay_wallet_ownership_challenges (merchant_id, wallet_id)
  where status = 'verified';

-- Rate limiting/cost-control state is server-owned and coarse-grained. Exact
-- enforcement can additionally use Cloudflare rate limiting at the edge.
create table if not exists public.pay_security_counters (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  bucket_start timestamptz not null,
  counter integer not null default 0,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_key, bucket_start),
  constraint pay_security_counter_nonnegative check (counter >= 0)
);

create index if not exists pay_security_counters_lookup_idx
  on public.pay_security_counters (bucket_key, bucket_start desc);

-- Browser clients must not query or mutate Pay financial tables directly. All
-- operations flow through authorized server endpoints.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pay_merchants', 'pay_merchant_wallets', 'pay_payment_intents',
    'pay_payment_transactions', 'pay_payment_transfers', 'pay_payment_links',
    'pay_invoices', 'pay_referrals', 'pay_commissions', 'pay_gas_accounts',
    'pay_gas_ledger', 'pay_webhooks', 'pay_webhook_deliveries',
    'pay_payment_events', 'pay_revenue_ledger', 'pay_idempotency_keys',
    'pay_affiliates', 'pay_wallet_ownership_challenges', 'pay_api_keys',
    'pay_security_counters', 'pay_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

comment on table public.pay_api_keys is 'Server-only API credentials. Persist only a one-way hash; raw secrets are never recoverable.';
comment on table public.pay_security_counters is 'Server/edge rate-limit state. Do not expose to browser roles.';
