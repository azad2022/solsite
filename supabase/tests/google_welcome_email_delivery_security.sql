-- Security regression test for the server-only Google welcome email delivery boundary.

create schema if not exists better_auth;

create table better_auth."user" (
  id text primary key,
  name text not null default '',
  email text not null default ''
);

create temp table _google_welcome_created_roles (
  rolname text primary key
);

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I noinherit', role_name);
      insert into _google_welcome_created_roles values (role_name);
    end if;
  end loop;
end;
$$;

\i supabase/migrations/20261001110000_solmint_google_welcome_email_delivery.sql

do $$
declare
  claim jsonb;
  second_claim jsonb;
  completed jsonb;
  final_claim jsonb;
  retry_claim jsonb;
  retry_failed jsonb;
  service_can_execute boolean;
  anon_can_execute boolean;
  service_can_select boolean;
  authenticated_can_select boolean;
begin
  insert into better_auth."user"(id, name, email)
  values ('welcome-security-user-0001', 'Security Test', 'security@example.test');

  claim := public.solmint_claim_auth_welcome_email_delivery(
    'welcome-security-user-0001',
    'google',
    'security-worker-1'
  );
  if claim->>'ok' <> 'true' or claim->>'should_send' <> 'true' then
    raise exception 'Initial welcome claim did not become sendable: %', claim;
  end if;

  second_claim := public.solmint_claim_auth_welcome_email_delivery(
    'welcome-security-user-0001',
    'google',
    'security-worker-2'
  );
  if second_claim->>'ok' <> 'true' or second_claim->>'should_send' <> 'false' then
    raise exception 'Concurrent welcome claim was not suppressed: %', second_claim;
  end if;

  completed := public.solmint_complete_auth_welcome_email_delivery(
    (claim->>'delivery_id')::uuid,
    'security-worker-1'
  );
  if completed->>'ok' <> 'true' or completed->>'status' <> 'sent' then
    raise exception 'Welcome completion failed: %', completed;
  end if;

  final_claim := public.solmint_claim_auth_welcome_email_delivery(
    'welcome-security-user-0001',
    'google',
    'security-worker-3'
  );
  if final_claim->>'ok' <> 'true' or final_claim->>'should_send' <> 'false' or final_claim->>'status' <> 'sent' then
    raise exception 'Sent welcome delivery was not permanently suppressed: %', final_claim;
  end if;

  insert into better_auth."user"(id, name, email)
  values ('welcome-security-user-0002', 'Retry Test', 'retry@example.test');

  claim := public.solmint_claim_auth_welcome_email_delivery(
    'welcome-security-user-0002',
    'google',
    'security-worker-4'
  );
  retry_failed := public.solmint_fail_auth_welcome_email_delivery(
    (claim->>'delivery_id')::uuid,
    'security-worker-4',
    'SMTP_TEMPORARY_FAILURE'
  );
  if retry_failed->>'ok' <> 'true' or retry_failed->>'status' <> 'failed' then
    raise exception 'Welcome failure transition failed: %', retry_failed;
  end if;

  update public.auth_welcome_email_deliveries
     set next_attempt_at = now() - interval '1 second'
   where user_id = 'welcome-security-user-0002'
     and provider_id = 'google';

  retry_claim := public.solmint_claim_auth_welcome_email_delivery(
    'welcome-security-user-0002',
    'google',
    'security-worker-5'
  );
  if retry_claim->>'ok' <> 'true' or retry_claim->>'should_send' <> 'true' then
    raise exception 'Failed welcome delivery was not retryable: %', retry_claim;
  end if;

  select has_function_privilege(
    'service_role',
    'public.solmint_claim_auth_welcome_email_delivery(text,text,text)',
    'EXECUTE'
  ) into service_can_execute;

  select has_function_privilege(
    'authenticated',
    'public.solmint_claim_auth_welcome_email_delivery(text,text,text)',
    'EXECUTE'
  ) into anon_can_execute;

  select has_table_privilege(
    'service_role',
    'public.auth_welcome_email_deliveries',
    'SELECT'
  ) into service_can_select;

  select has_table_privilege(
    'authenticated',
    'public.auth_welcome_email_deliveries',
    'SELECT'
  ) into authenticated_can_select;

  if not service_can_execute then
    raise exception 'service_role cannot execute welcome claim RPC';
  end if;
  if anon_can_execute then
    raise exception 'authenticated role can execute welcome claim RPC';
  end if;
  if not service_can_select then
    raise exception 'service_role cannot inspect welcome deliveries';
  end if;
  if authenticated_can_select then
    raise exception 'authenticated role can inspect welcome deliveries';
  end if;
end;
$$;


do $$
declare
  role_name text;
begin
  for role_name in select rolname from _google_welcome_created_roles loop
    execute format('drop role %I', role_name);
  end loop;
end;
$$;
