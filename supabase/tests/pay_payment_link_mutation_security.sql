-- SolMint Pay Payment Link mutation security fixture.
-- Exercises the exact mutation migration against an isolated PostgreSQL database.
-- Verifies RBAC/tenant isolation, idempotency, historical Payment Intent safety,
-- safe deletion, and authenticated-only function execution.

DO $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

grant usage on schema public to anon, authenticated;

create table public.users (
  id text primary key,
  is_active boolean not null default true
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

create table public.pay_payment_links (
  id uuid primary key,
  merchant_id uuid not null,
  slug text not null unique,
  title text not null,
  description text,
  fixed_amount_atomic numeric(78,0) not null,
  asset text not null,
  fee_payer text not null,
  checkout_locale text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pay_payment_intents (
  id uuid primary key,
  merchant_id uuid not null,
  payment_link_id uuid references public.pay_payment_links(id) on delete restrict,
  amount_atomic numeric(78,0) not null,
  asset text not null,
  status text not null
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
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (merchant_id, scope, idempotency_key)
);

create or replace function public.pay_request_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'solmint_user_id'), '');
$$;

create or replace function public.pay_has_merchant_access(p_merchant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.pay_merchant_members mm
     where mm.merchant_id = p_merchant_id
       and mm.user_id = public.pay_request_user_id()
       and mm.status = 'active'
       and mm.role = any(p_roles)
  );
$$;

\i supabase/migrations/20260927150000_solmint_pay_payment_link_mutations.sql

create or replace function public.test_payment_link_mutation_snapshot(
  p_link_id uuid,
  p_intent_id uuid
)
returns table(link_title text, link_amount numeric, intent_amount numeric, intent_link_id uuid)
language sql
security definer
set search_path = ''
as $pay_snapshot$
  select l.title, l.fixed_amount_atomic, i.amount_atomic, i.payment_link_id
    from public.pay_payment_links l
    left join public.pay_payment_intents i on i.id = p_intent_id
   where l.id = p_link_id
   limit 1;
$pay_snapshot$;

revoke all on function public.test_payment_link_mutation_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.test_payment_link_mutation_snapshot(uuid,uuid) to authenticated;

insert into public.users(id,is_active) values
  ('user-a',true),('user-b',true),('user-viewer',true);

insert into public.pay_merchants(id,status) values
  ('00000000-0000-0000-0000-000000000001','active'),
  ('00000000-0000-0000-0000-000000000002','active');

insert into public.pay_merchant_members(user_id,merchant_id,status,role) values
  ('user-a','00000000-0000-0000-0000-000000000001','active','owner'),
  ('user-viewer','00000000-0000-0000-0000-000000000001','active','viewer'),
  ('user-b','00000000-0000-0000-0000-000000000002','active','owner');

insert into public.pay_payment_links(
  id,merchant_id,slug,title,description,fixed_amount_atomic,asset,fee_payer,checkout_locale,is_active
) values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','mutation-link','Original title','Original description',1000000,'USDC','merchant','en-US',true),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','delete-me','Disposable',null,1000000,'USDC','merchant','en-US',true);

insert into public.pay_payment_intents(id,merchant_id,payment_link_id,amount_atomic,asset,status)
values ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101',1000000,'USDC','created');

revoke all on table public.pay_payment_links, public.pay_payment_intents, public.pay_idempotency_keys from anon, authenticated;

DO $$
begin
  if has_function_privilege('anon','public.pay_update_payment_link(uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text)','EXECUTE') then raise exception 'anon can execute payment link update'; end if;
  if has_function_privilege('anon','public.pay_delete_payment_link(uuid,uuid,text,text)','EXECUTE') then raise exception 'anon can execute payment link delete'; end if;
  if has_function_privilege('authenticated','public.pay_update_payment_link(uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text)','EXECUTE') is not true then raise exception 'authenticated update grant missing'; end if;
  if has_function_privilege('authenticated','public.pay_delete_payment_link(uuid,uuid,text,text)','EXECUTE') is not true then raise exception 'authenticated delete grant missing'; end if;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-b"}',true);
DO $pay_test$
declare
  r jsonb;
  v_link_title text;
  v_link_amount numeric;
  v_intent_amount numeric;
  v_intent_link_id uuid;
begin
  r := public.pay_update_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',
    'cross-merchant','Denied','',2000000,'USDC','merchant','en-US',true,null,'rbac-1',repeat('a',64)
  );
  if r->>'state' <> 'forbidden' then raise exception 'cross-merchant update was not denied: %',r; end if;
end $pay_test$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-viewer"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_update_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',
    'viewer-update','Denied','',2000000,'USDC','merchant','en-US',true,null,'rbac-2',repeat('b',64)
  );
  if r->>'state' <> 'forbidden' then raise exception 'viewer update was not denied: %',r; end if;
end $pay_test$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_update_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',
    'mutation-link-updated','Updated title','Updated description',2000000,'USDC','customer','fa-IR',true,null,'update-1',repeat('c',64)
  );
  if r->>'state' <> 'updated' then raise exception 'update failed: %',r; end if;
  if (r->'response_body'->'data'->>'fixed_amount_atomic') <> '2000000' then raise exception 'updated amount missing'; end if;

  r := public.pay_update_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',
    'mutation-link-updated','Updated title','Updated description',2000000,'USDC','customer','fa-IR',true,null,'update-1',repeat('c',64)
  );
  if r->>'state' <> 'replay' then raise exception 'update replay failed: %',r; end if;

  r := public.pay_update_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',
    'mutation-link-updated','Changed again','Updated description',2000000,'USDC','customer','fa-IR',true,null,'update-1',repeat('d',64)
  );
  if r->>'state' <> 'conflict' then raise exception 'update idempotency conflict missing: %',r; end if;

  select t.link_title, t.link_amount, t.intent_amount, t.intent_link_id
    into v_link_title, v_link_amount, v_intent_amount, v_intent_link_id
    from public.test_payment_link_mutation_snapshot(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000201'
    ) t;
  if v_intent_amount <> 1000000 then raise exception 'Payment Intent snapshot was mutated by link update'; end if;
  if v_intent_link_id <> '00000000-0000-0000-0000-000000000101' then raise exception 'Payment Intent link binding was mutated'; end if;
  if v_link_title <> 'Updated title' or v_link_amount <> 2000000 then raise exception 'Payment Link update was not persisted'; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_delete_payment_link(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','delete-linked',repeat('e',64)
  );
  if r->>'state' <> 'has_payments' then raise exception 'linked Payment Link deletion was not refused: %',r; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"solmint_user_id":"user-a"}',true);
DO $$
declare r jsonb;
begin
  r := public.pay_delete_payment_link(
    '00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','delete-empty',repeat('f',64)
  );
  if r->>'state' <> 'deleted' then raise exception 'unreferenced Payment Link deletion failed: %',r; end if;
  if exists(select 1 from public.pay_payment_links where id='00000000-0000-0000-0000-000000000102') then raise exception 'deleted Payment Link still exists'; end if;
end $$;
rollback;

select 'pay_payment_link_mutation_security_ok' as result;
