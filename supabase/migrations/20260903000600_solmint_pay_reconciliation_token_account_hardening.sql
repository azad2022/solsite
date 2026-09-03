-- Reconciliation hardening discovered by adversarial review.
-- SPL/Token-2022 transfer instructions target token accounts, while the
-- Payment Intent stores the merchant/fee wallet authority. The database must
-- validate the same invariant as the TypeScript verifier.
--
-- The previous implementation also rewrote an existing authoritative
-- transaction with ON CONFLICT DO UPDATE. An authoritative observation is
-- financial evidence and must become immutable once promoted; retries return
-- a duplicate result instead of rewriting it.

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
set search_path = ''
as $$
declare
  v_payment public.pay_payment_intents%rowtype;
  v_existing_transaction public.pay_payment_transactions%rowtype;
  v_transaction_id uuid;
  v_gross_fee numeric(78,0);
  v_merchant_count integer;
  v_fee_count integer;
  v_merchant_source_authority text;
  v_fee_source_authority text;
  v_merchant_destination_authority text;
  v_fee_destination_authority text;
begin
  select * into v_payment
    from public.pay_payment_intents
   where id = p_payment_id
   for update;

  if v_payment.id is null then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_NOT_FOUND');
  end if;

  if v_payment.expires_at <= now() and v_payment.status not in ('confirmed','completed','refunded') then
    update public.pay_payment_intents
       set status = 'expired', updated_at = now()
     where id = p_payment_id;
    insert into public.pay_payment_events(payment_id, event_type, from_status, to_status, request_id, actor_type)
    values (p_payment_id, 'payment.expired', v_payment.status, 'expired', p_request_id, 'system');
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_EXPIRED');
  end if;

  if v_payment.status in ('confirmed','completed','refunded') then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
  end if;

  if v_payment.status not in ('pending','detected','verifying','underpaid') then
    return jsonb_build_object('ok', false, 'reason', 'ILLEGAL_TRANSITION', 'from', v_payment.status, 'to', 'confirmed');
  end if;

  if p_signature is null or p_success is distinct from true
     or p_reference_matched is distinct from true
     or p_commitment is distinct from v_payment.verification_commitment then
    return jsonb_build_object('ok', false, 'reason', 'OBSERVATION_INVARIANT_FAILED');
  end if;

  if p_asset is distinct from v_payment.asset
     or p_recipient is distinct from v_payment.recipient
     or p_observed_amount_atomic is null
     or p_observed_amount_atomic <> v_payment.merchant_settlement_atomic then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_SNAPSHOT_MISMATCH');
  end if;

  if jsonb_typeof(coalesce(p_transfers, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSFER_SET');
  end if;

  if p_asset = 'SOL' then
    if exists (
      select 1
        from jsonb_array_elements(p_transfers) x
       where x->>'role' in ('merchant_settlement','gateway_fee')
         and (
           x->>'destination' is null
           or x->>'asset' is null
           or x->>'amountAtomic' is null
           or x->>'sourceAuthority' is null
           or x->>'destinationAuthority' is null
         )
    ) then
      return jsonb_build_object('ok', false, 'reason', 'TRANSFER_INVARIANT_FAILED');
    end if;
  else
    if exists (
      select 1
        from jsonb_array_elements(p_transfers) x
       where x->>'role' in ('merchant_settlement','gateway_fee')
         and (
           x->>'destination' is null
           or x->>'destinationAuthority' is null
           or x->>'asset' is null
           or x->>'amountAtomic' is null
           or x->>'sourceAuthority' is null
           or x->>'tokenMint' is null
           or x->>'tokenProgram' is null
           or x->>'tokenDecimals' is null
         )
    ) then
      return jsonb_build_object('ok', false, 'reason', 'TOKEN_ACCOUNT_INVARIANT_FAILED');
    end if;
  end if;

  select count(*) into v_merchant_count
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'merchant_settlement'
     and x->>'asset' = v_payment.asset
     and (x->>'amountAtomic')::numeric = v_payment.merchant_settlement_atomic
     and (
       (v_payment.asset = 'SOL' and x->>'destination' = v_payment.recipient
         and coalesce(x->>'tokenMint','') = ''
         and coalesce(x->>'tokenProgram','') = ''
         and coalesce(x->>'tokenDecimals','') = '')
       or
       (v_payment.asset <> 'SOL' and x->>'destinationAuthority' = v_payment.recipient
         and x->>'tokenMint' = v_payment.token_mint
         and x->>'tokenProgram' = v_payment.token_program
         and x->>'tokenDecimals' = v_payment.token_decimals::text)
     );

  select count(*) into v_fee_count
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'gateway_fee'
     and x->>'asset' = v_payment.asset
     and (x->>'amountAtomic')::numeric = v_payment.fee_atomic
     and (
       (v_payment.asset = 'SOL' and x->>'destination' = v_payment.fee_recipient
         and coalesce(x->>'tokenMint','') = ''
         and coalesce(x->>'tokenProgram','') = ''
         and coalesce(x->>'tokenDecimals','') = '')
       or
       (v_payment.asset <> 'SOL' and x->>'destinationAuthority' = v_payment.fee_recipient
         and x->>'tokenMint' = v_payment.token_mint
         and x->>'tokenProgram' = v_payment.token_program
         and x->>'tokenDecimals' = v_payment.token_decimals::text)
     );

  if v_merchant_count <> 1 or v_fee_count <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'TRANSFER_INVARIANT_FAILED');
  end if;

  select x->>'sourceAuthority', x->>'destinationAuthority'
    into v_merchant_source_authority, v_merchant_destination_authority
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'merchant_settlement';

  select x->>'sourceAuthority', x->>'destinationAuthority'
    into v_fee_source_authority, v_fee_destination_authority
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'gateway_fee';

  if v_merchant_source_authority is null
     or v_fee_source_authority is null
     or v_merchant_source_authority <> v_fee_source_authority then
    return jsonb_build_object('ok', false, 'reason', 'SENDER_INVARIANT_FAILED');
  end if;

  if p_asset = 'SOL' then
    if v_merchant_destination_authority <> v_payment.recipient
       or v_fee_destination_authority <> v_payment.fee_recipient then
      return jsonb_build_object('ok', false, 'reason', 'DESTINATION_INVARIANT_FAILED');
    end if;
  else
    if v_merchant_destination_authority <> v_payment.recipient
       or v_fee_destination_authority <> v_payment.fee_recipient then
      return jsonb_build_object('ok', false, 'reason', 'TOKEN_ACCOUNT_INVARIANT_FAILED');
    end if;
  end if;

  select * into v_existing_transaction
    from public.pay_payment_transactions
   where signature = p_signature
   for update;

  if v_existing_transaction.id is not null then
    if v_existing_transaction.payment_id <> p_payment_id then
      return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
    end if;
    if v_existing_transaction.is_authoritative is true then
      return jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
    end if;

    update public.pay_payment_transactions
       set slot = p_slot,
           block_time = p_block_time,
           observed_amount_atomic = p_observed_amount_atomic,
           asset = p_asset,
           recipient = p_recipient,
           reference_matched = p_reference_matched,
           confirmed = true,
           success = p_success,
           commitment = p_commitment,
           fee_payer = p_fee_payer,
           network_fee_lamports = p_network_fee_lamports,
           verification_status = 'verified',
           verified_at = p_verified_at,
           is_authoritative = true,
           raw_transaction = coalesce(p_raw_observation,'{}'::jsonb),
           observed_at = now(),
           rejection_reason = null
     where id = v_existing_transaction.id
       and is_authoritative = false
     returning id into v_transaction_id;
  else
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
    returning id into v_transaction_id;
  end if;

  if v_transaction_id is null then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
  end if;

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
  from jsonb_array_elements(p_transfers) x;

  v_gross_fee := v_payment.fee_atomic;
  insert into public.pay_revenue_ledger(
    payment_id, asset, gross_gateway_fee_atomic, referral_commission_atomic,
    net_gateway_revenue_atomic, status, recognized_at
  ) values (
    p_payment_id, v_payment.asset, v_gross_fee, 0, v_gross_fee, 'eligible', p_verified_at
  ) on conflict (payment_id) do nothing;

  update public.pay_payment_intents
     set status = 'confirmed', updated_at = now()
   where id = p_payment_id;

  insert into public.pay_payment_events(
    payment_id, event_type, from_status, to_status, request_id, actor_type, payload
  ) values (
    p_payment_id, 'payment.confirmed', v_payment.status, 'confirmed', p_request_id, 'system',
    jsonb_build_object('signature', p_signature, 'transaction_id', v_transaction_id)
  );

  return jsonb_build_object('ok', true, 'status', 'confirmed', 'transaction_id', v_transaction_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
end;
$$;

revoke all on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) to service_role;

comment on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text)
is 'Server-only atomic Pay reconciliation with SPL token-account authority validation and immutable authoritative retries.';
