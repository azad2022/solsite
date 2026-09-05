create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index if not exists auth_sessions_expires_at_idx on public.auth_sessions(expires_at);

alter table public.auth_sessions enable row level security;
revoke all on table public.auth_sessions from anon, authenticated;

create table if not exists public.auth_login_attempts (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.auth_login_attempts enable row level security;
revoke all on table public.auth_login_attempts from anon, authenticated;

create or replace function public.check_auth_login_rate_limit(
  p_key_hash text,
  p_max_attempts integer default 8,
  p_window_seconds integer default 900,
  p_block_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auth_login_attempts%rowtype;
  v_now timestamptz := now();
begin
  insert into public.auth_login_attempts(key_hash, window_started_at, attempt_count, blocked_until, updated_at)
  values (p_key_hash, v_now, 0, null, v_now)
  on conflict (key_hash) do nothing;

  select * into v_row from public.auth_login_attempts where key_hash = p_key_hash for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.auth_login_attempts
      set window_started_at = v_now, attempt_count = 0, blocked_until = null, updated_at = v_now
      where key_hash = p_key_hash;
  end if;

  return true;
end;
$$;

create or replace function public.record_auth_login_failure(
  p_key_hash text,
  p_window_seconds integer default 900,
  p_max_attempts integer default 8,
  p_block_seconds integer default 900
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_attempts integer;
begin
  insert into public.auth_login_attempts(key_hash, window_started_at, attempt_count, blocked_until, updated_at)
  values (p_key_hash, v_now, 0, null, v_now)
  on conflict (key_hash) do nothing;

  update public.auth_login_attempts
    set
      window_started_at = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now else window_started_at end,
      attempt_count = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1 else attempt_count + 1 end,
      blocked_until = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then null
                           when attempt_count + 1 >= p_max_attempts then v_now + make_interval(secs => p_block_seconds)
                           else blocked_until end,
      updated_at = v_now
    where key_hash = p_key_hash
  returning attempt_count into v_attempts;
end;
$$;

revoke all on function public.check_auth_login_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.record_auth_login_failure(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.check_auth_login_rate_limit(text, integer, integer, integer) to service_role;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer) to service_role;

create index if not exists auth_login_attempts_blocked_until_idx on public.auth_login_attempts(blocked_until);
