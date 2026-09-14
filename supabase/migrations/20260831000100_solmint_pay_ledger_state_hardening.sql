-- Financial/state hardening after adversarial end-to-end review.
-- Merchant principal is a reporting mirror of on-chain settlement, not a custodial balance.

alter table public.pay_payment_intents
  drop constraint if exists pay_payment_status_check;

alter table public.pay_payment_intents
  add constraint pay_payment_status_check
  check (status in ('created','pending','detected','verifying','confirmed','completed','expired','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous','failed','refunded'));

create table if not exists public.pay_merchant_ledger (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete restrict,
  payment_id uuid not null references public.pay_payment_intents(id) on delete restrict,
  payment_transaction_id uuid not null references public.pay_payment_transactions(id) on delete restrict,
  asset text not null,
  entry_type text not null,
  direction text not null,
  amount_atomic numeric(78,0) not null,
  blockchain_signature text not null,
  created_at timestamptz not null default now(),
  constraint pay_merchant_ledger_asset_check check (asset in ('SOL','USDC','USDT')),
  constraint pay_merchant_ledger_type_check check (entry_type in ('payment_principal','refund','adjustment')),
  constraint pay_merchant_ledger_direction_check check (direction in ('credit','debit')),
  constraint pay_merchant_ledger_amount_check check (amount_atomic > 0),
  unique (payment_id, entry_type, direction),
  unique (blockchain_signature, entry_type, direction)
);

create index if not exists pay_merchant_ledger_merchant_created_idx
  on public.pay_merchant_ledger (merchant_id, created_at desc);

create index if not exists pay_merchant_ledger_payment_idx
  on public.pay_merchant_ledger (payment_id, created_at desc);

create or replace function public.pay_reject_merchant_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SOLMINT_PAY_APPEND_ONLY: pay_merchant_ledger cannot be mutated';
end;
$$;

drop trigger if exists pay_merchant_ledger_no_update on public.pay_merchant_ledger;
create trigger pay_merchant_ledger_no_update
before update or delete on public.pay_merchant_ledger
for each row execute function public.pay_reject_merchant_ledger_mutation();

create or replace function public.pay_insert_merchant_principal_entry()
returns trigger
language plpgsql
as $$
declare
  v_payment public.pay_payment_intents%rowtype;
  v_transfer public.pay_payment_transfers%rowtype;
begin
  if new.is_authoritative is distinct from true then
    return new;
  end if;

  select * into v_payment
    from public.pay_payment_intents
   where id = new.payment_id;

  select * into v_transfer
    from public.pay_payment_transfers
   where payment_transaction_id = new.id
     and transfer_role = 'merchant_settlement'
   order by id
   limit 1;

  if v_payment.id is null or v_transfer.id is null then
    raise exception 'SOLMINT_PAY_LEDGER_INVARIANT: authoritative transaction lacks merchant settlement';
  end if;

  insert into public.pay_merchant_ledger(
    merchant_id, payment_id, payment_transaction_id, asset, entry_type,
    direction, amount_atomic, blockchain_signature
  ) values (
    v_payment.merchant_id, v_payment.id, new.id, v_payment.asset, 'payment_principal',
    'credit', v_transfer.amount_atomic, new.signature
  )
  on conflict (payment_id, entry_type, direction) do nothing;

  return new;
end;
$$;

drop trigger if exists pay_payment_transaction_merchant_ledger on public.pay_payment_transactions;
create trigger pay_payment_transaction_merchant_ledger
after insert or update of is_authoritative on public.pay_payment_transactions
for each row execute function public.pay_insert_merchant_principal_entry();

-- Keep the database transition policy identical to the TypeScript state machine.
create or replace function public.pay_transition_payment(
  p_payment_id uuid,
  p_to_status text,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_allowed boolean := false;
begin
  select status into v_from
    from public.pay_payment_intents
   where id = p_payment_id
   for update;

  if v_from is null then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_NOT_FOUND');
  end if;

  v_allowed := case
    when v_from = 'created' and p_to_status in ('pending','expired') then true
    when v_from = 'pending' and p_to_status in ('detected','expired','failed','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous') then true
    when v_from = 'detected' and p_to_status in ('verifying','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous','failed') then true
    when v_from = 'verifying' and p_to_status in ('pending','confirmed','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous','failed') then true
    when v_from = 'underpaid' and p_to_status in ('pending','detected','verifying','expired') then true
    when v_from = 'overpaid' and p_to_status in ('refunded','completed') then true
    when v_from = 'ambiguous' and p_to_status in ('pending','detected','verifying','expired') then true
    when v_from = 'confirmed' and p_to_status in ('completed','refunded') then true
    when v_from = 'completed' and p_to_status = 'refunded' then true
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'ILLEGAL_TRANSITION', 'from', v_from, 'to', p_to_status);
  end if;

  update public.pay_payment_intents
     set status = p_to_status, updated_at = now()
   where id = p_payment_id;

  insert into public.pay_payment_events(
    payment_id, event_type, from_status, to_status, request_id, actor_type, payload
  ) values (
    p_payment_id, 'payment.status_changed', v_from, p_to_status, p_request_id, 'system',
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.pay_transition_payment(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.pay_transition_payment(uuid,text,text,text) to service_role;

-- The verification/settlement RPC must accept retryable ambiguous payments but
-- never permit financial writes from an ambiguous state unless a later worker
-- transitions it after fresh verification.
-- Existing pay_apply_verified_observation is protected by the status check in
-- its body; the state machine above is the authoritative transition boundary.

alter table public.pay_merchant_ledger enable row level security;
revoke all on table public.pay_merchant_ledger from public, anon, authenticated;

comment on table public.pay_merchant_ledger is 'Append-only merchant principal reporting ledger. It mirrors verified on-chain settlement and is never a custody balance.';
