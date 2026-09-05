-- Critical invariant hardening for SolMint Pay.
-- This migration closes three classes of defects found by adversarial review:
-- 1) SECURITY DEFINER functions must use an empty search_path.
-- 2) Payment creation must validate authoritative merchant/wallet state and
--    recompute fee/accounting fields inside the database transaction.
-- 3) Wallet challenges must have one canonical schema/function path.

create or replace function public.pay_create_merchant(
  p_owner_user_id text,
  p_business_name text,
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.pay_merchants%rowtype;
begin
  if p_owner_user_id is null or length(trim(p_owner_user_id)) = 0
     or p_business_name is null or length(trim(p_business_name)) < 2
     or length(trim(p_business_name)) > 120
     or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,59}$' then
    raise exception 'invalid merchant input';
  end if;

  insert into public.pay_merchants(owner_user_id, business_name, slug, status)
  values (trim(p_owner_user_id), trim(p_business_name), trim(p_slug), 'pending')
  returning * into v_merchant;

  insert into public.pay_merchant_members(merchant_id, user_id, role, status)
  values (v_merchant.id, v_merchant.owner_user_id, 'owner', 'active');

  return jsonb_build_object(
    'id', v_merchant.id,
    'owner_user_id', v_merchant.owner_user_id,
    'business_name', v_merchant.business_name,
    'slug', v_merchant.slug,
    'status', v_merchant.status,
    'created_at', v_merchant.created_at,
    'updated_at', v_merchant.updated_at
  );
end;
$$;

revoke all on function public.pay_create_merchant(text,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_merchant(text,text,text) to service_role;

create or replace function public.pay_issue_wallet_challenge(
  p_merchant_id uuid,
  p_user_id text,
  p_wallet_address text,
  p_message text,
  p_nonce_hash text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.pay_merchants%rowtype;
  v_wallet public.pay_merchant_wallets%rowtype;
  v_challenge public.pay_wallet_challenges%rowtype;
begin
  if p_merchant_id is null or p_user_id is null or p_wallet_address is null
     or p_message is null or p_nonce_hash is null
     or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_issued_at is null or p_expires_at is null
     or p_expires_at <= p_issued_at
     or p_expires_at > p_issued_at + interval '10 minutes' then
    raise exception 'invalid wallet challenge input';
  end if;

  select * into v_merchant
    from public.pay_merchants
   where id = p_merchant_id
   for update;

  if not found or v_merchant.owner_user_id <> p_user_id
     or v_merchant.status in ('suspended','closed') then
    raise exception 'merchant forbidden';
  end if;

  select * into v_wallet
    from public.pay_merchant_wallets
   where merchant_id = p_merchant_id
     and wallet_role = 'receiving'
     and address = p_wallet_address
   for update;

  if not found then
    insert into public.pay_merchant_wallets(
      merchant_id, address, network, wallet_role, verification_status, is_active
    )
    values (p_merchant_id, p_wallet_address, 'solana', 'receiving', 'unverified', true)
    returning * into v_wallet;
  elsif v_wallet.verification_status = 'verified' and v_wallet.is_active then
    raise exception 'wallet already verified';
  end if;

  update public.pay_wallet_challenges
     set consumed_at = p_issued_at,
         status = 'expired'
   where merchant_id = p_merchant_id
     and wallet_address = p_wallet_address
     and consumed_at is null;

  insert into public.pay_wallet_challenges(
    merchant_id, wallet_address, message, nonce_hash,
    issued_at, expires_at, status
  ) values (
    p_merchant_id, p_wallet_address, p_message, p_nonce_hash,
    p_issued_at, p_expires_at, 'issued'
  )
  returning * into v_challenge;

  return jsonb_build_object(
    'id', v_challenge.id,
    'message', v_challenge.message,
    'wallet_address', v_challenge.wallet_address,
    'issued_at', v_challenge.issued_at,
    'expires_at', v_challenge.expires_at
  );
end;
$$;

revoke all on function public.pay_issue_wallet_challenge(uuid,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pay_issue_wallet_challenge(uuid,text,text,text,text,timestamptz,timestamptz) to service_role;

create or replace function public.pay_consume_wallet_challenge(
  p_challenge_id uuid,
  p_user_id text,
  p_signature_base58 text,
  p_signer_public_key text,
  p_verified_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.pay_wallet_challenges%rowtype;
  v_merchant public.pay_merchants%rowtype;
  v_wallet public.pay_merchant_wallets%rowtype;
  v_now timestamptz := coalesce(p_verified_at, now());
begin
  select * into v_challenge
    from public.pay_wallet_challenges
   where id = p_challenge_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_NOT_FOUND');
  end if;
  if v_challenge.consumed_at is not null or v_challenge.status <> 'issued' then
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_ALREADY_USED');
  end if;
  if v_challenge.issued_at > v_now or v_challenge.expires_at <= v_now then
    update public.pay_wallet_challenges
       set status = 'expired', consumed_at = v_now, rejection_reason = 'challenge_expired'
     where id = v_challenge.id and consumed_at is null;
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_EXPIRED');
  end if;

  select * into v_merchant
    from public.pay_merchants
   where id = v_challenge.merchant_id
   for update;

  if not found or v_merchant.owner_user_id <> p_user_id
     or v_merchant.status in ('suspended','closed') then
    return jsonb_build_object('ok', false, 'reason', 'MERCHANT_FORBIDDEN');
  end if;

  select * into v_wallet
    from public.pay_merchant_wallets
   where merchant_id = v_merchant.id
     and address = v_challenge.wallet_address
     and wallet_role = 'receiving'
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'WALLET_NOT_FOUND');
  end if;

  update public.pay_wallet_challenges
     set status = 'verified',
         consumed_at = v_now,
         signer_public_key = p_signer_public_key,
         signature_base58 = p_signature_base58,
         rejection_reason = null
   where id = v_challenge.id and consumed_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_ALREADY_USED');
  end if;

  update public.pay_merchant_wallets
     set verification_status = 'verified',
         is_active = true,
         verified_at = v_now,
         deactivated_at = null
   where id = v_wallet.id;

  update public.pay_merchant_wallets
     set is_active = false,
         deactivated_at = v_now
   where merchant_id = v_merchant.id
     and wallet_role = 'receiving'
     and id <> v_wallet.id
     and is_active = true;

  update public.pay_merchants
     set status = 'active', updated_at = v_now
   where id = v_merchant.id and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant.id,
    'wallet_id', v_wallet.id,
    'address', v_wallet.address,
    'verified_at', v_now
  );
end;
$$;

revoke all on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) to service_role;

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

  v_fee := (p_amount_atomic * p_fee_bps + 9999) / 10000;
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
         response_body = jsonb_build_object(
           'data', jsonb_build_object(
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
           )
         ),
         resource_type = 'payment_intent', resource_id = v_payment.id,
         completed_at = now()
   where merchant_id = p_merchant_id
     and scope = p_scope
     and idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'state', 'created',
    'response_status', 201,
    'response_body', jsonb_build_object(
      'data', jsonb_build_object(
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
      )
    ),
    'resource_id', v_payment.id
  );
exception
  when unique_violation then
    raise;
end;
$$;

revoke all on function public.pay_create_payment_intent(uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_payment_intent(uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text) to service_role;

-- The runtime uses pay_wallet_challenges as the canonical challenge table.
-- The earlier experimental duplicate is removed from the active schema because
-- no application code references it and production Pay tables are not deployed.
drop table if exists public.pay_wallet_ownership_challenges cascade;
