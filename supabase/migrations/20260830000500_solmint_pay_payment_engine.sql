-- SolMint Pay payment-engine hardening.
-- This migration extends the foundation with deterministic settlement,
-- on-chain verification state, wallet ownership challenges, accounting ledger
-- snapshots, and immutable payment events. It is intentionally non-production;
-- RLS, secrets, workers, and live RPC/indexer integration remain release gates.

alter table public.pay_payment_intents
  add column if not exists merchant_settlement_atomic numeric(78,0),
  add column if not exists customer_total_atomic numeric(78,0),
  add column if not exists verification_commitment text not null default 'finalized',
  add column if not exists customer_wallet_address text,
  add column if not exists fee_payer_address text;

update public.pay_payment_intents
set merchant_settlement_atomic = coalesce(merchant_settlement_atomic, merchant_net_atomic),
    customer_total_atomic = coalesce(customer_total_atomic, amount_atomic);

alter table public.pay_payment_intents
  alter column merchant_settlement_atomic set not null,
  alter column customer_total_atomic set not null,
  add constraint pay_payment_verification_commitment_check
    check (verification_commitment in ('confirmed','finalized')),
  add constraint pay_payment_settlement_positive_check
    check (merchant_settlement_atomic > 0),
  add constraint pay_payment_customer_total_positive_check
    check (customer_total_atomic > 0);

-- An on-chain transaction may be observed several times while it moves from
-- confirmed to finalized. Only one observation is authoritative for a payment.
alter table public.pay_payment_transactions
  add column if not exists success boolean not null default false,
  add column if not exists commitment text,
  add column if not exists fee_payer text,
  add column if not exists network_fee_lamports numeric(78,0),
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists is_authoritative boolean not null default false,
  add column if not exists raw_transaction jsonb not null default '{}'::jsonb;

alter table public.pay_payment_transactions
  add constraint pay_payment_transactions_commitment_check
    check (commitment is null or commitment in ('confirmed','finalized')),
  add constraint pay_payment_transactions_verification_check
    check (verification_status in ('unverified','candidate','verified','rejected')),
  add constraint pay_payment_transactions_network_fee_check
    check (network_fee_lamports is null or network_fee_lamports >= 0);

create unique index if not exists pay_payment_transactions_authoritative_uidx
  on public.pay_payment_transactions (payment_id)
  where is_authoritative = true;

create index if not exists pay_payment_transactions_verification_idx
  on public.pay_payment_transactions (verification_status, observed_at desc);

-- A transaction can contain multiple transfer legs, but each semantic role is
-- evaluated once for the transaction. This prevents ambiguous double-counting
-- of the merchant settlement or gateway fee leg.
create unique index if not exists pay_payment_transfers_tx_role_uidx
  on public.pay_payment_transfers (payment_transaction_id, transfer_role)
  where transfer_role in ('merchant_settlement','gateway_fee');

alter table public.pay_payment_transfers
  add constraint pay_payment_transfer_source_check
  check (transfer_role in ('merchant_settlement','gateway_fee','refund','other')
         and (transfer_role in ('refund','other') or source is not null));

-- Ownership proof for a merchant receiving wallet. The message is scoped to a
-- single challenge, merchant and wallet and expires quickly; the raw signature
-- is not stored here because it is an authentication artifact rather than a
-- reusable financial credential.
create table if not exists public.pay_wallet_ownership_challenges (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  wallet_id uuid not null references public.pay_merchant_wallets(id) on delete cascade,
  challenge_nonce text not null unique,
  message text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  status text not null default 'issued',
  constraint pay_wallet_challenge_status_check
    check (status in ('issued','verified','expired','rejected'))
);

create index if not exists pay_wallet_challenges_merchant_idx
  on public.pay_wallet_ownership_challenges (merchant_id, issued_at desc);

create table if not exists public.pay_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pay_payment_intents(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  request_id text,
  actor_type text not null default 'system',
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pay_payment_events_payment_idx
  on public.pay_payment_events (payment_id, created_at asc);

-- Internal revenue snapshot. This is not the merchant principal and is not a
-- substitute for an on-chain transaction. It records the exact gateway fee
-- recognized after a payment is verified, enabling deterministic referral
-- liabilities and financial reporting.
create table if not exists public.pay_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.pay_payment_intents(id) on delete restrict,
  asset text not null,
  gross_gateway_fee_atomic numeric(78,0) not null,
  referral_commission_atomic numeric(78,0) not null default 0,
  net_gateway_revenue_atomic numeric(78,0) not null,
  status text not null default 'eligible',
  recognized_at timestamptz not null default now(),
  voided_at timestamptz,
  constraint pay_revenue_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_revenue_gross_check check (gross_gateway_fee_atomic > 0),
  constraint pay_revenue_commission_check check (referral_commission_atomic >= 0 and referral_commission_atomic <= gross_gateway_fee_atomic),
  constraint pay_revenue_net_check check (net_gateway_revenue_atomic = gross_gateway_fee_atomic - referral_commission_atomic),
  constraint pay_revenue_status_check check (status in ('eligible','void'))
);

create index if not exists pay_revenue_ledger_status_idx
  on public.pay_revenue_ledger (status, recognized_at desc);

comment on column public.pay_payment_intents.merchant_settlement_atomic is 'Exact merchant settlement leg in asset atomic units; fee is either deducted from this leg or added to customer total according to immutable fee policy.';
comment on column public.pay_payment_intents.verification_commitment is 'Minimum Solana commitment required before the payment becomes financially eligible.';
comment on column public.pay_payment_transactions.is_authoritative is 'Only one verified on-chain observation may be authoritative for a payment; later observations update confidence, not accounting.';
comment on table public.pay_payment_events is 'Append-only payment state/event history used for audit, reconciliation and deterministic debugging.';
comment on table public.pay_revenue_ledger is 'Internal recognition ledger for SolMint gateway revenue after verified settlement; never infer balances from frontend state.';
