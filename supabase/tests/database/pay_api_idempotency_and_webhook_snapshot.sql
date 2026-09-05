begin;

select plan(26);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pay_merchants_owner_user_uidx' and indexdef ilike '%unique%'),
  'merchant ownership is uniquely constrained per user'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pay_idempotency_keys'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid, true) ilike '%(merchant_id, scope, idempotency_key)%'
  ),
  'payment intent idempotency key is uniquely constrained by merchant and endpoint scope'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pay_create_payment_intent' and pg_get_functiondef(p.oid) ilike '%on conflict (merchant_id, scope, idempotency_key) do nothing%'),
  'Payment Intent creation acquires idempotency state with conflict-safe insert'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pay_create_payment_intent' and pg_get_functiondef(p.oid) ilike '%status = ''processing''%' and pg_get_functiondef(p.oid) ilike '%state'', ''in_progress%'),
  'concurrent identical requests have an explicit in-progress state'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pay_create_payment_intent' and pg_get_functiondef(p.oid) ilike '%state'', ''replay%'' and pg_get_functiondef(p.oid) ilike '%request_hash%'),
  'completed idempotent requests replay only when request hashes match'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pay_apply_verified_observation' and pg_get_functiondef(p.oid) ilike '%destinationauthority%'),
  'token reconciliation binds settlement to token-account owner authority'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pay_apply_verified_observation' and pg_get_functiondef(p.oid) ilike '%if v_payment.asset = ''SOL'' then%'),
  'reconciliation separates native SOL destination semantics from token-account semantics'
);

select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='pay_webhook_deliveries' and column_name='endpoint_url_snapshot' and is_nullable='NO'), 'webhook endpoint is snapshotted and mandatory');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='pay_webhook_deliveries' and column_name='secret_ciphertext_snapshot'), 'webhook signing secret envelope is snapshotted');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='pay_webhook_deliveries' and column_name='secret_key_version_snapshot'), 'webhook secret key version is snapshotted');

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='pay_enqueue_webhook_deliveries' and pg_get_functiondef(p.oid) ilike '%endpoint_url_snapshot%' and pg_get_functiondef(p.oid) ilike '%secret_ciphertext_snapshot%'),
  'webhook enqueue copies routing and signing snapshots'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='pay_claim_webhook_deliveries' and pg_get_functiondef(p.oid) ilike '%endpoint_url_snapshot%' and pg_get_functiondef(p.oid) ilike '%secret_ciphertext_snapshot%'),
  'webhook claim reads immutable delivery snapshots rather than live webhook routing'
);

insert into public.users(id) values ('pay-audit-user') on conflict do nothing;

select lives_ok(
  $$ select public.pay_create_merchant('pay-audit-user', 'Audit Merchant', 'pay-audit-merchant') $$,
  'merchant creation succeeds for the audit fixture'
);

select ok((select count(*) from public.pay_merchants where owner_user_id='pay-audit-user') = 1, 'merchant creation produces exactly one merchant');

update public.pay_merchants set status='active' where owner_user_id='pay-audit-user';

select is(
  (select public.pay_create_payment_intent(
    (select id from public.pay_merchants where owner_user_id='pay-audit-user'),
    'order-1', 1000000, 'SOL', null, null, null, 'MERCHANT', 'REFERENCE-1', 100, 'merchant',
    10000, 1000000, 990000, 'SOLMINT', 'solana', now() + interval '15 minutes', '{}'::jsonb,
    'idem-1', 'hash-1', 'payment-intents:create'
  )->>'state'),
  'created',
  'first idempotent Payment Intent request creates exactly one resource'
);

select is((select merchant_settlement_atomic::text from public.pay_payment_intents where external_order_id='order-1'), '990000', 'merchant-fee Payment Intent persists the canonical merchant settlement leg');
select is((select customer_total_atomic::text from public.pay_payment_intents where external_order_id='order-1'), '1000000', 'merchant-fee Payment Intent keeps the customer total at the base amount');

select is(
  (select public.pay_create_payment_intent(
    (select id from public.pay_merchants where owner_user_id='pay-audit-user'),
    'order-2', 1000000, 'SOL', null, null, null, 'MERCHANT', 'REFERENCE-2', 100, 'customer',
    10000, 1010000, 1000000, 'SOLMINT', 'solana', now() + interval '15 minutes', '{}'::jsonb,
    'idem-2', 'hash-2-customer', 'payment-intents:create'
  )->>'state'),
  'created',
  'customer-fee Payment Intent also creates successfully'
);

select is((select merchant_settlement_atomic::text from public.pay_payment_intents where external_order_id='order-2'), '1000000', 'customer-fee Payment Intent settles the merchant for the base amount');
select is((select customer_total_atomic::text from public.pay_payment_intents where external_order_id='order-2'), '1010000', 'customer-fee Payment Intent persists the fee-inclusive customer total');

select is((select (merchant_settlement_atomic = merchant_net_atomic) from public.pay_payment_intents where external_order_id='order-1'), true, 'merchant settlement and merchant net remain aligned for merchant-paid fees');
select is((select (merchant_settlement_atomic = merchant_net_atomic) from public.pay_payment_intents where external_order_id='order-2'), true, 'merchant settlement and merchant net remain aligned for customer-paid fees');

select throws_ok(
  $$ select public.pay_create_payment_intent(
    (select id from public.pay_merchants where owner_user_id='pay-audit-user'),
    'order-invalid', 1000000, 'SOL', null, null, null, 'MERCHANT', 'REFERENCE-INVALID', 100, 'merchant',
    10000, 1000000, 980000, 'SOLMINT', 'solana', now() + interval '15 minutes', '{}'::jsonb,
    'idem-invalid', 'hash-invalid', 'payment-intents:create'
  ) $$,
  'payment fee invariants do not match canonical calculation',
  'caller-supplied accounting mismatch is rejected before persistence'
);

select is(
  (select public.pay_create_payment_intent(
    (select id from public.pay_merchants where owner_user_id='pay-audit-user'),
    'order-1', 1000000, 'SOL', null, null, null, 'MERCHANT', 'REFERENCE-OTHER', 100, 'merchant',
    10000, 1000000, 990000, 'SOLMINT', 'solana', now() + interval '15 minutes', '{}'::jsonb,
    'idem-1', 'hash-1', 'payment-intents:create'
  )->>'state'),
  'replay',
  'identical idempotent request replays the stored response and ignores a newly supplied reference'
);

select is(
  (select public.pay_create_payment_intent(
    (select id from public.pay_merchants where owner_user_id='pay-audit-user'),
    'order-1', 2000000, 'SOL', null, null, null, 'MERCHANT', 'REFERENCE-3', 100, 'merchant',
    20000, 2000000, 1980000, 'SOLMINT', 'solana', now() + interval '15 minutes', '{}'::jsonb,
    'idem-1', 'hash-2', 'payment-intents:create'
  )->>'state'),
  'conflict',
  'reusing an idempotency key with different request data is rejected deterministically'
);

select is((select count(*) from public.pay_payment_intents where merchant_id=(select id from public.pay_merchants where owner_user_id='pay-audit-user')), 2, 'idempotent replay does not create a second payment intent');

select * from finish();
rollback;
