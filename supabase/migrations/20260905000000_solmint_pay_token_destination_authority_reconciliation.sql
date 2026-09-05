-- Align authoritative token reconciliation with the Solana account model.
-- For SOL, `destination` is the receiving wallet itself.
-- For SPL/Token-2022, `destination` is the token account (ATA or other token account)
-- and `destinationAuthority` is the wallet that owns that token account. The
-- Payment Intent stores the receiving wallet, so token reconciliation must bind
-- the observed token account to its authoritative owner instead of comparing
-- the token-account address to the wallet address.

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
  v_transaction_id uuid;
  v_existing_payment uuid;
  v_gross_fee numeric(78,0);
  v_merchant_count integer;
  v_fee_count integer;
  v_merchant_source_authority text;
  v_fee_source_authority text;
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

  if p_signature is null
     or p_success is distinct from true
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

  select payment_id into v_existing_payment
    from public.pay_payment_transactions
   where signature = p_signature;
  if v_existing_payment is not null and v_existing_payment <> p_payment_id then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_transfers) x
     where x->>'role' in ('merchant_settlement','gateway_fee')
       and (x->>'destination' is null or x->>'asset' is null
         or x->>'amountAtomic' is null or x->>'sourceAuthority' is null)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'TRANSFER_INVARIANT_FAILED');
  end if;

  -- SOL: destination is the receiving wallet.
  -- Tokens: destination is a token account; destinationAuthority is the wallet
  -- owner that was snapshotted into the Payment Intent.
  if v_payment.asset = 'SOL' then
    select count(*) into v_merchant_count
      from jsonb_array_elements(p_transfers) x
     where x->>'role' = 'merchant_settlement'
       and x->>'destination' = v_payment.recipient
       and x->>'asset' = v_payment.asset
       and (x->>'amountAtomic')::numeric = v_payment.merchant_settlement_atomic
       and coalesce(x->>'tokenMint','') = ''
       and coalesce(x->>'tokenProgram','') = ''
       and coalesce(x->>'tokenDecimals','') = '';

    select count(*) into v_fee_count
      from jsonb_array_elements(p_transfers) x
     where x->>'role' = 'gateway_fee'
       and x->>'destination' = v_payment.fee_recipient
       and x->>'asset' = v_payment.asset
       and (x->>'amountAtomic')::numeric = v_payment.fee_atomic
       and coalesce(x->>'tokenMint','') = ''
       and coalesce(x->>'tokenProgram','') = ''
       and coalesce(x->>'tokenDecimals','') = '';
  else
    select count(*) into v_merchant_count
      from jsonb_array_elements(p_transfers) x
     where x->>'role' = 'merchant_settlement'
       and x->>'destinationAuthority' = v_payment.recipient
       and x->>'destination' is not null
       and x->>'asset' = v_payment.asset
       and (x->>'amountAtomic')::numeric = v_payment.merchant_settlement_atomic
       and coalesce(x->>'tokenMint','') = coalesce(v_payment.token_mint,'')
       and coalesce(x->>'tokenProgram','') = coalesce(v_payment.token_program::text,'')
       and coalesce(x->>'tokenDecimals','') = coalesce(v_payment.token_decimals::text,'');

    select count(*) into v_fee_count
      from jsonb_array_elements(p_transfers) x
     where x->>'role' = 'gateway_fee'
       and x->>'destinationAuthority' = v_payment.fee_recipient
       and x->>'destination' is not null
       and x->>'asset' = v_payment.asset
       and (x->>'amountAtomic')::numeric = v_payment.fee_atomic
       and coalesce(x->>'tokenMint','') = coalesce(v_payment.token_mint,'')
       and coalesce(x->>'tokenProgram','') = coalesce(v_payment.token_program::text,'')
       and coalesce(x->>'tokenDecimals','') = coalesce(v_payment.token_decimals::text,'');
  end if;

  if v_merchant_count <> 1 or v_fee_count <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'TRANSFER_INVARIANT_FAILED');
  end if;

  select x->>'sourceAuthority' into v_merchant_source_authority
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'merchant_settlement';
  select x->>'sourceAuthority' into v_fee_source_authority
    from jsonb_array_elements(p_transfers) x
   where x->>'role' = 'gateway_fee';

  if v_merchant_source_authority is null
     or v_fee_source_authority is null
     or v_merchant_source_authority <> v_fee_source_authority then
    return jsonb_build_object('ok', false, 'reason', 'SENDER_INVARIANT_FAILED');
  end if;

  if v_payment.asset <> 'SOL' and exists (
    select 1 from jsonb_array_elements(p_transfers) x
     where x->>'role' in ('merchant_settlement','gateway_fee')
       and (x->>'destinationAuthority') is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'TOKEN_ACCOUNT_INVARIANT_FAILED');
  end if;

  insert into public.pay_payment_transactions(
    payment_id, signature, slot, block_time, observed_amount_atomic, asset, recipient,
    reference_matched, confirmed, success, commitment, fee_payer, network_fee_lamports,
    verification_status, verified_at, is_authoritative, raw_transaction, observed_at, rejection_reason
  )
  values (
    p_payment_id, p_signature, p_slot, p_block_time, p_observed_amount_atomic, p_asset,
    p_recipient, p_reference_matched, true, p_success, p_commitment, p_fee_payer,
    p_network_fee_lamports, 'verified', p_verified_at, true,
    coalesce(p_raw_observation,'{}'::jsonb), now(), null
  )
  on conflict (signature) do update set
    slot=excluded.slot,
    block_time=excluded.block_time,
    observed_amount_atomic=excluded.observed_amount_atomic,
    asset=excluded.asset,
    recipient=excluded.recipient,
    reference_matched=excluded.reference_matched,
    confirmed=true,
    success=excluded.success,
    commitment=excluded.commitment,
    fee_payer=excluded.fee_payer,
    network_fee_lamports=excluded.network_fee_lamports,
    verification_status='verified',
    verified_at=excluded.verified_at,
    is_authoritative=true,
    raw_transaction=excluded.raw_transaction,
    observed_at=now(),
    rejection_reason=null
  returning id into v_transaction_id;

  insert into public.pay_payment_transfers(
    payment_transaction_id, transfer_role, source, destination, asset, amount_atomic,
    token_mint, token_program, token_decimals, source_authority, destination_authority,
    instruction_index
  )
  select v_transaction_id,
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
  )
  values (p_payment_id, v_payment.asset, v_gross_fee, 0, v_gross_fee, 'eligible', p_verified_at)
  on conflict (payment_id) do nothing;

  update public.pay_payment_intents
     set status = 'confirmed', updated_at = now()
   where id = p_payment_id;

  insert into public.pay_payment_events(payment_id, event_type, from_status, to_status, request_id, actor_type, payload)
  values (
    p_payment_id,
    'payment.confirmed',
    v_payment.status,
    'confirmed',
    p_request_id,
    'system',
    jsonb_build_object('signature', p_signature, 'transaction_id', v_transaction_id)
  );

  return jsonb_build_object('ok', true, 'status', 'confirmed', 'transaction_id', v_transaction_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
end;
$$;

revoke all on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) to service_role;
