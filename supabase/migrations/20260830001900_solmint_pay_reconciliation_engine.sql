-- SolMint Pay blockchain observer / reconciliation persistence boundary.
-- NOT FOR PRODUCTION until the worker, E2E tests, scheduler, RLS review and
-- migration review gates have passed.

create index if not exists pay_payment_intents_reconciliation_idx
  on public.pay_payment_intents (status, expires_at, created_at)
  where status in ('pending','detected','verifying','underpaid');

create index if not exists pay_payment_transactions_signature_idx
  on public.pay_payment_transactions (signature);

-- Rejected observations are audit facts and may legitimately have no monetary
-- transfer. Do not encode a fabricated amount just to satisfy a positive-value
-- constraint.
alter table public.pay_payment_transactions
  alter column observed_amount_atomic drop not null;

alter table public.pay_payment_transactions
  drop constraint if exists pay_tx_amount_check;

alter table public.pay_payment_transactions
  add constraint pay_tx_amount_check
  check (observed_amount_atomic is null or observed_amount_atomic > 0);

alter table public.pay_payment_transactions
  add column if not exists rejection_reason text;

create or replace function public.pay_transition_payment(
  p_payment_id uuid,
  p_to_status text,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    when v_from = 'pending' and p_to_status in ('detected','expired','failed') then true
    when v_from = 'detected' and p_to_status in ('verifying','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','failed') then true
    when v_from = 'verifying' and p_to_status in ('pending','confirmed','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','failed') then true
    when v_from = 'underpaid' and p_to_status in ('pending','detected','verifying','expired') then true
    when v_from = 'overpaid' and p_to_status in ('refunded','completed') then true
    when v_from = 'confirmed' and p_to_status in ('completed','refunded') then true
    when v_from = 'completed' and p_to_status = 'refunded' then true
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'ILLEGAL_TRANSITION', 'from', v_from, 'to', p_to_status);
  end if;

  update public.pay_payment_intents set status = p_to_status, updated_at = now() where id = p_payment_id;

  insert into public.pay_payment_events(payment_id, event_type, from_status, to_status, request_id, actor_type, payload)
  values (p_payment_id, 'payment.status_changed', v_from, p_to_status, p_request_id, 'system', jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.pay_transition_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pay_transition_payment(uuid, text, text, text) to service_role;

create or replace function public.pay_record_rejected_observation(
  p_payment_id uuid,
  p_signature text,
  p_slot bigint,
  p_block_time timestamptz,
  p_success boolean,
  p_commitment text,
  p_fee_payer text,
  p_observed_amount_atomic numeric default null,
  p_asset text default null,
  p_recipient text default null,
  p_reference_matched boolean default false,
  p_reason text default null,
  p_raw_observation jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_signature is null or length(trim(p_signature)) < 32 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_SIGNATURE');
  end if;

  select id into v_id from public.pay_payment_transactions where signature = p_signature;

  if v_id is null then
    insert into public.pay_payment_transactions(
      payment_id, signature, slot, block_time, observed_amount_atomic, asset,
      recipient, reference_matched, confirmed, success, commitment, fee_payer,
      verification_status, is_authoritative, raw_transaction, observed_at, rejection_reason
    ) values (
      p_payment_id, p_signature, p_slot, p_block_time, p_observed_amount_atomic,
      coalesce(p_asset, 'SOL'), coalesce(p_recipient,''), coalesce(p_reference_matched,false), false,
      coalesce(p_success,false), p_commitment, p_fee_payer, 'rejected', false,
      coalesce(p_raw_observation,'{}'::jsonb), now(), p_reason
    ) returning id into v_id;
  else
    update public.pay_payment_transactions
    set slot = p_slot,
        block_time = p_block_time,
        observed_amount_atomic = p_observed_amount_atomic,
        asset = coalesce(p_asset, asset),
        recipient = coalesce(p_recipient, recipient),
        commitment = p_commitment,
        success = coalesce(p_success,false),
        fee_payer = p_fee_payer,
        reference_matched = coalesce(p_reference_matched,false),
        verification_status = case when is_authoritative then verification_status else 'rejected' end,
        raw_transaction = coalesce(p_raw_observation,'{}'::jsonb),
        observed_at = now(),
        rejection_reason = p_reason
    where id = v_id and payment_id = p_payment_id;
  end if;

  insert into public.pay_payment_events(payment_id, event_type, actor_type, payload)
  values (p_payment_id, 'payment.observation_rejected', 'system', jsonb_build_object('signature', p_signature, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'transaction_id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
end;
$$;

revoke all on function public.pay_record_rejected_observation(uuid, text, bigint, timestamptz, boolean, text, text, numeric, text, text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.pay_record_rejected_observation(uuid, text, bigint, timestamptz, boolean, text, text, numeric, text, text, boolean, text, jsonb) to service_role;

create or replace function public.pay_apply_verified_observation(
  p_payment_id uuid,
  p_signature text,
  p_slot bigint,
  p_block_time timestamptz,
  p_observed_amount_atomic numeric,
  p_asset text,
  p_recipient text,
  p_reference_matched boolean,
  p_success boolean,
  p_commitment text,
  p_fee_payer text,
  p_network_fee_lamports numeric,
  p_transfers jsonb,
  p_raw_observation jsonb default '{}'::jsonb,
  p_verified_at timestamptz default now(),
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.pay_payment_intents%rowtype;
  v_transaction_id uuid;
  v_existing_payment uuid;
  v_gross_fee numeric(78,0);
  v_merchant_count integer;
  v_fee_count integer;
  v_merchant_source_authority text;
  v_fee_source_authority text;
  v_item jsonb;
begin
  select * into v_payment
  from public.pay_payment_intents
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_NOT_FOUND');
  end if;

  if v_payment.expires_at <= now() and v_payment.status not in ('confirmed','completed','refunded') then
    update public.pay_payment_intents set status = 'expired', updated_at = now() where id = p_payment_id;
    insert into public.pay_payment_events(payment_id, event_type, from_status, to_status, request_id, actor_type)
    values (p_payment_id, 'payment.expired', v_payment.status, 'expired', p_request_id, 'system');
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_EXPIRED');
  end if;

  if v_payment.status in ('confirmed','completed','refunded') then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
  end if;

  if p_signature is null or p_success is distinct from true or p_reference_matched is distinct from true or p_commitment is distinct from v_payment.verification_commitment then
    return jsonb_build_object('ok', false, 'reason', 'OBSERVATION_INVARIANT_FAILED');
  end if;

  if p_asset is distinct from v_payment.asset or p_recipient is distinct from v_payment.recipient or p_observed_amount_atomic is null then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_SNAPSHOT_MISMATCH');
  end if;

  select payment_id into v_existing_payment from public.pay_payment_transactions where signature = p_signature;
  if v_existing_payment is not null and v_existing_payment <> p_payment_id then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
  end if;

  if jsonb_typeof(coalesce(p_transfers,'[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSFER_SET');
  end if;

  select count(*) into v_merchant_count
  from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x
  where x->>'role' = 'merchant_settlement'
    and x->>'destination' = v_payment.recipient
    and x->>'asset' = v_payment.asset
    and (x->>'amountAtomic')::numeric = v_payment.merchant_settlement_atomic
    and coalesce(x->>'tokenMint','') = coalesce(v_payment.token_mint,'')
    and coalesce(x->>'tokenProgram','') = coalesce((v_payment.token_program)::text,'')
    and coalesce(x->>'tokenDecimals','') = coalesce((v_payment.token_decimals)::text,'');

  select count(*) into v_fee_count
  from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x
  where x->>'role' = 'gateway_fee'
    and x->>'destination' = v_payment.fee_recipient
    and x->>'asset' = v_payment.asset
    and (x->>'amountAtomic')::numeric = v_payment.fee_atomic
    and coalesce(x->>'tokenMint','') = coalesce(v_payment.token_mint,'')
    and coalesce(x->>'tokenProgram','') = coalesce((v_payment.token_program)::text,'')
    and coalesce(x->>'tokenDecimals','') = coalesce((v_payment.token_decimals)::text,'');

  if v_merchant_count <> 1 or v_fee_count <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'TRANSFER_INVARIANT_FAILED');
  end if;

  select x->>'sourceAuthority' into v_merchant_source_authority
  from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x
  where x->>'role' = 'merchant_settlement';

  select x->>'sourceAuthority' into v_fee_source_authority
  from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x
  where x->>'role' = 'gateway_fee';

  if v_merchant_source_authority is null or v_fee_source_authority is null or v_merchant_source_authority <> v_fee_source_authority then
    return jsonb_build_object('ok', false, 'reason', 'SENDER_INVARIANT_FAILED');
  end if;

  if v_payment.asset <> 'SOL' then
    if exists (
      select 1 from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x
      where x->>'role' in ('merchant_settlement','gateway_fee')
        and (x->>'destinationAuthority') is null
    ) then
      return jsonb_build_object('ok', false, 'reason', 'TOKEN_ACCOUNT_INVARIANT_FAILED');
    end if;
  end if;

  if p_observed_amount_atomic <> v_payment.merchant_settlement_atomic then
    return jsonb_build_object('ok', false, 'reason', 'OBSERVED_AMOUNT_MISMATCH');
  end if;

  insert into public.pay_payment_transactions(
    payment_id, signature, slot, block_time, observed_amount_atomic, asset,
    recipient, reference_matched, confirmed, success, commitment, fee_payer,
    network_fee_lamports, verification_status, verified_at, is_authoritative,
    raw_transaction, observed_at, rejection_reason
  ) values (
    p_payment_id, p_signature, p_slot, p_block_time, p_observed_amount_atomic,
    p_asset, p_recipient, p_reference_matched, true, p_success, p_commitment,
    p_fee_payer, p_network_fee_lamports, 'verified', p_verified_at, true,
    coalesce(p_raw_observation,'{}'::jsonb), now(), null
  )
  on conflict (signature) do update set
    slot = excluded.slot,
    block_time = excluded.block_time,
    observed_amount_atomic = excluded.observed_amount_atomic,
    asset = excluded.asset,
    recipient = excluded.recipient,
    reference_matched = excluded.reference_matched,
    confirmed = true,
    success = excluded.success,
    commitment = excluded.commitment,
    fee_payer = excluded.fee_payer,
    network_fee_lamports = excluded.network_fee_lamports,
    verification_status = 'verified',
    verified_at = excluded.verified_at,
    is_authoritative = true,
    raw_transaction = excluded.raw_transaction,
    observed_at = now(),
    rejection_reason = null
  returning id into v_transaction_id;

  delete from public.pay_payment_transfers where payment_transaction_id = v_transaction_id;

  insert into public.pay_payment_transfers(
    payment_transaction_id, transfer_role, source, destination, asset, amount_atomic,
    token_mint, token_program, token_decimals, source_authority, destination_authority,
    instruction_index
  )
  select
    v_transaction_id,
    x->>'role',
    nullif(x->>'source',''),
    x->>'destination',
    x->>'asset',
    (x->>'amountAtomic')::numeric,
    nullif(x->>'tokenMint',''),
    nullif(x->>'tokenProgram',''),
    case when x->>'tokenDecimals' is null or x->>'tokenDecimals' = '' then null else (x->>'tokenDecimals')::integer end,
    nullif(x->>'sourceAuthority',''),
    nullif(x->>'destinationAuthority',''),
    case when x->>'instructionIndex' is null or x->>'instructionIndex' = '' then null else (x->>'instructionIndex')::integer end
  from jsonb_array_elements(coalesce(p_transfers,'[]'::jsonb)) x;

  v_gross_fee := v_payment.fee_atomic;

  insert into public.pay_revenue_ledger(payment_id, asset, gross_gateway_fee_atomic, referral_commission_atomic, net_gateway_revenue_atomic, status, recognized_at)
  values (p_payment_id, v_payment.asset, v_gross_fee, 0, v_gross_fee, 'eligible', p_verified_at)
  on conflict (payment_id) do nothing;

  if v_payment.status not in ('pending','detected','verifying','underpaid') then
    return jsonb_build_object('ok', false, 'reason', 'ILLEGAL_TRANSITION', 'from', v_payment.status, 'to', 'confirmed');
  end if;

  update public.pay_payment_intents set status = 'confirmed', updated_at = now() where id = p_payment_id;

  insert into public.pay_payment_events(payment_id, event_type, from_status, to_status, request_id, actor_type, payload)
  values (p_payment_id, 'payment.confirmed', v_payment.status, 'confirmed', p_request_id, 'system', jsonb_build_object('signature', p_signature, 'transaction_id', v_transaction_id));

  return jsonb_build_object('ok', true, 'status', 'confirmed', 'transaction_id', v_transaction_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
end;
$$;

revoke all on function public.pay_apply_verified_observation(uuid, text, bigint, timestamptz, numeric, text, text, boolean, boolean, text, text, numeric, jsonb, jsonb, timestamptz, text) from public, anon, authenticated;
grant execute on function public.pay_apply_verified_observation(uuid, text, bigint, timestamptz, numeric, text, text, boolean, boolean, text, text, numeric, jsonb, jsonb, timestamptz, text) to service_role;

comment on function public.pay_apply_verified_observation is 'Atomic reconciliation commit with independent database-side transfer and payment snapshot validation.';
