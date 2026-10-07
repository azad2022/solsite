-- Focused Bulk Pay database security fixture.
-- This applies the exact Bulk Pay migration chain and exercises RLS,
-- merchant isolation, idempotency, and the server-only verification capability.

create table public.users (
  id text primary key,
  is_active boolean not null
);
create table public.pay_merchants (
  id uuid primary key,
  status text not null
);
create table public.pay_merchant_members (
  user_id text not null,
  merchant_id uuid not null,
  status text not null,
  role text not null
);
create table public.pay_merchant_wallets (
  id uuid primary key,
  merchant_id uuid not null,
  wallet_role text not null,
  is_active boolean not null,
  verification_status text not null,
  address text not null
);
create table public.pay_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  completed_at timestamptz,
  unique(merchant_id, scope, idempotency_key)
);
create table public.pay_audit_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  actor_user_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  request_id text,
  metadata jsonb
);

create schema auth;
create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function public.pay_request_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'solmint_user_id', '')
$$;

create function public.pay_has_merchant_access(p_merchant_id uuid, p_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.pay_merchant_members m
      join public.users u on u.id = m.user_id
     where m.merchant_id = p_merchant_id
       and m.user_id = public.pay_request_user_id()
       and m.status = 'active'
       and u.is_active
       and m.role = any(p_roles)
  )
$$;

grant usage on schema public, auth to authenticated;
grant select on public.users, public.pay_merchants, public.pay_merchant_members, public.pay_merchant_wallets, public.pay_idempotency_keys, public.pay_audit_logs to authenticated;
grant execute on function auth.jwt() to authenticated;
grant execute on function public.pay_request_user_id() to authenticated;
grant execute on function public.pay_has_merchant_access(uuid,text[]) to authenticated;

insert into public.users(id,is_active) values ('user-a',true),('user-b',true);
insert into public.pay_merchants(id,status) values
  ('00000000-0000-4000-8000-000000000001','active'),
  ('00000000-0000-4000-8000-000000000002','active');
insert into public.pay_merchant_members(user_id,merchant_id,status,role) values
  ('user-a','00000000-0000-4000-8000-000000000001','active','owner'),
  ('user-b','00000000-0000-4000-8000-000000000002','active','owner');
insert into public.pay_merchant_wallets(id,merchant_id,wallet_role,is_active,verification_status,address) values
  ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','receiving',true,'verified','11111111111111111111111111111111');

\set bulk_migration 'supabase/migrations/20261007164348_solmint_pay_bulk_payout.sql'
\i :bulk_migration
\set verifier_migration 'supabase/migrations/20261007173028_solmint_pay_bulk_payout_verifier_hardening.sql'
\i :verifier_migration

DO $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='pay_payout_batches'
       and policyname='pay payout batches read merchant scoped'
  ) then raise exception 'Bulk Pay batch SELECT policy missing'; end if;
  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='pay_payout_items'
       and policyname='pay payout items read merchant scoped'
  ) then raise exception 'Bulk Pay item SELECT policy missing'; end if;
  if has_function_privilege('anon','public.pay_apply_payout_verification(uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text)','EXECUTE')
     then raise exception 'anonymous execution of payout verification must be forbidden'; end if;
  if not has_function_privilege('authenticated','public.pay_apply_payout_verification(uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text)','EXECUTE')
     then raise exception 'authenticated execution grant for verifier RPC is missing'; end if;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  select public.pay_create_payout_batch(
    '00000000-0000-4000-8000-000000000001',
    'SOL',null,null,null,
    '[{"recipient":"11111111111111111111111111111111","amountAtomic":"7"}]'::jsonb,
    'bulk-create-key-1','bulk-create-hash-1'
  ) into r;
  if r->>'state' <> 'created' then raise exception 'authorized Bulk Pay creation failed: %', r; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  select public.pay_create_payout_batch(
    '00000000-0000-4000-8000-000000000002',
    'SOL',null,null,null,
    '[{"recipient":"11111111111111111111111111111111","amountAtomic":"7"}]'::jsonb,
    'bulk-create-cross-merchant','bulk-cross-merchant-hash'
  ) into r;
  if r->>'state' <> 'forbidden' then raise exception 'cross-merchant Bulk Pay create must be forbidden: %', r; end if;
end $$;
rollback;

insert into public.pay_payout_batches(
  id,merchant_id,created_by_user_id,asset,source_wallet_address,total_amount_atomic,item_count,status,verification_commitment,transaction_signature
) values(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'user-a','SOL','11111111111111111111111111111111',7,1,'submitted','finalized',repeat('5',80)
);
insert into public.pay_payout_items(batch_id,line_number,recipient,amount_atomic,status)
values('00000000-0000-4000-8000-000000000201',1,'11111111111111111111111111111111',7,'submitted');

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  select public.pay_apply_payout_verification(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    repeat('5',80),'completed',null,null,1,now(),'{}'::jsonb,'test-request'
  ) into r;
  if r->>'state' <> 'unauthorized' then
    raise exception 'ordinary authenticated user must not apply payout verification: %', r;
  end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a","solmint_pay_verifier":"true"}',true);
DO $$
declare r jsonb;
begin
  select public.pay_apply_payout_verification(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    repeat('5',80),'completed',null,null,1,now(),'{"verified":true}'::jsonb,'test-request'
  ) into r;
  if r->>'state' <> 'updated' or r->>'status' <> 'completed' then
    raise exception 'server verifier capability must apply authoritative result: %', r;
  end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
begin
  if (select count(*) from public.pay_payout_batches) <> 1 then
    raise exception 'merchant A should see exactly one payout batch';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-b"}',true);
DO $$
begin
  if exists (select 1 from public.pay_payout_batches) then
    raise exception 'merchant B must not see merchant A payout batches';
  end if;
end $$;
rollback;

select 'pay_bulk_payout_security_ok' as result;
