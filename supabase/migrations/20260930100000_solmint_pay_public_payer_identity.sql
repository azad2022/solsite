-- SolMint Pay: public payment-link payer identity.
-- Payer details are captured without account registration and remain server-side
-- Payment Intent data; the public Payment Intent GET contract does not expose them.

alter table public.pay_payment_intents
  add column if not exists customer_first_name text,
  add column if not exists customer_last_name text,
  add column if not exists customer_purpose text;

alter table public.pay_payment_intents
  drop constraint if exists pay_payment_customer_first_name_length_check,
  drop constraint if exists pay_payment_customer_last_name_length_check,
  drop constraint if exists pay_payment_customer_purpose_length_check;

alter table public.pay_payment_intents
  add constraint pay_payment_customer_first_name_length_check
    check (customer_first_name is null or (char_length(btrim(customer_first_name)) between 1 and 120)),
  add constraint pay_payment_customer_last_name_length_check
    check (customer_last_name is null or (char_length(btrim(customer_last_name)) between 1 and 120)),
  add constraint pay_payment_customer_purpose_length_check
    check (customer_purpose is null or (char_length(btrim(customer_purpose)) between 1 and 1000));

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
  p_scope text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_purpose text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_resource_id uuid;
  v_first_name text := nullif(regexp_replace(coalesce(p_customer_first_name, ''), '[[:space:]]+', ' ', 'g'), '');
  v_last_name text := nullif(regexp_replace(coalesce(p_customer_last_name, ''), '[[:space:]]+', ' ', 'g'), '');
  v_purpose text := nullif(regexp_replace(coalesce(p_customer_purpose, ''), '[[:space:]]+', ' ', 'g'), '');
begin
  if v_first_name is null
     or char_length(v_first_name) > 120
     or v_last_name is null
     or char_length(v_last_name) > 120
     or v_purpose is null
     or char_length(v_purpose) > 1000 then
    raise exception 'invalid public payer identity';
  end if;

  if p_payment_link_id is null then
    raise exception 'payment link id is required';
  end if;

  if not exists (
    select 1
      from public.pay_payment_links l
     where l.id = p_payment_link_id
       and l.merchant_id = p_merchant_id
       and l.is_active = true
       and (l.expires_at is null or l.expires_at > now())
  ) then
    raise exception 'payment link is unavailable';
  end if;

  v_result := public.pay_create_payment_intent(
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
  );

  v_resource_id := nullif(v_result->>'resource_id','')::uuid;

  if v_resource_id is not null then
    update public.pay_payment_intents
       set payment_link_id = p_payment_link_id,
           customer_first_name = v_first_name,
           customer_last_name = v_last_name,
           customer_purpose = v_purpose
     where id = v_resource_id
       and merchant_id = p_merchant_id
       and (payment_link_id is null or payment_link_id = p_payment_link_id);

    if not found then
      raise exception 'payment link association or payer identity update failed';
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text
) from public, anon, authenticated;

grant execute on function public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text
) to service_role;

comment on column public.pay_payment_intents.customer_first_name is 'Payer-provided first name captured by public Payment Link checkout; never exposed by the public Payment Intent GET endpoint.';
comment on column public.pay_payment_intents.customer_last_name is 'Payer-provided last name captured by public Payment Link checkout; never exposed by the public Payment Intent GET endpoint.';
comment on column public.pay_payment_intents.customer_purpose is 'Payer-provided payment purpose captured by public Payment Link checkout; never exposed by the public Payment Intent GET endpoint.';
