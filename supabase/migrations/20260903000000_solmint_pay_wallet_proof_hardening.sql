-- Wallet proof hardening after adversarial review.
-- Cryptographic Ed25519 verification remains a server-side invariant in
-- functions/api/pay/.../wallet-challenges/[challengeId].ts. This migration
-- adds database-side binding so a verified challenge can never be committed
-- for a different signer or without a structurally valid proof record.

alter table public.pay_wallet_challenges
  add constraint pay_wallet_challenge_signature_check
  check (
    signature_base58 is null
    or signature_base58 ~ '^[1-9A-HJ-NP-Za-km-z]{86,88}$'
  );

alter table public.pay_wallet_challenges
  add constraint pay_wallet_challenge_signer_check
  check (
    signer_public_key is null
    or signer_public_key ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  );

create unique index if not exists pay_wallet_challenges_signature_uidx
  on public.pay_wallet_challenges (signature_base58)
  where signature_base58 is not null;

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
  if p_signature_base58 is null
     or p_signature_base58 !~ '^[1-9A-HJ-NP-Za-km-z]{86,88}$'
     or p_signer_public_key is null
     or p_signer_public_key !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PROOF');
  end if;

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

  if p_signer_public_key <> v_challenge.wallet_address then
    return jsonb_build_object('ok', false, 'reason', 'SIGNER_MISMATCH');
  end if;

  if exists (
    select 1
      from public.pay_wallet_challenges
     where signature_base58 = p_signature_base58
       and id <> v_challenge.id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_USED');
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
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_USED');
end;
$$;

revoke all on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) to service_role;
