-- SolMint Pay Bulk Payout security fixture.
-- Validates the exact live-contract migration in an isolated PostgreSQL database.

create extension if not exists pgcrypto;

DO $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
grant usage on schema public to anon, authenticated;
create schema if not exists auth;

create table public.users (id text primary key, is_active boolean not null default true);
create table public.pay_merchants (id uuid primary key, status text not null);
create table public.pay_merchant_members (user_id text not null, merchant_id uuid not null, status text not null, role text not null);
create table public.pay_merchant_wallets (
  id uuid primary key default gen_random_uuid(), merchant_id uuid not null, address text not null,
  wallet_role text not null, is_active boolean not null default true, verification_status text not null
);
create table public.pay_idempotency_keys (
  id uuid primary key default gen_random_uuid(), merchant_id uuid not null, scope text not null,
  idempotency_key text not null, request_hash text not null, status text not null,
  response_status integer, response_body jsonb, resource_type text, resource_id uuid,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(merchant_id,scope,idempotency_key)
);
create table public.pay_audit_logs (
  id uuid primary key default gen_random_uuid(), merchant_id uuid, actor_user_id text, event_type text,
  entity_type text, entity_id text, request_id text, metadata jsonb, created_at timestamptz not null default now()
);

create or replace function public.pay_request_user_id()
returns text language sql stable security definer set search_path=''
as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb ->> 'solmint_user_id',''); $$;

create or replace function public.pay_has_merchant_access(p_merchant_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.pay_merchant_members mm where mm.merchant_id=p_merchant_id and mm.user_id=public.pay_request_user_id() and mm.status='active' and mm.role=any(p_roles)); $$;

create or replace function auth.jwt()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb; $$;

\i supabase/migrations/20261007164348_solmint_pay_bulk_payout.sql
\i supabase/migrations/20261007173028_solmint_pay_bulk_payout_verifier_hardening.sql

insert into public.users(id) values ('user-a'),('user-b'),('user-viewer');
insert into public.pay_merchants(id,status) values
 ('00000000-0000-0000-0000-000000000001','active'),
 ('00000000-0000-0000-0000-000000000002','active');
insert into public.pay_merchant_members(user_id,merchant_id,status,role) values
 ('user-a','00000000-0000-0000-0000-000000000001','active','owner'),
 ('user-viewer','00000000-0000-0000-0000-000000000001','active','viewer'),
 ('user-b','00000000-0000-0000-0000-000000000002','active','owner');
insert into public.pay_merchant_wallets(merchant_id,address,wallet_role,is_active,verification_status) values
 ('00000000-0000-0000-0000-000000000001','11111111111111111111111111111111','receiving',true,'verified'),
 ('00000000-0000-0000-0000-000000000002','11111111111111111111111111111111','receiving',true,'verified');

revoke insert, update, delete, truncate, references, trigger on table public.pay_payout_batches, public.pay_payout_items from anon, authenticated;

DO $$
begin
  if has_function_privilege('anon','public.pay_create_payout_batch(uuid,text,text,text,integer,jsonb,text,text)','EXECUTE') then raise exception 'anon can execute Bulk Pay create'; end if;
  if has_function_privilege('anon','public.pay_submit_payout_batch(uuid,uuid,text,text,text)','EXECUTE') then raise exception 'anon can execute Bulk Pay submit'; end if;
  if has_function_privilege('anon','public.pay_apply_payout_verification(uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text)','EXECUTE') then raise exception 'anon can execute Bulk Pay verifier'; end if;
  if has_function_privilege('authenticated','public.pay_create_payout_batch(uuid,text,text,text,integer,jsonb,text,text)','EXECUTE') is not true then raise exception 'authenticated create grant missing'; end if;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-viewer"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_create_payout_batch(
    '00000000-0000-0000-0000-000000000001','SOL',null,null,null,
    '[{"recipient":"22222222222222222222222222222222","amountAtomic":"1000"}]'::jsonb,'viewer-1',repeat('a',64)
  );
  if r->>'state' <> 'forbidden' then raise exception 'viewer was allowed to create Bulk Pay: %',r; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-b"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_create_payout_batch(
    '00000000-0000-0000-0000-000000000001','SOL',null,null,null,
    '[{"recipient":"22222222222222222222222222222222","amountAtomic":"1000"}]'::jsonb,'cross-1',repeat('b',64)
  );
  if r->>'state' <> 'forbidden' then raise exception 'cross-tenant create was not denied: %',r; end if;
  if exists(select 1 from public.pay_payout_batches where merchant_id='00000000-0000-0000-0000-000000000001') then raise exception 'cross-tenant batch appeared'; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $
declare r jsonb; v_batch_id uuid;
begin
  r := public.pay_create_payout_batch(
    '00000000-0000-0000-0000-000000000001','SOL',null,null,null,
    '[{"recipient":"22222222222222222222222222222222","amountAtomic":"1000"},{"recipient":"33333333333333333333333333333333","amountAtomic":"2000"}]'::jsonb,'create-1',repeat('c',64)
  );
  if r->>'state' <> 'created' then raise exception 'owner create failed: %',r; end if;
  v_batch_id := (r->>'resource_id')::uuid;
  if (select item_count from public.pay_payout_batches b where b.id=v_batch_id) <> 2 then raise exception 'item count was not persisted'; end if;

  r := public.pay_create_payout_batch(
    '00000000-0000-0000-0000-000000000001','SOL',null,null,null,
    '[{"recipient":"22222222222222222222222222222222","amountAtomic":"1000"},{"recipient":"33333333333333333333333333333333","amountAtomic":"2000"}]'::jsonb,'create-1',repeat('c',64)
  );
  if r->>'state' <> 'replay' then raise exception 'create replay failed: %',r; end if;

  r := public.pay_create_payout_batch(
    '00000000-0000-0000-0000-000000000001','SOL',null,null,null,
    '[{"recipient":"22222222222222222222222222222222","amountAtomic":"1000"}]'::jsonb,'create-1',repeat('d',64)
  );
  if r->>'state' <> 'conflict' then raise exception 'create idempotency conflict missing: %',r; end if;

  r := public.pay_submit_payout_batch(
    '00000000-0000-0000-0000-000000000001',v_batch_id,repeat('A',88),'submit-1',repeat('e',64)
  );
  if r->>'state' <> 'submitted' then raise exception 'owner submit failed: %',r; end if;

  perform set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
  r := public.pay_apply_payout_verification(
    '00000000-0000-0000-0000-000000000001',v_batch_id,repeat('A',88),'completed',null,null,123,null,'{"valid":true}'::jsonb,'req-1'
  );
  if r->>'state' <> 'unauthorized' then raise exception 'verifier claim bypassed: %',r; end if;

  perform set_config('request.jwt.claims','{"solmint_user_id":"user-a","solmint_pay_verifier":"true"}',true);
  r := public.pay_apply_payout_verification(
    '00000000-0000-0000-0000-000000000001',v_batch_id,repeat('A',88),'completed',null,null,123,null,'{"valid":true}'::jsonb,'req-1'
  );
  if r->>'state' <> 'updated' then raise exception 'verifier update failed: %',r; end if;
  if (select status from public.pay_payout_batches where id=batch_id) <> 'completed' then raise exception 'batch not completed'; end if;
  if (select count(*) from public.pay_payout_items i where i.batch_id=v_batch_id and i.status='completed') <> 2 then raise exception 'items not completed'; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
begin
  begin
    insert into public.pay_payout_batches(merchant_id,created_by_user_id,asset,source_wallet_address,total_amount_atomic,item_count,status,verification_commitment)
    values ('00000000-0000-0000-0000-000000000001','user-a','SOL','11111111111111111111111111111111',1,1,'ready','finalized');
    raise exception 'authenticated direct insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

select 'pay_bulk_payout_security_ok' as result;