create table if not exists public.pay_merchants (
  id text primary key default gen_random_uuid()::text,
  owner_user_id text not null references public.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pay_merchants_owner_user_uidx on public.pay_merchants(owner_user_id);
create index if not exists pay_merchants_status_idx on public.pay_merchants(status);

create table if not exists public.pay_merchant_wallets (
  id text primary key default gen_random_uuid()::text,
  merchant_id text not null references public.pay_merchants(id) on delete cascade,
  wallet_role text not null default 'receiving' check (wallet_role in ('receiving','gas')),
  address text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','revoked')),
  is_active boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, wallet_role, address)
);

create unique index if not exists pay_merchant_one_active_receiving_wallet_uidx
  on public.pay_merchant_wallets(merchant_id)
  where wallet_role = 'receiving' and is_active = true and verification_status = 'verified';

create index if not exists pay_merchant_wallets_merchant_idx on public.pay_merchant_wallets(merchant_id);
create index if not exists pay_merchant_wallets_address_idx on public.pay_merchant_wallets(address);

create table if not exists public.pay_wallet_challenges (
  id text primary key default gen_random_uuid()::text,
  merchant_id text not null references public.pay_merchants(id) on delete cascade,
  wallet_id text not null references public.pay_merchant_wallets(id) on delete cascade,
  origin text not null,
  challenge_message text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check (expires_at <= issued_at + interval '10 minutes')
);

create unique index if not exists pay_wallet_one_active_challenge_uidx
  on public.pay_wallet_challenges(wallet_id)
  where consumed_at is null;

create index if not exists pay_wallet_challenges_merchant_idx on public.pay_wallet_challenges(merchant_id);
create index if not exists pay_wallet_challenges_expires_idx on public.pay_wallet_challenges(expires_at);

alter table public.pay_merchants enable row level security;
alter table public.pay_merchant_wallets enable row level security;
alter table public.pay_wallet_challenges enable row level security;

revoke all on table public.pay_merchants from public, anon, authenticated;
revoke all on table public.pay_merchant_wallets from public, anon, authenticated;
revoke all on table public.pay_wallet_challenges from public, anon, authenticated;

drop function if exists public.pay_consume_wallet_challenge(text, text, timestamptz);
create or replace function public.pay_consume_wallet_challenge(
  p_challenge_id text,
  p_user_id text,
  p_verified_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.pay_wallet_challenges%rowtype;
  v_wallet public.pay_merchant_wallets%rowtype;
  v_merchant public.pay_merchants%rowtype;
  v_now timestamptz := coalesce(p_verified_at, now());
begin
  select * into v_challenge
    from public.pay_wallet_challenges
   where id = p_challenge_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_NOT_FOUND');
  end if;

  if v_challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'CHALLENGE_ALREADY_USED');
  end if;

  if v_challenge.expires_at <= v_now or v_challenge.issued_at > v_now then
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
   where id = v_challenge.wallet_id
   for update;

  if not found or v_wallet.merchant_id <> v_merchant.id or v_wallet.wallet_role <> 'receiving' then
    return jsonb_build_object('ok', false, 'reason', 'WALLET_NOT_FOUND');
  end if;

  update public.pay_wallet_challenges
     set consumed_at = v_now
   where id = v_challenge.id and consumed_at is null;

  update public.pay_merchant_wallets
     set verification_status = 'verified',
         is_active = true,
         verified_at = v_now,
         updated_at = v_now
   where id = v_wallet.id;

  update public.pay_merchant_wallets
     set is_active = false,
         updated_at = v_now
   where merchant_id = v_merchant.id
     and wallet_role = 'receiving'
     and id <> v_wallet.id;

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

revoke all on function public.pay_consume_wallet_challenge(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_consume_wallet_challenge(text, text, timestamptz) to service_role;
