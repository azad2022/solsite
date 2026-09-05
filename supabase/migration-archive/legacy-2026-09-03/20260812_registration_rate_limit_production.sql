-- Production protection for public account registration.
-- The registration endpoint is server-authoritative; this RPC is callable only with service_role.

create table if not exists public.registration_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.registration_rate_limits enable row level security;
revoke all on public.registration_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.registration_rate_limits to service_role;

create or replace function public.consume_registration_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz;
  v_count integer;
begin
  if length(trim(coalesce(p_key_hash, ''))) < 32 then raise exception 'invalid_registration_rate_key'; end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_registration_rate_window'; end if;
  if p_max_requests < 1 or p_max_requests > 1000 then raise exception 'invalid_registration_rate_limit'; end if;

  insert into public.registration_rate_limits(key_hash, window_started_at, request_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash)
  do update set
    window_started_at = case
      when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now()
      else public.registration_rate_limits.window_started_at
    end,
    request_count = case
      when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1
      else public.registration_rate_limits.request_count + 1
    end;

  select window_started_at, request_count into v_started, v_count
  from public.registration_rate_limits
  where registration_rate_limits.key_hash = p_key_hash;

  return not (v_started > now() - make_interval(secs => p_window_seconds) and v_count > p_max_requests);
end;
$$;

revoke all on function public.consume_registration_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_registration_rate_limit(text, integer, integer) to service_role;
