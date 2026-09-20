-- Report revenue-ledger RLS fixture.
-- Verifies the exact production migration permits merchant-scoped reads only.

DO $
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $;

create table public.users (id text primary key, is_active boolean not null);
create table public.pay_merchant_members (
  user_id text not null,
  merchant_id uuid not null,
  status text not null,
  role text not null
);
create table public.pay_payment_intents (
  id uuid primary key,
  merchant_id uuid not null,
  amount_atomic numeric not null,
  fee_atomic numeric not null,
  status text not null,
  customer_wallet_address text,
  created_at timestamptz not null
);
create table public.pay_revenue_ledger (
  id uuid primary key,
  payment_id uuid not null,
  asset text not null,
  gross_gateway_fee_atomic numeric not null,
  referral_commission_atomic numeric not null,
  net_gateway_revenue_atomic numeric not null,
  status text not null,
  recognized_at timestamptz not null,
  voided_at timestamptz
);

insert into public.users values
  ('user-a', true),
  ('user-b', true);

insert into public.pay_merchant_members values
  ('user-a','00000000-0000-0000-0000-000000000001','active','owner'),
  ('user-b','00000000-0000-0000-0000-000000000002','active','owner');

insert into public.pay_payment_intents values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',1000,10,'completed','wallet-a',now()),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000002',2000,20,'completed','wallet-b',now());

insert into public.pay_revenue_ledger values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','SOL',10,1,9,'recognized',now(),null),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','SOL',20,2,18,'recognized',now(),null);

alter table public.pay_payment_intents enable row level security;
alter table public.pay_merchant_members enable row level security;
alter table public.pay_revenue_ledger enable row level security;

grant select on public.pay_payment_intents, public.pay_merchant_members to authenticated;

create function public.pay_request_user_id()
returns text
language sql
stable
security invoker
set search_path=''
as $$
  select current_setting('request.jwt.claims', true)::json->>'solmint_user_id';
$$;

create function public.pay_has_merchant_access(p_merchant_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.users u
    join public.pay_merchant_members m on m.user_id=u.id
    where u.id=public.pay_request_user_id()
      and u.is_active=true
      and m.merchant_id=p_merchant_id
      and m.status='active'
      and (p_roles is null or m.role=any(p_roles))
  );
$$;

revoke execute on function public.pay_request_user_id() from public,anon,authenticated;
revoke execute on function public.pay_has_merchant_access(uuid,text[]) from public,anon,authenticated;

create policy pay_pi_read on public.pay_payment_intents
for select to authenticated
using (public.pay_has_merchant_access(merchant_id, array['owner','admin','finance','developer','viewer']::text[]));

create policy pay_members_read on public.pay_merchant_members
for select to authenticated
using (user_id=public.pay_request_user_id());

grant select on public.pay_revenue_ledger to authenticated;

\set report_migration 'supabase/migrations/20260920101617_solmint_pay_report_read_function.sql'
\set rls_migration 'supabase/migrations/20260920104500_solmint_pay_report_revenue_ledger_rls.sql'
\i :report_migration
\i :rls_migration

DO $
begin
  if (select prosecdef from pg_proc where oid='public.pay_read_report(uuid,timestamptz,timestamptz)'::regprocedure) then
    raise exception 'report function must remain SECURITY INVOKER';
  end if;
  if has_function_privilege('anon','public.pay_read_report(uuid,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'anon must not execute report function';
  end if;
  if not has_function_privilege('authenticated','public.pay_read_report(uuid,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'authenticated must execute report function';
  end if;
end $;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);

DO $
declare own_count bigint;
begin
  select count(*) into own_count from public.pay_revenue_ledger;
  if own_count <> 1 then raise exception 'user-a must see exactly one revenue row, got %', own_count; end if;
end $;

DO $
declare report jsonb;
begin
  select public.pay_read_report('00000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 day') into report;
  if report->>'paymentIntentCount' <> '1' or report->>'netGatewayRevenueAtomic' <> '9' then
    raise exception 'user-a report must contain only merchant A data: %', report;
  end if;
end $;

DO $$
begin
  if exists (
    select 1 from public.pay_revenue_ledger r
    join public.pay_payment_intents p on p.id=r.payment_id
    where p.merchant_id='00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'user-a can see merchant B revenue';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-b"}',true);

DO $
declare own_count bigint;
begin
  select count(*) into own_count from public.pay_revenue_ledger;
  if own_count <> 1 then raise exception 'user-b must see exactly one revenue row, got %', own_count; end if;
end $;

DO $
declare report jsonb;
begin
  select public.pay_read_report('00000000-0000-0000-0000-000000000002', now() - interval '1 day', now() + interval '1 day') into report;
  if report->>'paymentIntentCount' <> '1' or report->>'netGatewayRevenueAtomic' <> '18' then
    raise exception 'user-b report must contain only merchant B data: %', report;
  end if;
end $;
rollback;

select 'pay_report_revenue_ledger_security_ok' as result;
