-- SolMint Pay identity/RLS security fixture.
-- Runs against an isolated PostgreSQL instance in CI.
-- It intentionally creates only the relations required by the production RLS bridge,
-- then applies the exact production migration and exercises it as role authenticated.

create role authenticated;
grant usage on schema public to authenticated;

create table public.users (
  id text primary key,
  is_active boolean not null
);

create table public.pay_merchants (
  id uuid primary key
);

create table public.pay_merchant_members (
  user_id text not null,
  merchant_id uuid not null,
  status text not null,
  role text not null
);

create table public.pay_merchant_wallets (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_payment_intents (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_payment_transactions (
  id uuid primary key,
  payment_id uuid not null
);

create table public.pay_payment_transfers (
  id uuid primary key,
  payment_transaction_id uuid not null
);

create table public.pay_payment_events (
  id uuid primary key,
  payment_id uuid not null
);

create table public.pay_payment_links (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_invoices (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_merchant_ledger (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_referrals (
  id uuid primary key,
  merchant_id uuid not null,
  affiliate_id uuid not null
);

create table public.pay_affiliates (
  id uuid primary key,
  owner_user_id text not null,
  status text not null
);

create table public.pay_commissions (
  id uuid primary key,
  referral_id uuid not null
);

create table public.pay_gas_accounts (
  id uuid primary key,
  merchant_id uuid not null
);

create table public.pay_gas_ledger (
  id uuid primary key,
  gas_account_id uuid not null
);

insert into public.users (id, is_active) values
  ('user-a', true),
  ('user-b', true),
  ('user-suspended', true),
  ('user-inactive', false),
  ('affiliate-owner', true);

insert into public.pay_merchants (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

insert into public.pay_merchant_members (user_id, merchant_id, status, role) values
  ('user-a', '00000000-0000-0000-0000-000000000001', 'active', 'owner'),
  ('user-b', '00000000-0000-0000-0000-000000000002', 'active', 'owner'),
  ('user-suspended', '00000000-0000-0000-0000-000000000001', 'suspended', 'owner'),
  ('user-inactive', '00000000-0000-0000-0000-000000000001', 'active', 'owner');

insert into public.pay_affiliates (id, owner_user_id, status) values
  ('00000000-0000-0000-0000-000000000011', 'affiliate-owner', 'active'),
  ('00000000-0000-0000-0000-000000000012', 'user-a', 'pending'),
  ('00000000-0000-0000-0000-000000000013', 'user-b', 'rejected');

alter table public.pay_merchants enable row level security;
alter table public.pay_merchant_members enable row level security;
alter table public.pay_merchant_wallets enable row level security;
alter table public.pay_payment_intents enable row level security;
alter table public.pay_payment_transactions enable row level security;
alter table public.pay_payment_transfers enable row level security;
alter table public.pay_payment_events enable row level security;
alter table public.pay_payment_links enable row level security;
alter table public.pay_invoices enable row level security;
alter table public.pay_merchant_ledger enable row level security;
alter table public.pay_referrals enable row level security;
alter table public.pay_affiliates enable row level security;
alter table public.pay_commissions enable row level security;
alter table public.pay_gas_accounts enable row level security;
alter table public.pay_gas_ledger enable row level security;

\set bridge_migration 'supabase/migrations/20260907214733_solmint_pay_identity_rls_bridge.sql'
\i :bridge_migration

-- Privilege boundary: authenticated is read-only on the intended safe models
-- and has no access to server-mediated sensitive models in this fixture.
create table public.pay_webhooks (id uuid primary key);
create table public.pay_api_keys (id uuid primary key);
revoke all on public.pay_webhooks, public.pay_api_keys from authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"solmint_user_id":"user-a"}', true);

create temporary table visible_merchants as
select id from public.pay_merchants order by id;

\gset

DO $$
begin
  if (select count(*) from visible_merchants) <> 1
     or not exists (select 1 from visible_merchants where id = '00000000-0000-0000-0000-000000000001')
  then
    raise exception 'user-a must see only merchant A';
  end if;
  if exists (select 1 from visible_merchants where id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'cross-tenant merchant B leaked to user-a';
  end if;
end $$;

DO $$
begin
  if (select count(*) from public.pay_merchant_members) <> 1 then
    raise exception 'user-a must see only its merchant membership';
  end if;
end $$;

rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"solmint_user_id":"user-suspended"}', true);
if exists (select 1 from public.pay_merchants) then
  raise exception 'suspended merchant membership must not expose merchants';
end if;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"solmint_user_id":"user-inactive"}', true);
if exists (select 1 from public.pay_merchants) then
  raise exception 'inactive application user must not expose merchants';
end if;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"solmint_user_id":"affiliate-owner"}', true);
if (select count(*) from public.pay_affiliates) <> 1
   or not exists (select 1 from public.pay_affiliates where id = '00000000-0000-0000-0000-000000000011') then
  raise exception 'affiliate owner must see only active/pending own affiliate';
end if;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"solmint_user_id":"user-a"}', true);
if (select count(*) from public.pay_affiliates) <> 1
   or not exists (select 1 from public.pay_affiliates where id = '00000000-0000-0000-0000-000000000012') then
  raise exception 'user-a must see only its pending affiliate';
end if;
rollback;

DO $$
begin
  if has_table_privilege('authenticated', 'public.pay_webhooks', 'SELECT') then
    raise exception 'sensitive webhook table must not be selectable by authenticated';
  end if;
  if has_table_privilege('authenticated', 'public.pay_api_keys', 'SELECT') then
    raise exception 'sensitive API key table must not be selectable by authenticated';
  end if;
end $$;

DO $$
begin
  if not has_table_privilege('authenticated', 'public.pay_merchants', 'SELECT') then
    raise exception 'authenticated must have SELECT on pay_merchants';
  end if;
  if has_table_privilege('authenticated', 'public.pay_merchants', 'INSERT') then
    raise exception 'authenticated must not have INSERT on pay_merchants';
  end if;
end $$;

select 'pay_identity_rls_security_ok' as result;
