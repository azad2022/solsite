-- Atomic rate limiting for Pay APIs.
-- The application must call these functions rather than read-then-write a
-- counter, preventing race conditions between concurrent requests/workers.

create or replace function public.pay_check_and_increment_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_max_requests integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_allowed boolean;
begin
  if p_scope is null or p_subject_hash is null or p_window_seconds <= 0 or p_max_requests <= 0 then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.pay_rate_limit_buckets (
    scope, subject_hash, window_started_at, request_count, created_at, updated_at
  )
  values (
    p_scope, p_subject_hash, v_window_start, 1, p_now, p_now
  )
  on conflict (scope, subject_hash, window_started_at)
  do update set
    request_count = public.pay_rate_limit_buckets.request_count + 1,
    updated_at = p_now;

  select request_count <= p_max_requests
    into v_allowed
    from public.pay_rate_limit_buckets
   where scope = p_scope
     and subject_hash = p_subject_hash
     and window_started_at = v_window_start;

  return v_allowed;
end;
$$;

revoke all on function public.pay_check_and_increment_rate_limit(text, text, integer, integer, timestamptz) from public, anon, authenticated;

drop policy if exists pay_api_keys_no_direct_client_access on public.pay_api_keys;
drop policy if exists pay_rate_limit_buckets_no_direct_client_access on public.pay_rate_limit_buckets;

comment on function public.pay_check_and_increment_rate_limit(text, text, integer, integer, timestamptz) is 'Atomic server-only rate-limit increment. No direct client execution is allowed.';
