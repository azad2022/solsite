begin;

select plan(14);

-- Pay is intentionally server-mediated. Client roles must not be able to reach
-- Pay tables directly, and every Pay table must have PostgreSQL RLS enabled.
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'pay_%'
      and c.relkind = 'r'
  ),
  'Pay tables exist in the local migration build'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'pay_%'
      and c.relkind = 'r'
      and c.relrowsecurity is not true
  ),
  'Every Pay table has Row Level Security enabled'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name like 'pay_%'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  'Client roles have no direct table privileges on Pay data'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'pay_revenue_ledger'
      and t.tgname = 'pay_revenue_ledger_state_guard'
      and not t.tgisinternal
  ),
  'Revenue recognition has a database state guard trigger'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pay_guard_initial_revenue_recognition'
      and p.prosecdef is true
      and p.proconfig @> array['search_path=""']::text[]
  ),
  'Revenue recognition guard is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'pay_payment_events'
      and t.tgname = 'pay_payment_event_enqueue_webhooks'
      and not t.tgisinternal
  ),
  'Payment events enqueue webhook deliveries through a database trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pay_webhook_deliveries'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (webhook_id, event_id)'
  ),
  'Webhook deliveries are idempotent per webhook and event'
);

select ok(
  not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pay_webhook_deliveries'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (event_id)'
  ),
  'Webhook event ids are not globally unique across subscriptions'
);

select ok(
  not exists (
    select 1
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name in (
        'pay_claim_webhook_deliveries',
        'pay_complete_webhook_delivery',
        'pay_fail_webhook_delivery'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ),
  'Webhook worker RPCs are not executable by public or client roles'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'pay_claim_webhook_deliveries',
        'pay_complete_webhook_delivery',
        'pay_fail_webhook_delivery'
      )
      and (
        p.prosecdef is not true
        or not (p.proconfig @> array['search_path=""']::text[])
      )
  ),
  'Webhook worker RPCs use SECURITY DEFINER with an empty search_path'
);

select ok(
  not exists (
    select 1
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name in (
        'pay_claim_webhook_deliveries',
        'pay_complete_webhook_delivery',
        'pay_fail_webhook_delivery'
      )
      and grantee = 'anon'
      and privilege_type = 'EXECUTE'
  ),
  'Anonymous role cannot execute webhook worker RPCs'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'pay_payment_transfers'
      and t.tgname = 'pay_payment_transfer_merchant_ledger'
      and not t.tgisinternal
  ),
  'Merchant principal ledger is triggered after transfer-leg insertion'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pay_apply_verified_observation'
      and p.prosecdef is true
      and p.proconfig @> array['search_path=""']::text[]
      and position('destinationAuthority' in pg_get_functiondef(p.oid)) > 0
  ),
  'Verified reconciliation validates SPL destination authority in a SECURITY DEFINER function'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pay_payment_transactions'
      and i.indisunique
      and i.indpred is null
      and pg_get_indexdef(i.indexrelid) like '%(signature)%'
  ),
  'Blockchain signatures are globally unique across payment transactions'
);

select * from finish();
rollback;
