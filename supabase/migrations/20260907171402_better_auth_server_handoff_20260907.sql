-- Server-only resolver for Supabase Edge Functions that need to consume an
-- already-authenticated Better Auth session without accepting the legacy
-- public.auth_sessions bearer token.
--
-- The function is intentionally not executable by anon/authenticated/public.
-- Edge Functions call it through PostgREST using the service-role key.

create or replace function public.solmint_resolve_better_auth_session(p_token text)
returns table (
  better_auth_user_id text,
  application_user_id text,
  username text,
  full_name text,
  role text,
  permissions jsonb,
  is_active boolean,
  expires_at timestamptz
)
language sql
security definer
set search_path = better_auth, public, pg_catalog
as $$
  select
    s.user_id,
    l.application_user_id,
    u.username,
    u.full_name,
    u.role,
    case
      when jsonb_typeof(u.permissions::jsonb) = 'array' then u.permissions::jsonb
      else '[]'::jsonb
    end,
    u.is_active,
    s.expires_at
  from better_auth.session s
  join better_auth."user" bu on bu.id = s.user_id
  join public.auth_identity_links l on l.better_auth_user_id = s.user_id
  join public.users u on u.id = l.application_user_id
  where s.token = p_token
    and s.expires_at > now()
    and u.is_active = true
  limit 1;
$$;

revoke all on function public.solmint_resolve_better_auth_session(text) from public;
revoke all on function public.solmint_resolve_better_auth_session(text) from anon;
revoke all on function public.solmint_resolve_better_auth_session(text) from authenticated;
grant execute on function public.solmint_resolve_better_auth_session(text) to service_role;
