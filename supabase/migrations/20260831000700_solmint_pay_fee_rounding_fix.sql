-- Correct the gateway-fee ceiling calculation for PostgreSQL numeric arithmetic.
-- Assigning a fractional numeric expression directly to numeric(78,0) rounds it;
-- that is not equivalent to integer ceiling after adding the denominator-1.
-- Use CEIL() explicitly so exact multiples of 10,000 bps units do not overcharge.

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
  v_merchant public.pay_merchants%rowtype;
  v_wallet_count integer;
  v_fee numeric(78,0);
  v_customer_total numeric(78,0);
  v_merchant_net numeric(78,0);
begin
  if p_merchant_id is null
     or p_amount_atomic is null or p_amount_atomic <= 0
     or p_fee_bps <> 100
     or p_fee_payer not in ('merchant','customer')
     or p_network <> 'solana'
     or p_idempotency_key is null or p_idempotency_key = ''
     or p_request_hash is null or p_request_hash = ''
     or p_scope is null or p_scope = ''
     or p_reference is null or p_reference = ''
     or p_recipient is null or p_recipient = ''
     or p_fee_recipient is null or p_fee_recipient = ''
     or p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '24 hours' then
    raise exception 'invalid payment intent input';
  end if;

  if p_recipient = p_fee_recipient then
    raise exception 'destination collision';
  end if;

  if p_asset = 'SOL' then
    if p_token_mint is not null or p_token_program is not null or p_token_decimals is not null then
      raise exception 'invalid SOL token metadata';
    end if;
  elsif p_asset in ('USDC','USDT') then
    if p_token_mint is null or p_token_program <> 'spl-token'
       or p_token_decimals is null or p_token_decimals < 0 or p_token_decimals > 255 then
      raise exception 'unsupported token metadata';
    end if;
  else
    raise exception 'unsupported payment asset';
  end if;

  select * into v_merchant
    from public.pay_merchants
   where id = p_merchant_id
   for share;

  if not found or v_merchant.status <> 'active' then
    raise exception 'merchant not active';
  end if;

  select count(*) into v_wallet_count
    from public.pay_merchant_wallets
   where merchant_id = p_merchant_id
     and wallet_role = 'receiving'
     and is_active = true
     and verification_status = 'verified'
     and address = p_recipient;

  if v_wallet_count <> 1 then
    raise exception 'recipient wallet is not the sole active verified receiving wallet';
  end if;

  v_fee := ceil((p_amount_atomic * p_fee_bps) / 10000);
  if p_fee_payer = 'merchant' then
    v_customer_total := p_amount_atomic;
    v_merchant_net := p_amount_atomic - v_fee;
  else
    v_customer_total := p_amount_atomic + v_fee;
    v_merchant_net := p_amount_atomic;
  end if;

  if v_fee <= 0 or v_merchant_net <= 0 or v_customer_total <= 0 then
    raise exception 'invalid calculated payment amounts';
  end if;
  if p_fee_atomic <> v_fee or p_customer_total_atomic <> v_customer_total
     or p_merchant_net_atomic <> v_merchant_net then
    raise exception 'payment accounting snapshot mismatch';
  end if;

  select * into v_existing
    from public.pay_idempotency_keys
   where merchant_id = p_merchant_id
     and scope = p_scope
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.request_hash <> p_request_hash then
      return jsonb_build_object('state', 'conflict');
    end if;
    if v_existing.status = 'completed' and v_existing.response_body is not null then
      return jsonb_build_object('state', 'replay', 'response_status', coalesce(v_existing.response_status, 200), 'response_body', v_existing.response_body, 'resource_id', v_existing.resource_id);
    end if;
    if v_existing.status = 'processing' then
      return jsonb_build_object('state', 'in_progress');
    end if;

    update public.pay_idempotency_keys
       set status = 'processing', response_status = null, response_body = null,
           resource_type = null, resource_id = null, completed_at = null
     where id = v_existing.id;
  else
    insert into public.pay_idempotency_keys(
      merchant_id, scope, idempotency_key, request_hash, status
    ) values (
      p_merchant_id, p_scope, p_idempotency_key, p_request_hash, 'processing'
    );
  end if;

  insert into public.pay_payment_intents(
    merchant_id, external_order_id, amount_atomic, asset, token_mint,
    token_program, token_decimals, recipient, reference, fee_bps, fee_payer,
    fee_atomic, customer_total_atomic, merchant_net_atomic, fee_recipient,
    network, gas_sponsored, status, expires_at, metadata
  ) values (
    p_merchant_id, p_external_order_id, p_amount_atomic, p_asset, p_token_mint,
    p_token_program, p_token_decimals, p_recipient, p_reference, p_fee_bps,
    p_fee_payer, v_fee, v_customer_total, v_merchant_net, p_fee_recipient,
    p_network, false, 'created', p_expires_at, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_payment;

  update public.pay_idempotency_keys
     set status = 'completed', response_status = 201,
         response_body = jsonb_build_object('data', jsonb_build_object(
           'id', v_payment.id,
           'status', v_payment.status,
           'amountAtomic', v_payment.amount_atomic::text,
           'asset', v_payment.asset,
           'feePayer', v_payment.fee_payer,
           'gatewayFeeAtomic', v_payment.fee_atomic::text,
           'customerTotalAtomic', v_payment.customer_total_atomic::text,
           'merchantNetAtomic', v_payment.merchant_net_atomic::text,
           'reference', v_payment.reference,
           'checkoutUrl', 'https://solmint.ir/pay/checkout/' || v_payment.id::text,
           'expiresAt', v_payment.expires_at
         )),
         resource_type = 'payment_intent', resource_id = v_payment.id,
         completed_at = now()
   where merchant_id = p_merchant_id
     and scope = p_scope
     and idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'state', 'created',
    'response_status', 201,
    'response_body', jsonb_build_object('data', jsonb_build_object(
      'id', v_payment.id,
      'status', v_payment.status,
      'amountAtomic', v_payment.amount_atomic::text,
      'asset', v_payment.asset,
      'feePayer', v_payment.fee_payer,
      'gatewayFeeAtomic', v_payment.fee_atomic::text,
      'customerTotalAtomic', v_payment.customer_total_atomic::text,
      'merchantNetAtomic', v_payment.merchant_net_atomic::text,
      'reference', v_payment.reference,
      'checkoutUrl', 'https://solmint.ir/pay/checkout/' || v_payment.id::text,
      'expiresAt', v_payment.expires_at
    )),
    'resource_id', v_payment.id
  );
exception when unique_violation then
  raise;
end;
$$;

revoke all on function public.pay_create_payment_intent(uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_payment_intent(uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text) to service_role;
