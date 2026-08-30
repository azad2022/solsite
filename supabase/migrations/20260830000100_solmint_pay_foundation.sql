-- SolMint Pay foundation schema.
-- This migration intentionally defines the accounting/domain boundary only.
-- Do not expose production Pay endpoints until RLS, auth mapping, verification,
-- webhook processing, and settlement flows have been reviewed.

create extension if not exists pgcrypto;

create table if not exists public.pay_merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public.users(id) on delete restrict,
  business_name text not null,
  slug text not null unique,
  default_checkout_locale text not null default 'fa-IR',
  default_dashboard_locale text not null default 'fa-IR',
  default_fee_payer text not null default 'merchant',
  gateway_fee_bps integer not null default 100,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_merchants_locale_check check (default_checkout_locale in ('fa-IR','en-US','ar','ru','auto')),
  constraint pay_merchants_dashboard_locale_check check (default_dashboard_locale in ('fa-IR','en-US','ar','ru')),
  constraint pay_merchants_fee_payer_check check (default_fee_payer in ('merchant','customer')),
  constraint pay_merchants_fee_bps_check check (gateway_fee_bps between 0 and 10000),
  constraint pay_merchants_status_check check (status in ('pending','active','suspended','closed'))
);

create table if not exists public.pay_merchant_wallets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  address text not null,
  network text not null default 'solana',
  wallet_role text not null default 'receiving',
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, address, wallet_role),
  constraint pay_wallet_role_check check (wallet_role in ('receiving','gas_source'))
);

create table if not exists public.pay_payment_intents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete restrict,
  external_order_id text,
  amount_atomic numeric(78,0) not null,
  asset text not null,
  token_mint text,
  recipient text not null,
  reference text not null unique,
  fee_bps integer not null default 100,
  fee_payer text not null default 'merchant',
  fee_atomic numeric(78,0),
  gas_sponsored boolean not null default false,
  status text not null default 'created',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint pay_payment_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_payment_fee_payer_check check (fee_payer in ('merchant','customer')),
  constraint pay_payment_fee_bps_check check (fee_bps between 0 and 10000),
  constraint pay_payment_amount_check check (amount_atomic > 0),
  constraint pay_payment_status_check check (status in ('created','pending','detected','verifying','confirmed','completed','expired','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','failed','refunded'))
);

create index if not exists pay_payment_intents_merchant_created_idx on public.pay_payment_intents (merchant_id, created_at desc);
create index if not exists pay_payment_intents_status_expires_idx on public.pay_payment_intents (status, expires_at);

create table if not exists public.pay_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pay_payment_intents(id) on delete restrict,
  signature text not null unique,
  slot bigint,
  block_time timestamptz,
  observed_amount_atomic numeric(78,0) not null,
  asset text not null,
  recipient text not null,
  reference_matched boolean not null default false,
  confirmed boolean not null default false,
  raw_observation jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  constraint pay_tx_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_tx_amount_check check (observed_amount_atomic > 0)
);

create index if not exists pay_payment_transactions_payment_idx on public.pay_payment_transactions (payment_id, observed_at desc);

create table if not exists public.pay_payment_links (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  slug text not null unique,
  title text not null,
  fixed_amount_atomic numeric(78,0),
  asset text,
  fee_payer text,
  checkout_locale text not null default 'auto',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_link_asset_check check (asset is null or asset in ('SOL','USDC','USDC')),
  constraint pay_link_fee_payer_check check (fee_payer is null or fee_payer in ('merchant','customer')),
  constraint pay_link_locale_check check (checkout_locale in ('fa-IR','en-US','ar','ru','auto')),
  constraint pay_link_amount_check check (fixed_amount_atomic is null or fixed_amount_atomic > 0)
);

create table if not exists public.pay_invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  invoice_number text not null,
  customer_label text,
  title text not null,
  description text,
  amount_atomic numeric(78,0) not null,
  asset text not null,
  fee_payer text not null default 'merchant',
  checkout_locale text not null default 'auto',
  due_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, invoice_number),
  constraint pay_invoice_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_invoice_fee_payer_check check (fee_payer in ('merchant','customer')),
  constraint pay_invoice_locale_check check (checkout_locale in ('fa-IR','en-US','ar','ru','auto')),
  constraint pay_invoice_status_check check (status in ('draft','open','paid','partially_paid','overdue','void','refunded')),
  constraint pay_invoice_amount_check check (amount_atomic > 0)
);

create table if not exists public.pay_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null,
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  referral_code text not null unique,
  attributed_at timestamptz not null default now(),
  active boolean not null default true,
  unique (affiliate_id, merchant_id)
);

create table if not exists public.pay_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.pay_referrals(id) on delete restrict,
  payment_id uuid not null references public.pay_payment_intents(id) on delete restrict,
  gross_gateway_fee_atomic numeric(78,0) not null,
  commission_bps integer not null,
  commission_atomic numeric(78,0) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  unique (referral_id, payment_id),
  constraint pay_commission_rate_check check (commission_bps between 0 and 10000),
  constraint pay_commission_amount_check check (commission_atomic >= 0),
  constraint pay_commission_status_check check (status in ('pending','approved','paid','void'))
);

create table if not exists public.pay_gas_accounts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.pay_merchants(id) on delete cascade,
  funding_model text not null default 'merchant_funded',
  sol_balance_atomic numeric(78,0) not null default 0,
  daily_limit_atomic numeric(78,0),
  per_payment_limit_atomic numeric(78,0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_gas_model_check check (funding_model in ('merchant_funded','solmint_funded')),
  constraint pay_gas_balance_check check (sol_balance_atomic >= 0),
  constraint pay_gas_daily_limit_check check (daily_limit_atomic is null or daily_limit_atomic >= 0),
  constraint pay_gas_payment_limit_check check (per_payment_limit_atomic is null or per_payment_limit_atomic >= 0)
);

create table if not exists public.pay_webhooks (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  endpoint_url text not null,
  secret_hash text not null,
  active boolean not null default true,
  subscribed_events text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pay_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.pay_webhooks(id) on delete cascade,
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  attempt_count integer not null default 0,
  status text not null default 'pending',
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pay_webhook_delivery_status_check check (status in ('pending','delivering','delivered','failed','dead_letter'))
);

create index if not exists pay_webhook_deliveries_retry_idx on public.pay_webhook_deliveries (status, next_attempt_at);

create table if not exists public.pay_audit_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.pay_merchants(id) on delete set null,
  actor_user_id text references public.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pay_audit_logs_merchant_created_idx on public.pay_audit_logs (merchant_id, created_at desc);

comment on table public.pay_payment_intents is 'Business-level payment intent; never treat a raw blockchain transaction as the accounting record.';
comment on table public.pay_payment_transactions is 'Observed on-chain transactions linked to payment intents after verification.';
comment on table public.pay_commissions is 'Referral liability derived from eligible gateway revenue, not sign-ups alone.';
comment on table public.pay_gas_accounts is 'Gas sponsorship accounting boundary; merchant funds and SolMint treasury funds must remain distinct.';
comment on table public.pay_audit_logs is 'Append-only business audit trail for sensitive Pay operations.';
