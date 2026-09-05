begin;

select plan(6);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'pay_check_and_increment_rate_limit'
       and p.prosecdef is true
       and p.proconfig @> array['search_path=""']::text[]
  ),
  'Pay rate-limit RPC is SECURITY DEFINER with an empty search_path'
);

select ok(
  not exists (
    select 1
      from information_schema.role_routine_grants
     where specific_schema = 'public'
       and routine_name = 'pay_check_and_increment_rate_limit'
       and grantee in ('PUBLIC', 'anon', 'authenticated')
       and privilege_type = 'EXECUTE'
  ),
  'Client roles cannot execute the Pay rate-limit RPC'
);

select ok(
  (public.pay_check_and_increment_rate_limit('audit:rate-limit', 'audit-subject', 60, 1, '2026-09-03 00:00:00+00'::timestamptz) is true)
  and
  (public.pay_check_and_increment_rate_limit('audit:rate-limit', 'audit-subject', 60, 1, '2026-09-03 00:00:00+00'::timestamptz) is false),
  'Pay rate-limit increment enforces the configured cap within one fixed window'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'pay_apply_verified_observation'
       and lower(pg_get_functiondef(p.oid)) like '%p_fee_payer <> v_merchant_source_authority%'
  ),
  'Verified reconciliation enforces fee-payer binding inside the database'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'pay_apply_verified_observation'
       and lower(pg_get_functiondef(p.oid)) like '%v_payment.gas_sponsored is distinct from false%'
  ),
  'Verified reconciliation fails closed while sponsored payment binding is not implemented'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'pay_transition_payment'
       and lower(pg_get_functiondef(p.oid)) like '%v_from = ''ambiguous''%'
       and lower(pg_get_functiondef(p.oid)) like '%''verifying''%'
  ),
  'Ambiguous payments can re-enter verification after a retry-safe evidence refresh'
);

select * from finish();
rollback;
