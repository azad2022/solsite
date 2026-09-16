-- SolMint Pay: keep the persisted wallet-challenge id identical to the id embedded in the signed challenge message.
create or replace function public.pay_issue_wallet_challenge(
  p_merchant_id uuid,
  p_user_id text,
  p_wallet_address text,
  p_message text,
  p_nonce_hash text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_merchant public.pay_merchants%rowtype;
  v_wallet public.pay_merchant_wallets%rowtype;
  v_challenge public.pay_wallet_challenges%rowtype;
  v_message_challenge_id uuid;
begin
  if p_merchant_id is null or p_user_id is null or p_wallet_address is null
     or p_message is null or p_nonce_hash is null
     or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_issued_at is null or p_expires_at is null
     or p_expires_at <= p_issued_at
     or p_expires_at > p_issued_at + interval '10 minutes' then
    raise exception 'invalid wallet challenge input';
  end if;

  begin
    v_message_challenge_id := (regexp_match(p_message, E'(?m)^Challenge: ([0-9a-fA-F-]{36})$'))[1]::uuid;
  exception when others then
    raise exception 'invalid wallet challenge id';
  end;
  if v_message_challenge_id is null then
    raise exception 'invalid wallet challenge id';
  end if;

  select * into v_merchant from public.pay_merchants where id = p_merchant_id for update;
  if not found or v_merchant.owner_user_id <> p_user_id or v_merchant.status in ('suspended','closed') then
    raise exception 'merchant forbidden';
  end if;

  select * into v_wallet from public.pay_merchant_wallets
   where merchant_id = p_merchant_id and wallet_role = 'receiving' and address = p_wallet_address
   for update;
  if not found then
    insert into public.pay_merchant_wallets(merchant_id, address, network, wallet_role, verification_status, is_active)
    values (p_merchant_id, p_wallet_address, 'solana', 'receiving', 'unverified', true)
    returning * into v_wallet;
  elsif v_wallet.verification_status = 'verified' and v_wallet.is_active then
    raise exception 'wallet already verified';
  end if;

  update public.pay_wallet_challenges
     set consumed_at = p_issued_at, status = 'expired'
   where merchant_id = p_merchant_id and wallet_address = p_wallet_address and consumed_at is null;

  insert into public.pay_wallet_challenges(
    id, merchant_id, wallet_address, message, nonce_hash, issued_at, expires_at, status
  ) values (
    v_message_challenge_id, p_merchant_id, p_wallet_address, p_message, p_nonce_hash, p_issued_at, p_expires_at, 'issued'
  ) returning * into v_challenge;

  return jsonb_build_object(
    'id', v_challenge.id,
    'message', v_challenge.message,
    'wallet_address', v_challenge.wallet_address,
    'issued_at', v_challenge.issued_at,
    'expires_at', v_challenge.expires_at
  );
end;
$function$;

revoke all on function public.pay_issue_wallet_challenge(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
