-- SolMint Pay Payment Link merchant mutation contract.
-- Historical Payment Intent snapshots are immutable with respect to later link edits.
-- Hard deletion is permitted only when no Payment Intent references the link.

create or replace function public.pay_update_payment_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_fixed_amount_atomic numeric,
  p_asset text,
  p_fee_payer text,
  p_checkout_locale text,
  p_is_active boolean,
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

  if p_payment_link_id is null or p_merchant_id is null
     or p_slug is null or char_length(trim(p_slug)) < 3 or char_length(trim(p_slug)) > 120
     or trim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 200
     or (p_description is not null and char_length(trim(p_description)) > 5000)
     or p_fixed_amount_atomic is null or p_fixed_amount_atomic <= 0
     or p_fixed_amount_atomic <> trunc(p_fixed_amount_atomic)
     or p_asset is null or p_asset not in ('SOL','USDC','USDT')
     or p_fee_payer is null or p_fee_payer not in ('merchant','customer')
     or p_checkout_locale is null or p_checkout_locale not in ('fa-IR','en-US','ar','ru','auto')
     or p_is_active is null
     or (p_is_active and p_expires_at is not null and p_expires_at <= now())
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 1 or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_link
    from public.pay_payment_links
   where id = p_payment_link_id
     and merchant_id = p_merchant_id
   for update;

  if not found then
    return jsonb_build_object('state','not_found');
  end if;

  if not public.pay_has_merchant_access(
    v_link.merchant_id,
    array['owner','admin','finance']::text[]
  ) then
    return jsonb_build_object('state','forbidden');
  end if;

  if not exists (
    select 1 from public.pay_merchants m
     where m.id = v_link.merchant_id and m.status = 'active'
  ) then
    return jsonb_build_object('state','merchant_not_active');
  end if;

  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(v_link.merchant_id,'payment-links:update',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing from public.pay_idempotency_keys
     where merchant_id=v_link.merchant_id and scope='payment-links:update' and idempotency_key=trim(p_idempotency_key)
     for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then
      return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,200),'resource_id',v_existing.resource_id);
    end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  update public.pay_payment_links
     set slug=lower(trim(p_slug)),
         title=trim(p_title),
         description=nullif(trim(coalesce(p_description,'')),''),
         fixed_amount_atomic=p_fixed_amount_atomic,
         asset=p_asset,
         fee_payer=p_fee_payer,
         checkout_locale=p_checkout_locale,
         is_active=p_is_active,
         expires_at=p_expires_at,
         updated_at=now()
   where id=v_link.id and merchant_id=v_link.merchant_id
  returning * into v_link;

  v_response := jsonb_build_object('apiVersion','v1','data',jsonb_build_object(
    'id',v_link.id,'merchant_id',v_link.merchant_id,'slug',v_link.slug,'title',v_link.title,
    'description',v_link.description,'fixed_amount_atomic',v_link.fixed_amount_atomic::text,
    'asset',v_link.asset,'fee_payer',v_link.fee_payer,'checkout_locale',v_link.checkout_locale,
    'is_active',v_link.is_active,'expires_at',v_link.expires_at,'created_at',v_link.created_at,'updated_at',v_link.updated_at
  ));

  update public.pay_idempotency_keys
     set status='completed',response_status=200,response_body=v_response,resource_type='payment_link',resource_id=v_link.id,completed_at=now()
   where merchant_id=v_link.merchant_id and scope='payment-links:update' and idempotency_key=trim(p_idempotency_key) and status='processing';
  if not found then raise exception 'payment link idempotency completion failed'; end if;

  return jsonb_build_object('state','updated','response_status',200,'response_body',v_response,'resource_id',v_link.id);
exception
  when unique_violation then
    delete from public.pay_idempotency_keys
     where merchant_id=p_merchant_id and scope='payment-links:update' and idempotency_key=trim(p_idempotency_key);
    return jsonb_build_object('state','slug_exists');
end;
$$;

revoke all on function public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text
) from public,anon;
grant execute on function public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text
) to authenticated;


create or replace function public.pay_delete_payment_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
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

  if p_payment_link_id is null or p_merchant_id is null
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 1 or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_link from public.pay_payment_links
   where id=p_payment_link_id and merchant_id=p_merchant_id
   for update;
  if not found then return jsonb_build_object('state','not_found'); end if;

  if not public.pay_has_merchant_access(v_link.merchant_id,array['owner','admin','finance']::text[]) then
    return jsonb_build_object('state','forbidden');
  end if;

  if not exists (select 1 from public.pay_merchants m where m.id=v_link.merchant_id and m.status='active') then
    return jsonb_build_object('state','merchant_not_active');
  end if;

  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(v_link.merchant_id,'payment-links:delete',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing from public.pay_idempotency_keys
     where merchant_id=v_link.merchant_id and scope='payment-links:delete' and idempotency_key=trim(p_idempotency_key)
     for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then
      return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,200),'resource_id',v_existing.resource_id);
    end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  if exists(select 1 from public.pay_payment_intents where payment_link_id=v_link.id) then
    delete from public.pay_idempotency_keys
     where merchant_id=v_link.merchant_id and scope='payment-links:delete' and idempotency_key=trim(p_idempotency_key);
    return jsonb_build_object('state','has_payments');
  end if;

  delete from public.pay_payment_links where id=v_link.id and merchant_id=v_link.merchant_id;
  if not found then raise exception 'payment link delete failed'; end if;

  v_response := jsonb_build_object('apiVersion','v1','data',jsonb_build_object(
    'id',v_link.id,'merchantId',v_link.merchant_id,'deleted',true
  ));

  update public.pay_idempotency_keys
     set status='completed',response_status=200,response_body=v_response,resource_type='payment_link',resource_id=v_link.id,completed_at=now()
   where merchant_id=v_link.merchant_id and scope='payment-links:delete' and idempotency_key=trim(p_idempotency_key) and status='processing';
  if not found then raise exception 'payment link idempotency completion failed'; end if;

  return jsonb_build_object('state','deleted','response_status',200,'response_body',v_response,'resource_id',v_link.id);
exception
  when foreign_key_violation then
    delete from public.pay_idempotency_keys
     where merchant_id=p_merchant_id and scope='payment-links:delete' and idempotency_key=trim(p_idempotency_key);
    return jsonb_build_object('state','has_payments');
end;
$$;

revoke all on function public.pay_delete_payment_link(uuid,uuid,text,text) from public,anon;
grant execute on function public.pay_delete_payment_link(uuid,uuid,text,text) to authenticated;

comment on function public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text
) is 'Merchant-scoped Payment Link update. Historical Payment Intent snapshots are unchanged.';

comment on function public.pay_delete_payment_link(
  uuid,uuid,text,text
) is 'Merchant-scoped Payment Link delete. Refuses deletion when a Payment Intent references the link; deactivate instead.';
