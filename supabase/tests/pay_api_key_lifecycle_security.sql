-- SolMint Pay API-key lifecycle database/security fixture.
-- Runs against isolated PostgreSQL in CI. It applies the exact lifecycle
-- migrations, verifies grants, then exercises create/replay/conflict/revoke/
-- rotate and audit behavior with transaction-scoped fixtures.

create role anon;
create role authenticated;
create role service_role;
grant usage on schema public to authenticated, service_role;

create table public.users (id text primary key, is_active boolean not null);
create table public.pay_merchants (id uuid primary key, status text not null);
create table public.pay_merchant_members (user_id text not null, merchant_id uuid not null, status text not null, role text not null);
create table public.pay_api_keys (
  id uuid primary key default gen_random_uuid(), merchant_id uuid not null, name text not null,
  key_prefix text not null, key_hash text not null unique, scopes text[] not null default '{}'::text[],
  expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz, created_at timestamptz not null default now()
);
create table public.pay_idempotency_keys (
  id uuid primary key default gen_random_uuid(), merchant_id uuid not null, scope text not null,
  idempotency_key text not null, request_hash text not null, status text not null,
  response_status integer, response_body jsonb, resource_type text, resource_id uuid,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique (merchant_id, scope, idempotency_key)
);
create table public.pay_audit_logs (
  id uuid primary key default gen_random_uuid(), merchant_id uuid, actor_user_id text,
  event_type text not null, entity_type text not null, entity_id text, request_id text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

\i supabase/migrations/20260910153000_solmint_pay_api_key_lifecycle.sql
\i supabase/migrations/20260910153001_solmint_pay_api_key_idempotency_lock.sql

begin;
set local role service_role;
insert into public.users(id,is_active) values ('user-a',true),('user-b',true);
insert into public.pay_merchants(id,status) values ('00000000-0000-0000-0000-000000000001','active'),('00000000-0000-0000-0000-000000000002','active');
insert into public.pay_merchant_members(user_id,merchant_id,status,role) values
  ('user-a','00000000-0000-0000-0000-000000000001','active','owner'),
  ('user-b','00000000-0000-0000-0000-000000000002','active','owner');

DO $$
begin
  if has_function_privilege('service_role','public.pay_create_api_key(text,uuid,text,text,text[],timestamptz,text,text)','EXECUTE') is not true then raise exception 'service_role create grant missing'; end if;
  if has_function_privilege('service_role','public.pay_revoke_api_key(text,uuid,uuid)','EXECUTE') is not true then raise exception 'service_role revoke grant missing'; end if;
  if has_function_privilege('service_role','public.pay_rotate_api_key(text,uuid,uuid,text,text,text[],timestamptz,text,text)','EXECUTE') is not true then raise exception 'service_role rotate grant missing'; end if;
  if has_function_privilege('authenticated','public.pay_create_api_key(text,uuid,text,text,text[],timestamptz,text,text)','EXECUTE') then raise exception 'authenticated can execute create'; end if;
  if has_function_privilege('anon','public.pay_create_api_key(text,uuid,text,text,text[],timestamptz,text,text)','EXECUTE') then raise exception 'anon can execute create'; end if;
  if has_function_privilege('service_role','public.pay_create_api_key_unlocked(text,uuid,text,text,text[],timestamptz,text,text)','EXECUTE') then raise exception 'unlocked create function remains executable'; end if;
end $$;

select public.pay_create_api_key('user-a','00000000-0000-0000-0000-000000000001','production','sk_pay_test01',repeat('a',64),array['payment.create']::text[],null,'create-1',repeat('b',64)) as create_result \gset
DO $$
begin
  if :'create_result'::jsonb->>'state' <> 'created' then raise exception 'create failed: %', :'create_result'; end if;
  if exists (select 1 from public.pay_idempotency_keys where response_body::text ~* 'secret') then raise exception 'plaintext secret was persisted'; end if;
  if (select count(*) from public.pay_api_keys) <> 1 then raise exception 'expected one API key'; end if;
end $$;

select public.pay_create_api_key('user-a','00000000-0000-0000-0000-000000000001','production','sk_pay_test02',repeat('c',64),array['payment.create']::text[],null,'create-1',repeat('b',64)) as replay_result \gset
DO $$ begin
  if :'replay_result'::jsonb->>'state' <> 'replay' then raise exception 'same idempotency key must replay'; end if;
  if (select count(*) from public.pay_api_keys) <> 1 then raise exception 'replay created another key'; end if;
end $$;

select public.pay_create_api_key('user-a','00000000-0000-0000-0000-000000000001','production','sk_pay_test03',repeat('d',64),array['payment.create']::text[],null,'create-1',repeat('e',64)) as conflict_result \gset
DO $$ begin
  if :'conflict_result'::jsonb->>'state' <> 'conflict' then raise exception 'changed request hash must conflict'; end if;
end $$;

select public.pay_create_api_key('user-b','00000000-0000-0000-0000-000000000001','wrong-owner','sk_pay_test04',repeat('f',64),array['payment.create']::text[],null,'create-2',repeat('1',64)) as forbidden_result \gset
DO $$ begin
  if :'forbidden_result'::jsonb->>'reason' <> 'MERCHANT_FORBIDDEN' then raise exception 'cross-merchant owner must be denied'; end if;
end $$;

select public.pay_revoke_api_key('user-a','00000000-0000-0000-0000-000000000001',(select id from public.pay_api_keys where key_prefix='sk_pay_test01')) as revoke_result \gset
DO $$ begin
  if :'revoke_result'::jsonb->>'state' <> 'revoked' then raise exception 'revoke failed'; end if;
  if (select revoked_at is null from public.pay_api_keys where key_prefix='sk_pay_test01') then raise exception 'key was not revoked'; end if;
end $$;

insert into public.pay_api_keys(merchant_id,name,key_prefix,key_hash,scopes) values
('00000000-0000-0000-0000-000000000001','rotate-me','sk_pay_old',repeat('1',64),array['payment.create']::text[]);
select public.pay_rotate_api_key('user-a','00000000-0000-0000-0000-000000000001',(select id from public.pay_api_keys where key_prefix='sk_pay_old'),'rotated','sk_pay_new',repeat('2',64),array['payment.create']::text[],null,'rotate-1',repeat('3',64)) as rotate_result \gset
DO $$
begin
  if :'rotate_result'::jsonb->>'state' <> 'created' then raise exception 'rotate failed: %', :'rotate_result'; end if;
  if not exists (select 1 from public.pay_api_keys where key_prefix='sk_pay_old' and revoked_at is not null) then raise exception 'old key remained active after rotate'; end if;
  if not exists (select 1 from public.pay_api_keys where key_prefix='sk_pay_new' and revoked_at is null) then raise exception 'new key is not active'; end if;
end $$;

DO $$
begin
  if (select count(*) from public.pay_audit_logs where event_type='api_key.created') <> 1 then raise exception 'create audit missing'; end if;
  if (select count(*) from public.pay_audit_logs where event_type='api_key.revoked') <> 1 then raise exception 'revoke audit missing'; end if;
  if (select count(*) from public.pay_audit_logs where event_type='api_key.rotated') <> 1 then raise exception 'rotate audit missing'; end if;
  if exists (select 1 from public.pay_audit_logs where metadata::text ~* 'secret|key_hash') then raise exception 'secret material leaked to audit metadata'; end if;
end $$;

rollback;
select 'pay_api_key_lifecycle_security_ok' as result;
