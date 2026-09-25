-- SolMint Pay Invoice creation contract.
-- Browser callers are server-mediated through the authenticated Pay identity.

create or replace function public.pay_create_invoice(
  p_merchant_id uuid,
  p_invoice_number text,
  p_customer_label text,
  p_title text,
  p_description text,
  p_amount_atomic numeric,
  p_asset text,
  p_fee_payer text,
  p_checkout_locale text,
  p_due_at timestamptz,
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
  v_invoice public.pay_invoices%rowtype;
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
     or p_invoice_number is null or char_length(trim(p_invoice_number)) < 1 or char_length(trim(p_invoice_number)) > 120
     or p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 200
     or (p_customer_label is not null and char_length(trim(p_customer_label)) > 160)
     or (p_description is not null and char_length(trim(p_description)) > 5000)
     or p_amount_atomic is null or p_amount_atomic <= 0 or p_amount_atomic <> trunc(p_amount_atomic)
     or p_asset is null or p_asset not in ('SOL','USDC','USDT')
     or p_fee_payer is null or p_fee_payer not in ('merchant','customer')
     or p_checkout_locale is null or p_checkout_locale not in ('fa-IR','en-US','ar','ru','auto')
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 1 or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  if not exists (
    select 1
      from public.users u
      join public.pay_merchant_members m on m.user_id = u.id
     where u.id = v_user_id
       and u.is_active = true
       and m.merchant_id = p_merchant_id
       and m.status = 'active'
       and m.role in ('owner','admin','finance')
  ) then
    return jsonb_build_object('state','forbidden');
  end if;

  if not exists (
    select 1 from public.pay_merchants m
     where m.id = p_merchant_id and m.status = 'active'
  ) then
    return jsonb_build_object('state','merchant_not_active');
  end if;

  insert into public.pay_idempotency_keys (
    merchant_id, scope, idempotency_key, request_hash, status
  ) values (
    p_merchant_id, 'invoices:create', trim(p_idempotency_key), trim(p_request_hash), 'processing'
  )
  on conflict (merchant_id, scope, idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing
      from public.pay_idempotency_keys
     where merchant_id = p_merchant_id
       and scope = 'invoices:create'
       and idempotency_key = trim(p_idempotency_key)
     for update;

    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status = 'completed' and v_existing.response_body is not null then
      return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,200));
    end if;
    if v_existing.status = 'processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  insert into public.pay_invoices (
    merchant_id, invoice_number, customer_label, title, description,
    amount_atomic, asset, fee_payer, checkout_locale, due_at, status
  ) values (
    p_merchant_id, trim(p_invoice_number),
    nullif(trim(coalesce(p_customer_label,'')), ''),
    trim(p_title), nullif(trim(coalesce(p_description,'')), ''),
    p_amount_atomic, p_asset, p_fee_payer, p_checkout_locale, p_due_at, 'open'
  )
  returning * into v_invoice;

  v_response := jsonb_build_object(
    'data', jsonb_build_object(
      'id', v_invoice.id,
      'merchant_id', v_invoice.merchant_id,
      'invoice_number', v_invoice.invoice_number,
      'customer_label', v_invoice.customer_label,
      'title', v_invoice.title,
      'description', v_invoice.description,
      'amount_atomic', v_invoice.amount_atomic::text,
      'asset', v_invoice.asset,
      'fee_payer', v_invoice.fee_payer,
      'checkout_locale', v_invoice.checkout_locale,
      'due_at', v_invoice.due_at,
      'status', v_invoice.status,
      'created_at', v_invoice.created_at,
      'updated_at', v_invoice.updated_at
    )
  );

  update public.pay_idempotency_keys
     set status = 'completed',
         response_status = 201,
         response_body = v_response,
         resource_type = 'invoice',
         resource_id = v_invoice.id,
         completed_at = now()
   where merchant_id = p_merchant_id
     and scope = 'invoices:create'
     and idempotency_key = trim(p_idempotency_key)
     and status = 'processing';

  if not found then raise exception 'invoice idempotency completion failed'; end if;

  return jsonb_build_object('state','created','response_status',201,'response_body',v_response,'resource_id',v_invoice.id);
exception
  when unique_violation then
    delete from public.pay_idempotency_keys
     where merchant_id = p_merchant_id
       and scope = 'invoices:create'
       and idempotency_key = trim(p_idempotency_key);
    return jsonb_build_object('state','duplicate_invoice');
end;
$$;

revoke all on function public.pay_create_invoice(
  uuid,text,text,text,text,numeric,text,text,text,timestamptz,text,text
) from public, anon;
grant execute on function public.pay_create_invoice(
  uuid,text,text,text,text,numeric,text,text,text,timestamptz,text,text
) to authenticated;
