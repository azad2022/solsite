-- SolMint Pay Payment Link end-to-end contract.
-- Fixed payment links are merchant-managed reusable checkout entry points.
-- Customer checkout remains server-authoritative through the existing payment intent engine.

alter table public.pay_payment_links
  add column if not exists description text;

create or replace function public.pay_create_payment_link(
  p_merchant_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_fixed_amount_atomic numeric,
  p_asset text,
  p_fee_payer text,
  p_checkout_locale text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_link public.pay_payment_links%rowtype;
  v_existing public.pay_idempotency_keys%rowtype;
  v_response jsonb;
begin
  if current_setting('role', true) <> 'authenticated' then
    return jsonb_build_object('state','unauthorized');
  end if;

  v_user_id := public.pay_request_user_id();
  if v_user_id is null then
    return jsonb_build_object('state','unauthorized');
  end if;

  if p_merchant_id is null
     or p_slug is null
     or char_length(trim(p_slug)) < 3
     or char_length(trim(p_slug)) > 120
     or trim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_title is null
     or char_length(trim(p_title)) < 1
     or char_length(trim(p_title)) > 200
     or (p_description is not null and char_length(trim(p_description)) > 5000)
     or p_fixed_amount_atomic is null
     or p_fixed_amount_atomic <= 0
     or p_fixed_amount_atomic <> trunc(p_fixed_amount_atomic)
     or p_asset is null
     or p_asset not in ('SOL','USDC','USDT')
     or p_fee_payer is null
     or p_fee_payer not in ('merchant','customer')
     or p_checkout_locale is null
     or p_checkout_locale not in ('fa-IR','en-US','ar','ru','auto')
     or (p_expires_at is not null and p_expires_at <= now())
     or p_idempotency_key is null
     or char_length(trim(p_idempotency_key)) < 1
     or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null
     or char_length(trim(p_request_hash)) < 1
  then
    return jsonb_build_object('state','invalid');
  end if;

  if not public.pay_has_merchant_access(
    p_merchant_id,
    array['owner','admin','finance']::text[]
  ) then
    return jsonb_build_object('state','forbidden');
  end if;

  if not exists (
    select 1 from public.pay_merchants m
    where m.id = p_merchant_id
      and m.status = 'active'
  ) then
    return jsonb_build_object('state','merchant_not_active');
  end if;

  insert into public.pay_idempotency_keys (
    merchant_id, scope, idempotency_key, request_hash, status
  ) values (
    p_merchant_id, 'payment-links:create', trim(p_idempotency_key), trim(p_request_hash), 'processing'
  )
  on conflict (merchant_id, scope, idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing
    from public.pay_idempotency_keys
    where merchant_id = p_merchant_id
      and scope = 'payment-links:create'
      and idempotency_key = trim(p_idempotency_key)
    for update;

    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status = 'completed' and v_existing.response_body is not null then
      return jsonb_build_object(
        'state','replay',
        'response_body',v_existing.response_body,
        'response_status',coalesce(v_existing.response_status,200),
        'resource_id',v_existing.resource_id
      );
    end if;
    if v_existing.status = 'processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  insert into public.pay_payment_links (
    merchant_id, slug, title, description, fixed_amount_atomic, asset,
    fee_payer, checkout_locale, is_active, expires_at
  ) values (
    p_merchant_id, lower(trim(p_slug)), trim(p_title),
    nullif(trim(coalesce(p_description,'')), ''),
    p_fixed_amount_atomic, p_asset, p_fee_payer, p_checkout_locale, true, p_expires_at
  )
  returning * into v_link;

  v_response := jsonb_build_object(
    'apiVersion','v1',
    'data',jsonb_build_object(
      'id',v_link.id,
      'merchant_id',v_link.merchant_id,
      'slug',v_link.slug,
      'title',v_link.title,
      'description',v_link.description,
      'fixed_amount_atomic',v_link.fixed_amount_atomic::text,
      'asset',v_link.asset,
      'fee_payer',v_link.fee_payer,
      'checkout_locale',v_link.checkout_locale,
      'is_active',v_link.is_active,
      'expires_at',v_link.expires_at,
      'created_at',v_link.created_at,
      'updated_at',v_link.updated_at
    )
  );

  update public.pay_idempotency_keys
  set status = 'completed',
      response_status = 201,
      response_body = v_response,
      resource_type = 'payment_link',
      resource_id = v_link.id,
      completed_at = now()
  where merchant_id = p_merchant_id
    and scope = 'payment-links:create'
    and idempotency_key = trim(p_idempotency_key)
    and status = 'processing';

  if not found then raise exception 'payment link idempotency completion failed'; end if;

  return jsonb_build_object('state','created','response_status',201,'response_body',v_response,'resource_id',v_link.id);
exception
  when unique_violation then
    delete from public.pay_idempotency_keys
    where merchant_id = p_merchant_id
      and scope = 'payment-links:create'
      and idempotency_key = trim(p_idempotency_key);
    return jsonb_build_object('state','slug_exists');
end;
$$;

revoke all on function public.pay_create_payment_link(
  uuid,text,text,text,numeric,text,text,text,timestamptz,text,text
) from public, anon;
grant execute on function public.pay_create_payment_link(
  uuid,text,text,text,numeric,text,text,text,timestamptz,text,text
) to authenticated;

create or replace function public.pay_create_payment_intent_from_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
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
  v_result jsonb;
  v_resource_id uuid;
begin
  if p_payment_link_id is null then
    raise exception 'payment link id is required';
  end if;

  if not exists (
    select 1 from public.pay_payment_links l
    where l.id = p_payment_link_id
      and l.merchant_id = p_merchant_id
      and l.is_active = true
      and (l.expires_at is null or l.expires_at > now())
  ) then
    raise exception 'payment link is unavailable';
  end if;

  select public.pay_create_payment_intent(
    p_merchant_id,
    null,
    p_amount_atomic,
    p_asset,
    p_token_mint,
    p_token_program,
    p_token_decimals,
    p_recipient,
    p_reference,
    p_fee_bps,
    p_fee_payer,
    p_fee_atomic,
    p_customer_total_atomic,
    p_merchant_net_atomic,
    p_fee_recipient,
    p_network,
    p_expires_at,
    p_metadata,
    p_idempotency_key,
    p_request_hash,
    p_scope
  ) into v_result;

  v_resource_id := nullif(v_result->>'resource_id','')::uuid;

  if v_resource_id is not null then
    update public.pay_payment_intents
    set payment_link_id = p_payment_link_id
    where id = v_resource_id
      and merchant_id = p_merchant_id
      and (payment_link_id is null or payment_link_id = p_payment_link_id);
    if not found then raise exception 'payment link association failed'; end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text
) from public, anon, authenticated;
grant execute on function public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text
) to service_role;
