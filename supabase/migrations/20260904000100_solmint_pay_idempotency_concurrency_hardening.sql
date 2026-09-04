-- Concurrency hardening for Payment Intent idempotency.
-- Two identical requests may arrive concurrently. A read-then-insert sequence can
-- otherwise race into a unique_violation and surface as a misleading 503. The
-- idempotency row itself is the synchronization primitive: exactly one request
-- creates the processing record; concurrent identical requests observe either
-- the completed response or the explicit in-progress state.

create unique index if not exists pay_idempotency_merchant_scope_key_uidx
  on public.pay_idempotency_keys (merchant_id, scope, idempotency_key);

create or replace function public.pay_create_payment_intent(
  p_merchant_id uuid,
  p_external_order_id text,
  p_amount_atomic numeric,
  p_asset text,
  p_token_mint text,
  p_token_program text,
  p_token_decimals integer,
  p_recipient text,
  p_reference text,
  p_fee_bps integer,
  p_fee_payer text,
  p_fee_atomic numeric,
  p_customer_total_atomic numeric,
  p_merchant_net_atomic numeric,
  p_fee_recipient text,
  p_network text,
  p_expires_at timestamptz,
  p_metadata jsonb,
  p_idempotency_key text,
  p_request_hash text,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.pay_idempotency_keys%rowtype;
  v_payment public.pay_payment_intents%rowtype;
  v_inserted boolean := false;
  v_expected_fee numeric;
  v_expected_customer_total numeric;
  v_expected_merchant_net numeric;
  v_response_body jsonb;
begin
  if p_merchant_id is null
     or p_amount_atomic is null
     or p_amount_atomic <= 0
     or p_amount_atomic <> trunc(p_amount_atomic)
     or p_asset is null
     or p_fee_bps is null
     or p_fee_bps <> 100
     or p_fee_payer is null
     or p_fee_payer not in ('merchant','customer')
     or p_network is null
     or p_network <> 'solana'
     or p_idempotency_key is null or p_idempotency_key = ''
     or p_request_hash is null or p_request_hash = ''
     or p_scope is null or p_scope = ''
     or p_reference is null or p_reference = ''
     or p_recipient is null or p_recipient = ''
     or p_fee_recipient is null or p_fee_recipient = ''
     or p_expires_at is null then
    raise exception 'invalid payment intent input';
  end if;

  if p_asset = 'SOL' then
    if p_token_mint is not null or p_token_program is not null or p_token_decimals is not null then
      raise exception 'native SOL must not have token metadata';
    end if;
  elsif p_asset in ('USDC','USDT') then
    if p_token_mint is null
       or p_token_program is null
       or p_token_program <> 'spl-token'
       or p_token_decimals is null
       or p_token_decimals < 0
       or p_token_decimals > 255 then
      raise exception 'unsupported stablecoin token metadata';
    end if;
  else
    raise exception 'unsupported payment asset';
  end if;

  v_expected_fee := ceil((p_amount_atomic * p_fee_bps) / 10000);
  v_expected_merchant_net := case
    when p_fee_payer = 'merchant' then p_amount_atomic - v_expected_fee
    else p_amount_atomic
  end;
  v_expected_customer_total := case
    when p_fee_payer = 'customer' then p_amount_atomic + v_expected_fee
    else p_amount_atomic
  end;

  if v_expected_merchant_net < 0 then
    raise exception 'gateway fee exceeds merchant amount';
  end if;

  if p_fee_atomic is null or p_fee_atomic <> v_expected_fee
     or p_customer_total_atomic is null or p_customer_total_atomic <> v_expected_customer_total
     or p_merchant_net_atomic is null or p_merchant_net_atomic <> v_expected_merchant_net then
    raise exception 'payment fee invariants do not match canonical calculation';
  end if;

  insert into public.pay_idempotency_keys (
    merchant_id, scope, idempotency_key, request_hash, status
  ) values (
    p_merchant_id, p_scope, p_idempotency_key, p_request_hash, 'processing'
  )
  on conflict (merchant_id, scope, idempotency_key) do nothing
  returning * into v_existing;

  if found then
    v_inserted := true;
  else
    select * into v_existing
      from public.pay_idempotency_keys
     where merchant_id = p_merchant_id
       and scope = p_scope
       and idempotency_key = p_idempotency_key
     for update;

    if not found then
      raise exception 'idempotency record disappeared unexpectedly';
    end if;

    if v_existing.request_hash <> p_request_hash then
      return jsonb_build_object('state', 'conflict');
    end if;
    if v_existing.status = 'completed' and v_existing.response_body is not null then
      return jsonb_build_object(
        'state', 'replay',
        'response_status', coalesce(v_existing.response_status, 200),
        'response_body', v_existing.response_body,
        'resource_id', v_existing.resource_id
      );
    end if;
    if v_existing.status = 'processing' then
      return jsonb_build_object('state', 'in_progress');
    end if;
    if v_existing.status = 'failed' then
      raise exception 'idempotency record is in failed state';
    end if;
    raise exception 'invalid idempotency record state';
  end if;

  if not v_inserted then
    raise exception 'idempotency acquisition failed';
  end if;

  insert into public.pay_payment_intents (
    merchant_id, external_order_id, amount_atomic, asset, token_mint,
    token_program, token_decimals, recipient, reference, fee_bps, fee_payer,
    fee_atomic, customer_total_atomic, merchant_net_atomic, fee_recipient,
    network, gas_sponsored, status, expires_at, metadata
  ) values (
    p_merchant_id, p_external_order_id, p_amount_atomic, p_asset, p_token_mint,
    p_token_program, p_token_decimals, p_recipient, p_reference, p_fee_bps, p_fee_payer,
    v_expected_fee, v_expected_customer_total, v_expected_merchant_net, p_fee_recipient,
    p_network, false, 'created', p_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_payment;

  v_response_body := jsonb_build_object('data', jsonb_build_object(
    'id', v_payment.id,
    'status', v_payment.status,
    'amountAtomic', v_payment.amount_atomic::text,
    'asset', v_payment.asset,
    'tokenMint', v_payment.token_mint,
    'tokenProgram', v_payment.token_program,
    'tokenDecimals', v_payment.token_decimals,
    'feePayer', v_payment.fee_payer,
    'gatewayFeeAtomic', v_payment.fee_atomic::text,
    'customerTotalAtomic', v_payment.customer_total_atomic::text,
    'merchantNetAtomic', v_payment.merchant_net_atomic::text,
    'reference', v_payment.reference,
    'checkoutUrl', 'https://solmint.ir/pay/checkout/' || v_payment.id::text,
    'expiresAt', v_payment.expires_at
  ));

  update public.pay_idempotency_keys
     set status = 'completed',
         response_status = 201,
         response_body = v_response_body,
         resource_type = 'payment_intent',
         resource_id = v_payment.id,
         completed_at = now()
   where merchant_id = p_merchant_id
     and scope = p_scope
     and idempotency_key = p_idempotency_key
     and status = 'processing';

  if not found then
    raise exception 'idempotency completion update failed';
  end if;

  return jsonb_build_object(
    'state', 'created',
    'response_status', 201,
    'response_body', v_response_body,
    'resource_id', v_payment.id
  );
exception
  when unique_violation then
    raise;
end;
$$;

revoke all on function public.pay_create_payment_intent(
  uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text
) from public, anon, authenticated;

grant execute on function public.pay_create_payment_intent(
  uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text
) to service_role;
