begin;

select plan(5);

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

select * from finish();
rollback;
