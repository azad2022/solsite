-- Ticket operational-field and tenant-boundary regression suite.
-- Runs against a fresh isolated PostgreSQL database in CI.
\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create role service_role;
grant usage on schema public to authenticated, service_role;

create table public.users (
  id text primary key,
  is_active boolean not null default true,
  role text not null default 'user'
);
create table public.pay_merchants (id uuid primary key);
create table public.pay_merchant_members (
  merchant_id uuid not null references public.pay_merchants(id),
  user_id text not null references public.users(id),
  status text not null,
  role text not null
);
create table public.pay_payment_intents (
  id uuid primary key,
  merchant_id uuid not null references public.pay_merchants(id)
);

create or replace function public.pay_request_user_id()
returns text
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'solmint_user_id';
$$;

create or replace function public.pay_has_merchant_access(p_merchant_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.pay_merchant_members m
    join public.users u on u.id = m.user_id
    where m.merchant_id = p_merchant_id
      and m.user_id = public.pay_request_user_id()
      and m.status = 'active'
      and u.is_active
  );
$$;

grant execute on function public.pay_request_user_id() to authenticated;
grant execute on function public.pay_has_merchant_access(uuid) to authenticated;

\i supabase/migrations/20260911060000_solmint_pay_support_tickets.sql
\i supabase/migrations/20260911061000_solmint_pay_support_tickets_rls_fix.sql
\i supabase/migrations/20261001184500_solmint_pay_support_tickets_select_grants.sql
\i supabase/migrations/20261001185200_solmint_pay_support_tickets_closed_reply_guard.sql
\i supabase/migrations/20261016160000_solmint_pay_ticket_operational_fields.sql

insert into public.users(id,is_active,role) values
  ('merchant-a-user',true,'user'),
  ('merchant-b-user',true,'user'),
  ('site-admin',true,'admin'),
  ('inactive-user',false,'user');
insert into public.pay_merchants(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.pay_merchant_members(merchant_id,user_id,status,role) values
  ('00000000-0000-4000-8000-000000000001','merchant-a-user','active','owner'),
  ('00000000-0000-4000-8000-000000000002','merchant-b-user','active','owner');
insert into public.pay_payment_intents(id,merchant_id) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');

do $$
declare
  v_ticket_a public.pay_tickets;
  v_ticket_b public.pay_tickets;
begin
  v_ticket_a := public.pay_create_ticket(
    'merchant-a-user','00000000-0000-4000-8000-000000000001',
    'Payment Intent problem','Please investigate this Payment Intent.','urgent',
    'payments','10000000-0000-4000-8000-000000000001'
  );
  if v_ticket_a.category <> 'payments'
     or v_ticket_a.payment_intent_id <> '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Ticket category or same-merchant Payment Intent link did not persist';
  end if;

  v_ticket_b := public.pay_create_ticket(
    'merchant-b-user','00000000-0000-4000-8000-000000000002',
    'Other Merchant issue','Legacy internal callers remain compatible.','normal'
  );
  if v_ticket_b.category <> 'other' or v_ticket_b.payment_intent_id is not null then
    raise exception 'Legacy five-argument create contract did not preserve the safe default';
  end if;

  begin
    perform public.pay_create_ticket(
      'merchant-a-user','00000000-0000-4000-8000-000000000001',
      'Cross-tenant reference','This must fail.','normal',
      'payments','10000000-0000-4000-8000-000000000002'
    );
    raise exception 'Cross-merchant Payment Intent association was accepted';
  exception when sqlstate 'P0002' then
    null;
  end;

  begin
    perform public.pay_create_ticket(
      'merchant-a-user','00000000-0000-4000-8000-000000000001',
      'Invalid category','This must fail.','normal','made_up',null
    );
    raise exception 'Unknown ticket category was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  begin
    perform public.pay_add_ticket_message('merchant-a-user',v_ticket_b.id,'Cross-tenant reply must fail.');
    raise exception 'Cross-merchant ticket reply was accepted';
  exception when sqlstate '42501' then
    null;
  end;

  perform public.pay_update_ticket_status('site-admin',v_ticket_a.id,'closed');
  begin
    perform public.pay_add_ticket_message('merchant-a-user',v_ticket_a.id,'Closed reply must fail.');
    raise exception 'Reply to closed ticket was accepted';
  exception when sqlstate 'P0001' then
    null;
  end;
  perform public.pay_update_ticket_status('site-admin',v_ticket_a.id,'open');

  if has_function_privilege('authenticated','public.pay_create_ticket(text,uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'Authenticated role must not execute service-only ticket creation RPC';
  end if;
  if has_table_privilege('authenticated','public.pay_tickets','INSERT')
     or has_table_privilege('authenticated','public.pay_tickets','UPDATE')
     or has_table_privilege('authenticated','public.pay_ticket_messages','INSERT') then
    raise exception 'Authenticated role must not directly mutate ticket tables';
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"merchant-a-user"}',true);
do $$
begin
  if (select count(*) from public.pay_tickets) <> 1
     or exists (select 1 from public.pay_tickets where merchant_id='00000000-0000-4000-8000-000000000002') then
    raise exception 'Merchant A must see only its own tickets';
  end if;
  if (select count(*) from public.pay_ticket_messages) <> 1 then
    raise exception 'Merchant A must see only messages under its visible tickets';
  end if;
  if not exists (
    select 1 from public.pay_tickets
    where category='payments'
      and payment_intent_id='10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Authorized user must be able to read ticket category and linked Payment Intent';
  end if;
end;
$$;
rollback;

select 'pay_ticket_security_ok' as result;
