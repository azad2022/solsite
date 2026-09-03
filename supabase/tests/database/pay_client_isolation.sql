begin;

select plan(3);

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

select * from finish();
rollback;
