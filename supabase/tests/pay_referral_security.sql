-- SolMint Pay Referral security/adversarial fixture.
-- Covers single-level attribution, click counting, owner-scoped reads,
-- server-only writes, signup timing, and authoritative 50% commission creation.

DO $setup$
begin
  create extension if not exists pgcrypto;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $setup$;

create table public.users (
  id text primary key,
  username text not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pay_affiliates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text,
  display_name text not null,
  referral_code text not null unique,
  commission_rate_bps integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_affiliate_rate_check check (commission_rate_bps between 0 and 10000),
  constraint pay_affiliate_status_check check (status in ('pending','active','suspended','closed'))
);

create table public.pay_merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  business_name text not null,
  slug text not null unique,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pay_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.pay_affiliates(id),
  merchant_id uuid not null references public.pay_merchants(id),
  referral_code text not null unique,
  attributed_at timestamptz not null default now(),
  active boolean not null default true,
  unique (affiliate_id, merchant_id)
);

create table public.pay_payment_intents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id),
  asset text not null,
  token_decimals integer,
  status text not null default 'pending'
);

create table public.pay_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.pay_referrals(id),
  payment_id uuid not null references public.pay_payment_intents(id),
  gross_gateway_fee_atomic numeric(78,0) not null,
  commission_bps integer not null,
  commission_atomic numeric(78,0) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  unique (referral_id, payment_id)
);

create table public.pay_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pay_payment_intents(id),
  asset text not null,
  gross_gateway_fee_atomic numeric(78,0) not null,
  referral_commission_atomic numeric(78,0) not null default 0,
  net_gateway_revenue_atomic numeric(78,0) not null,
  status text not null default 'eligible',
  recognized_at timestamptz not null default now()
);

create function public.pay_request_user_id()
returns text
language sql
stable
security definer
set search_path=''
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'solmint_user_id','');
$$;

create function public.pay_has_affiliate_access(p_affiliate_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1 from public.pay_affiliates a
    where a.id=p_affiliate_id
      and a.owner_user_id=public.pay_request_user_id()
      and a.status in ('pending','active')
  );
$$;

\i supabase/migrations/20260930210000_solmint_pay_referral_program.sql

insert into public.users(id,username,full_name,created_at)
values
 ('user-a','a','Affiliate A',now() - interval '10 minutes');

DO $check$
begin
  if (select count(*) from public.pay_affiliates) <> 1 then
    raise exception 'the seed user must receive exactly one affiliate record';
  end if;
end $check$;

update public.pay_affiliates
   set referral_code = 'sm_test_a'
 where owner_user_id = 'user-a';

-- The fixture exercises server-side mutations under service_role. Its test role
-- must therefore be able to create synthetic application users without changing
-- production grants or RLS.
grant select, insert on public.users to service_role;
grant select on public.pay_affiliates to service_role;

begin;
set local role service_role;

DO $service$
declare
  a_code text;
  b_code text;
  click_a uuid;
  click_b uuid;
  result jsonb;
begin
  a_code := 'sm_test_a';

  result := public.pay_record_referral_click(a_code);
  if result->>'ok' <> 'true' then raise exception 'A click record failed: %', result; end if;
  click_a := (result->>'click_id')::uuid;

  insert into public.users(id,username,full_name,created_at)
  values ('user-b','b','User B',now());

  select referral_code into b_code
    from public.pay_affiliates
   where owner_user_id='user-b';

  if b_code is null or length(btrim(b_code)) < 4 then
    raise exception 'B affiliate code was not provisioned';
  end if;

  result := public.pay_attribute_referral_from_click(click_a,a_code,'user-b');
  if result->>'attributed' <> 'true' then raise exception 'B attribution failed: %', result; end if;

  result := public.pay_record_referral_click(b_code);
  if result->>'ok' <> 'true' then raise exception 'B click record failed: %', result; end if;
  click_b := (result->>'click_id')::uuid;

  insert into public.users(id,username,full_name,created_at)
  values ('user-c','c','User C',now());

  result := public.pay_attribute_referral_from_click(click_b,b_code,'user-c');
  if result->>'attributed' <> 'true' then raise exception 'C attribution failed: %', result; end if;

  result := public.pay_record_referral_click(a_code);
  click_a := (result->>'click_id')::uuid;
  result := public.pay_attribute_referral_from_click(click_a,a_code,'user-a');
  if result->>'attributed' = 'true' then
    raise exception 'self-referral must never create attribution: %', result;
  end if;

  result := public.pay_attribute_referral_from_click(click_b,b_code,'user-a');
  if result->>'reason' <> 'CLICK_ALREADY_CONSUMED' then raise exception 'consumed click must remain unusable: %', result; end if;
end $service$;

-- Direct assertions below use the isolated database owner; mutation RPCs above
-- were exercised under service_role as they would be in the server boundary.
set local role postgres;

DO $counts$
begin
  if (select count(*) from public.pay_referral_click_events where affiliate_id=(select id from public.pay_affiliates where owner_user_id='user-a')) <> 1
     or (select count(*) from public.pay_referral_click_events where affiliate_id=(select id from public.pay_affiliates where owner_user_id='user-b')) <> 1 then
    raise exception 'click counts are not independent per affiliate';
  end if;

  if (select count(*) from public.pay_referral_user_attributions where affiliate_id=(select id from public.pay_affiliates where owner_user_id='user-a')) <> 1 then
    raise exception 'A must have exactly one direct signup';
  end if;

  if (select count(*) from public.pay_referral_user_attributions where affiliate_id=(select id from public.pay_affiliates where owner_user_id='user-b')) <> 1 then
    raise exception 'B must have exactly one direct signup';
  end if;
end $counts$;

insert into public.pay_merchants(owner_user_id,business_name,slug)
values
 ('user-b','Merchant B','merchant-b'),
 ('user-c','Merchant C','merchant-c');

DO $single_level$
declare
  a_id uuid;
  b_id uuid;
begin
  select id into a_id from public.pay_affiliates where owner_user_id='user-a';
  select id into b_id from public.pay_affiliates where owner_user_id='user-b';

  if (select count(*) from public.pay_referrals where affiliate_id=a_id and merchant_id=(select id from public.pay_merchants where slug='merchant-b')) <> 1 then
    raise exception 'merchant B must be directly attributed to A';
  end if;

  if (select count(*) from public.pay_referrals where affiliate_id=b_id and merchant_id=(select id from public.pay_merchants where slug='merchant-c')) <> 1 then
    raise exception 'merchant C must be directly attributed to B';
  end if;

  if exists (
    select 1
      from public.pay_referrals r
      join public.pay_merchants m on m.id=r.merchant_id
     where m.slug='merchant-c'
       and r.affiliate_id=a_id
  ) then
    raise exception 'A must receive zero referral ownership from C';
  end if;
end $single_level$;

begin;
set local role service_role;
\set payment_b '30000000-0000-4000-8000-000000000001'
\set payment_c '30000000-0000-4000-8000-000000000002'

insert into public.pay_payment_intents(id,merchant_id,asset,token_decimals,status)
values
 (:payment_b,(select id from public.pay_merchants where slug='merchant-b'),'SOL',9,'pending'),
 (:payment_c,(select id from public.pay_merchants where slug='merchant-c'),'SOL',9,'pending');

insert into public.pay_revenue_ledger(
  payment_id,asset,gross_gateway_fee_atomic,referral_commission_atomic,net_gateway_revenue_atomic,status
)
values
  (:payment_b,'SOL',1001,0,1001,'eligible'),
  (:payment_c,'SOL',1001,0,1001,'eligible');

DO $commission$
declare
  a_id uuid;
  b_id uuid;
begin
  select id into a_id from public.pay_affiliates where owner_user_id='user-a';
  select id into b_id from public.pay_affiliates where owner_user_id='user-b';

  if not exists (
    select 1 from public.pay_commissions c
    join public.pay_referrals r on r.id=c.referral_id
    where r.affiliate_id=a_id and c.payment_id=:payment_b
      and c.commission_bps=5000 and c.commission_atomic=500
  ) then
    raise exception 'A commission must be 50%% of B gateway revenue';
  end if;

  if not exists (
    select 1 from public.pay_commissions c
    join public.pay_referrals r on r.id=c.referral_id
    where r.affiliate_id=b_id and c.payment_id=:payment_c
      and c.commission_bps=5000 and c.commission_atomic=500
  ) then
    raise exception 'B commission must be 50%% of C gateway revenue';
  end if;

  if exists (
    select 1 from public.pay_commissions c
    join public.pay_referrals r on r.id=c.referral_id
    where r.affiliate_id=a_id and c.payment_id=:payment_c
  ) then
    raise exception 'A must receive zero commission from C';
  end if;

  if not exists (
    select 1 from public.pay_revenue_ledger l
    where l.payment_id=:payment_c
      and l.gross_gateway_fee_atomic=1001
      and l.referral_commission_atomic=500
      and l.net_gateway_revenue_atomic=501
  ) then
    raise exception 'revenue ledger must include the authoritative referral liability';
  end if;
end $commission$;
rollback;

DO $priv$
begin
  if has_function_privilege('anon','public.pay_record_referral_click(text)','EXECUTE') then
    raise exception 'anon must not record referral clicks';
  end if;
  if has_function_privilege('authenticated','public.pay_record_referral_click(text)','EXECUTE') then
    raise exception 'authenticated must not record referral clicks';
  end if;
  if has_function_privilege('anon','public.pay_attribute_referral_from_click(uuid,text,text)','EXECUTE') then
    raise exception 'anon must not mutate referral attribution';
  end if;
  if has_function_privilege('authenticated','public.pay_attribute_referral_from_click(uuid,text,text)','EXECUTE') then
    raise exception 'authenticated must not mutate referral attribution';
  end if;
  if has_function_privilege('anon','public.pay_get_referral_dashboard(integer)','EXECUTE') then
    raise exception 'anon must not read referral dashboard';
  end if;
  if not has_function_privilege('authenticated','public.pay_get_referral_dashboard(integer)','EXECUTE') then
    raise exception 'authenticated must read referral dashboard';
  end if;
end $priv$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);

DO $dashboard$
declare
  dashboard jsonb;
begin
  select public.pay_get_referral_dashboard(100) into dashboard;
  if dashboard->>'ok' <> 'true' then raise exception 'dashboard call failed: %', dashboard; end if;
  if (dashboard->'stats'->>'clicks') <> '2' then raise exception 'A click count must be 2, got %', dashboard->'stats'->>'clicks'; end if;
  if (dashboard->'stats'->>'directSignups') <> '1' then raise exception 'A direct signup count must be 1'; end if;
  if (dashboard->'stats'->>'referredMerchants') <> '1' then raise exception 'A referred merchant count must be 1'; end if;
  if jsonb_array_length(dashboard->'commissions') <> 1 then raise exception 'A must see only its own commission records'; end if;
end $dashboard$;
rollback;

select 'pay_referral_security_ok' as result;
