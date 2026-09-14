-- Hardening pass for the SolMint Pay foundation.
-- This migration is still non-production: RLS/auth mapping and live blockchain
-- processing remain explicit release gates.

-- A merchant may safely reuse an external order id only once. NULL remains
-- allowed because some Payment Links intentionally do not provide one.
create unique index if not exists pay_payment_intents_merchant_external_order_uidx
  on public.pay_payment_intents (merchant_id, external_order_id)
  where external_order_id is not null;

-- Capture the exact accounting outcome at payment creation time. These fields
-- must never be recomputed from the current merchant fee configuration.
alter table public.pay_payment_intents
  add column if not exists customer_total_atomic numeric(78,0),
  add column if not exists merchant_net_atomic numeric(78,0),
  add column if not exists fee_recipient text,
  add column if not exists network text not null default 'solana';

update public.pay_payment_intents
set fee_atomic = coalesce(fee_atomic, 0),
    customer_total_atomic = coalesce(customer_total_atomic, amount_atomic),
    merchant_net_atomic = coalesce(merchant_net_atomic, amount_atomic),
    fee_recipient = coalesce(fee_recipient, 'UNSET_BEFORE_PRODUCTION');

alter table public.pay_payment_intents
  alter column fee_atomic set not null,
  alter column customer_total_atomic set not null,
  alter column merchant_net_atomic set not null,
  alter column fee_recipient set not null;

alter table public.pay_payment_intents
  add constraint pay_payment_network_check check (network = 'solana'),
  add constraint pay_payment_customer_total_check check (customer_total_atomic > 0),
  add constraint pay_payment_merchant_net_check check (merchant_net_atomic >= 0),
  add constraint pay_payment_fee_consistency_check check (
    (fee_payer = 'merchant' and customer_total_atomic = amount_atomic and merchant_net_atomic + fee_atomic = amount_atomic)
    or
    (fee_payer = 'customer' and merchant_net_atomic = amount_atomic and customer_total_atomic = amount_atomic + fee_atomic)
  );

-- A receiving wallet is the merchant's destination. The gas_source role is
-- deliberately retained for explicit sponsor funding; it is not a merchant
-- receiving balance and must never be treated as customer funds.
alter table public.pay_merchant_wallets
  add column if not exists verified_at timestamptz,
  add column if not exists verification_status text not null default 'unverified';

alter table public.pay_merchant_wallets
  add constraint pay_wallet_network_check check (network = 'solana'),
  add constraint pay_wallet_verification_check check (verification_status in ('unverified','verified','rejected'));

-- Gas balance in the previous foundation schema was only a mutable number. A
-- production payment system needs an append-only ledger as the source of truth.
alter table public.pay_gas_accounts
  add column if not exists sponsor_address text,
  add column if not exists credit_balance_atomic numeric(78,0) not null default 0,
  add column if not exists debit_balance_atomic numeric(78,0) not null default 0;

alter table public.pay_gas_accounts
  add constraint pay_gas_credit_balance_check check (credit_balance_atomic >= 0),
  add constraint pay_gas_debit_balance_check check (debit_balance_atomic >= 0);

create table if not exists public.pay_gas_ledger (
  id uuid primary key default gen_random_uuid(),
  gas_account_id uuid not null references public.pay_gas_accounts(id) on delete restrict,
  entry_type text not null,
  direction text not null,
  amount_atomic numeric(78,0) not null,
  related_payment_id uuid references public.pay_payment_intents(id) on delete restrict,
  blockchain_signature text unique,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pay_gas_ledger_entry_type_check check (entry_type in ('merchant_deposit','sponsorship_spend','reversal','adjustment')),
  constraint pay_gas_ledger_direction_check check (direction in ('credit','debit')),
  constraint pay_gas_ledger_amount_check check (amount_atomic > 0),
  unique (gas_account_id, idempotency_key)
);

create index if not exists pay_gas_ledger_account_created_idx
  on public.pay_gas_ledger (gas_account_id, created_at desc);

create index if not exists pay_gas_ledger_payment_idx
  on public.pay_gas_ledger (related_payment_id)
  where related_payment_id is not null;

comment on column public.pay_payment_intents.fee_atomic is 'Immutable gateway fee snapshot in payment asset atomic units.';
comment on column public.pay_payment_intents.fee_recipient is 'Immutable SolMint revenue recipient snapshot; never infer this from mutable config after creation.';
comment on column public.pay_payment_intents.customer_total_atomic is 'Exact amount the customer must transfer, including gateway fee when customer is the fee payer.';
comment on table public.pay_gas_ledger is 'Append-only source of truth for merchant-funded or SolMint-funded gas sponsorship credits and debits.';
