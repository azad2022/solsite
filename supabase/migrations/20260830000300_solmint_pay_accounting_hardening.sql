-- Second accounting hardening pass.
-- This migration closes gaps found during the adversarial review of the Pay foundation.

-- A merchant can create the same external order only once, while different
-- merchants may legitimately reuse the same order id.
-- (Index was created in the previous hardening migration.)

-- Explicit linkage from payment intents to higher-level merchant objects.
alter table public.pay_payment_intents
  add column if not exists payment_link_id uuid references public.pay_payment_links(id) on delete restrict,
  add column if not exists invoice_id uuid references public.pay_invoices(id) on delete restrict;

create index if not exists pay_payment_intents_link_idx
  on public.pay_payment_intents (payment_link_id)
  where payment_link_id is not null;

create index if not exists pay_payment_intents_invoice_idx
  on public.pay_payment_intents (invoice_id)
  where invoice_id is not null;

-- Idempotency is persistent state, not only an HTTP convention. The same
-- merchant, endpoint scope and key must deterministically replay the original
-- logical result instead of creating a second financial operation.
create table if not exists public.pay_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing',
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint pay_idempotency_status_check check (status in ('processing','completed','failed')),
  unique (merchant_id, scope, idempotency_key)
);

create index if not exists pay_idempotency_created_idx
  on public.pay_idempotency_keys (created_at desc);

-- Affiliates are first-class entities so referral attribution does not point at
-- an untracked UUID. payout identity can later be added without changing the
-- merchant/payment accounting tables.
create table if not exists public.pay_affiliates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text references public.users(id) on delete set null,
  display_name text not null,
  referral_code text not null unique,
  commission_rate_bps integer not null default 2000,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_affiliate_rate_check check (commission_rate_bps between 0 and 10000),
  constraint pay_affiliate_status_check check (status in ('pending','active','suspended','closed'))
);

alter table public.pay_referrals
  add constraint pay_referrals_affiliate_fk
  foreign key (affiliate_id) references public.pay_affiliates(id) on delete restrict;

create index if not exists pay_referrals_affiliate_idx
  on public.pay_referrals (affiliate_id, attributed_at desc);

-- A single Solana transaction can contain multiple value transfers: for
-- customer-paid fees it may transfer the merchant amount and SolMint fee in
-- the same atomic transaction. Model transfer legs explicitly instead of
-- overloading one transaction row with one recipient.
create table if not exists public.pay_payment_transfers (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.pay_payment_transactions(id) on delete restrict,
  transfer_role text not null,
  source text,
  destination text not null,
  asset text not null,
  amount_atomic numeric(78,0) not null,
  token_mint text,
  instruction_index integer,
  created_at timestamptz not null default now(),
  constraint pay_transfer_role_check check (transfer_role in ('merchant_settlement','gateway_fee','refund','other')),
  constraint pay_transfer_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_transfer_amount_check check (amount_atomic > 0)
);

create index if not exists pay_payment_transfers_tx_idx
  on public.pay_payment_transfers (payment_transaction_id, instruction_index);

-- The same blockchain event must be delivered independently to each merchant
-- webhook endpoint. A globally unique event_id would incorrectly allow only
-- the first webhook to receive it.
alter table public.pay_webhook_deliveries
  drop constraint if exists pay_webhook_deliveries_event_id_key;

create unique index if not exists pay_webhook_deliveries_webhook_event_uidx
  on public.pay_webhook_deliveries (webhook_id, event_id);

comment on table public.pay_idempotency_keys is 'Persistent merchant-scoped idempotency state for mutating Pay APIs.';
comment on table public.pay_affiliates is 'Affiliate identities and commission policy used by the referral engine.';
comment on table public.pay_payment_transfers is 'Explicit transfer legs observed inside a blockchain transaction; supports merchant settlement plus gateway fee in one atomic transaction.';
