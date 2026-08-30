-- Finalizes merchant ownership invariants after the existing Pay foundation chain.

create unique index if not exists pay_merchants_owner_user_uidx
  on public.pay_merchants (owner_user_id);

alter table public.pay_wallet_challenges
  add constraint pay_wallet_challenges_merchant_fk
  foreign key (merchant_id) references public.pay_merchants(id) on delete cascade;

alter table public.pay_merchant_members enable row level security;
revoke all on table public.pay_merchant_members from public, anon, authenticated;

create or replace function public.pay_create_merchant(
  p_owner_user_id text,
  p_business_name text,
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant public.pay_merchants%rowtype;
begin
  if p_owner_user_id is null or length(trim(p_owner_user_id)) = 0
     or p_business_name is null or length(trim(p_business_name)) < 2 or length(trim(p_business_name)) > 120
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
exception
  when unique_violation then
    raise;
end;
$$;

revoke all on function public.pay_create_merchant(text,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_merchant(text,text,text) to service_role;

create or replace function public.pay_consume_wallet_challenge(
  p_challenge_id uuid,
  p_user_id text,
  p_signature_base58 text,
  p_signer_public_key text,
  p_verified_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
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

  if not found or v_merchant.owner_user_id <> p_user_id or v_merchant.status in ('suspended','closed') then
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
