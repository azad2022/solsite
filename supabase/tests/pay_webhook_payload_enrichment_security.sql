-- Production-equivalent contract test for the merchant webhook payload migration.
-- Runs in a dedicated, disposable PostgreSQL database in CI. It bootstraps only the
-- columns used by the actual trigger function, applies the exact migration, and tests
-- the enqueue path without touching a live Supabase project.

\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create table public.pay_payment_intents (
  id uuid primary key,
  merchant_id uuid not null,
  amount_atomic numeric(78,0) not null,
  customer_total_atomic numeric(78,0) not null,
  merchant_net_atomic numeric(78,0) not null,
  asset text not null,
  network text not null,
  external_order_id text,
  payment_link_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  fee_recipient text,
  customer_first_name text,
  customer_last_name text,
  customer_purpose text
);

create table public.pay_webhooks (
  id uuid primary key,
  merchant_id uuid not null,
  endpoint_url text not null,
  secret_ciphertext text,
  secret_key_version text,
  status text not null default 'active',
  active boolean not null default true,
  subscribed_events text[] not null default '{}'::text[]
);

create table public.pay_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  endpoint_url_snapshot text not null,
  secret_ciphertext_snapshot text,
  secret_key_version_snapshot text,
  attempt_count integer not null default 0,
  status text not null default 'pending',
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  response_status integer,
  response_hash text,
  error_code text,
  locked_at timestamptz,
  locked_by text,
  unique (webhook_id, event_id)
);

create table public.pay_payment_events (
  id uuid primary key,
  payment_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  request_id text,
  actor_type text not null default 'system',
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

\ir ../migrations/20261028064400_solmint_pay_webhook_payload_enrichment.sql

create trigger pay_payment_event_enqueue_webhooks
after insert on public.pay_payment_events
for each row execute function public.pay_enqueue_webhook_deliveries();

insert into public.pay_payment_intents (
  id, merchant_id, amount_atomic, customer_total_atomic, merchant_net_atomic,
  asset, network, external_order_id, payment_link_id, metadata, fee_recipient,
  customer_first_name, customer_last_name, customer_purpose
) values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  123456789012345678901234567890,
  123456789012345678901234567899,
  123456789012345678901234567887,
  'USDC',
  'solana',
  'order-2026-42',
  '22222222-2222-4222-8222-222222222222',
  '{"paymentLinkSlug":"shop-order-42","paymentLinkTitle":"CANARY_PRIVATE_TITLE","customerFirstName":"CANARY_PII","privateValue":"CANARY_METADATA_SECRET"}'::jsonb,
  'CANARY_FEE_RECIPIENT',
  'CANARY_CUSTOMER_FIRST_NAME',
  'CANARY_CUSTOMER_LAST_NAME',
  'CANARY_CUSTOMER_PURPOSE'
);

insert into public.pay_webhooks (
  id, merchant_id, endpoint_url, secret_ciphertext, secret_key_version, status, active, subscribed_events
) values
  (
    '01000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://hooks.example.com/primary',
    'CANARY_WEBHOOK_SECRET',
    'v1',
    'active',
    true,
    array['payment.status_changed']::text[]
  ),
  (
    '01000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://hooks.example.com/disabled',
    'DISABLED_SECRET',
    'v1',
    'active',
    false,
    array['payment.status_changed']::text[]
  ),
  (
    '01000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://hooks.example.com/unsubscribed',
    'UNSUBSCRIBED_SECRET',
    'v1',
    'active',
    true,
    array['payment.completed']::text[]
  ),
  (
    '01000000-0000-4000-8000-000000000004',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://hooks.example.com/all-events',
    'ALL_EVENTS_SECRET',
    'v1',
    'active',
    true,
    '{}'::text[]
  ),
  (
    '01000000-0000-4000-8000-000000000005',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'https://hooks.other-merchant.example.com',
    'OTHER_MERCHANT_SECRET',
    'v1',
    'active',
    true,
    array['payment.status_changed']::text[]
  );

insert into public.pay_payment_events (
  id, payment_id, event_type, from_status, to_status, payload, created_at
) values (
  '03000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'payment.status_changed',
  'created',
  'pending',
  '{"reason":"customer_verification_requested"}'::jsonb,
  '2026-10-28T00:00:00Z'::timestamptz
);

-- Pre-existing delivery simulates a retry/replay against the same (webhook,event)
-- idempotency key. The migration must leave this row untouched.
insert into public.pay_webhook_deliveries (
  id, webhook_id, event_id, event_type, payload, endpoint_url_snapshot,
  secret_ciphertext_snapshot, secret_key_version_snapshot
) values (
  '04000000-0000-4000-8000-000000000001',
  '01000000-0000-4000-8000-000000000001',
  '03000000-0000-4000-8000-000000000002',
  'payment.status_changed',
  '{"sentinel":"preserve-existing"}'::jsonb,
  'https://hooks.example.com/primary',
  'CANARY_WEBHOOK_SECRET',
  'v1'
);

insert into public.pay_payment_events (
  id, payment_id, event_type, from_status, to_status, payload, created_at
) values (
  '03000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'payment.status_changed',
  'pending',
  'detected',
  '{"reason":"observation_detected"}'::jsonb,
  '2026-10-28T00:01:00Z'::timestamptz
);

do $$
declare
  v_payload jsonb;
  v_function_definer boolean;
  v_function_config text[];
  v_count integer;
begin
  select p.prosecdef, p.proconfig
    into v_function_definer, v_function_config
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pay_enqueue_webhook_deliveries'
     and pg_get_function_identity_arguments(p.oid) = '';

  if v_function_definer is distinct from true then
    raise exception 'webhook enqueue function must remain SECURITY DEFINER';
  end if;
  if not ('search_path=""' = any(coalesce(v_function_config, array[]::text[]))) then
    raise exception 'webhook enqueue function must retain empty search_path';
  end if;
  if has_function_privilege('anon', 'public.pay_enqueue_webhook_deliveries()', 'EXECUTE') then
    raise exception 'anon must not receive EXECUTE on webhook enqueue function';
  end if;
  if has_function_privilege('authenticated', 'public.pay_enqueue_webhook_deliveries()', 'EXECUTE') then
    raise exception 'authenticated must not receive EXECUTE on webhook enqueue function';
  end if;
  if not has_function_privilege('service_role', 'public.pay_enqueue_webhook_deliveries()', 'EXECUTE') then
    raise exception 'service_role must retain EXECUTE on webhook enqueue function';
  end if;

  select count(*) into v_count
    from public.pay_webhook_deliveries
   where event_id = '03000000-0000-4000-8000-000000000001';
  if v_count <> 2 then
    raise exception 'expected exactly two deliveries for the subscribed active same-merchant webhooks; got %', v_count;
  end if;

  if exists (
    select 1 from public.pay_webhook_deliveries
     where event_id = '03000000-0000-4000-8000-000000000001'
       and webhook_id not in (
         '01000000-0000-4000-8000-000000000001',
         '01000000-0000-4000-8000-000000000004'
       )
  ) then
    raise exception 'inactive, unsubscribed, or cross-merchant webhook received a delivery';
  end if;

  select payload into v_payload
    from public.pay_webhook_deliveries
   where webhook_id = '01000000-0000-4000-8000-000000000001'
     and event_id = '03000000-0000-4000-8000-000000000001';

  if v_payload ->> 'id' IS DISTINCT FROM '03000000-0000-4000-8000-000000000001'
    or v_payload ->> 'type' IS DISTINCT FROM 'payment.status_changed'
    or (v_payload ->> 'createdAt')::timestamptz IS DISTINCT FROM '2026-10-28T00:00:00Z'::timestamptz then
    raise exception 'existing webhook envelope fields changed unexpectedly: %', v_payload;
  end if;

  if v_payload #>> '{data,paymentId}' IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'
    or v_payload #>> '{data,status}' IS DISTINCT FROM 'pending'
    or v_payload #>> '{data,previousStatus}' IS DISTINCT FROM 'created'
    or v_payload #>> '{data,amountAtomic}' IS DISTINCT FROM '123456789012345678901234567890'
    or v_payload #>> '{data,customerTotalAtomic}' IS DISTINCT FROM '123456789012345678901234567899'
    or v_payload #>> '{data,merchantNetAtomic}' IS DISTINCT FROM '123456789012345678901234567887'
    or v_payload #>> '{data,asset}' IS DISTINCT FROM 'USDC'
    or v_payload #>> '{data,network}' IS DISTINCT FROM 'solana'
    or v_payload #>> '{data,externalOrderId}' IS DISTINCT FROM 'order-2026-42'
    or v_payload #>> '{data,paymentLinkId}' IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'
    or v_payload #>> '{data,paymentLinkSlug}' IS DISTINCT FROM 'shop-order-42'
    or v_payload #>> '{data,reason}' IS DISTINCT FROM 'customer_verification_requested' then
    raise exception 'webhook payload is missing or misrepresenting allowlisted fields: %', v_payload;
  end if;

  if jsonb_typeof(v_payload #> '{data,amountAtomic}') IS DISTINCT FROM 'string'
    or jsonb_typeof(v_payload #> '{data,customerTotalAtomic}') IS DISTINCT FROM 'string'
    or jsonb_typeof(v_payload #> '{data,merchantNetAtomic}') IS DISTINCT FROM 'string' then
    raise exception 'atomic amount fields must be JSON strings';
  end if;

  if (v_payload -> 'data') ? 'metadata'
    or (v_payload -> 'data') ? 'feeRecipient'
    or (v_payload -> 'data') ? 'customerFirstName'
    or (v_payload -> 'data') ? 'customerLastName'
    or (v_payload -> 'data') ? 'customerPurpose'
    or position('CANARY_' in v_payload::text) > 0
    or position('paymentLinkTitle' in v_payload::text) > 0 then
    raise exception 'private customer, secret, fee destination, or full metadata leaked into webhook payload: %', v_payload;
  end if;

  if octet_length(convert_to(v_payload::text, 'UTF8')) > 262144 then
    raise exception 'webhook payload exceeds the existing 256 KiB body limit';
  end if;

  select count(*) into v_count
    from public.pay_webhook_deliveries
   where webhook_id = '01000000-0000-4000-8000-000000000001'
     and event_id = '03000000-0000-4000-8000-000000000002';
  if v_count <> 1 then
    raise exception 'duplicate webhook delivery was created for an existing idempotency key';
  end if;

  select payload into v_payload
    from public.pay_webhook_deliveries
   where webhook_id = '01000000-0000-4000-8000-000000000001'
     and event_id = '03000000-0000-4000-8000-000000000002';
  if v_payload ->> 'sentinel' IS DISTINCT FROM 'preserve-existing' then
    raise exception 'idempotent conflict overwrote an existing webhook delivery';
  end if;

  select count(*) into v_count
    from public.pay_webhook_deliveries
   where webhook_id = '01000000-0000-4000-8000-000000000004'
     and event_id = '03000000-0000-4000-8000-000000000002';
  if v_count <> 1 then
    raise exception 'empty subscribed_events must continue to receive all events';
  end if;
end $$;

rollback;
