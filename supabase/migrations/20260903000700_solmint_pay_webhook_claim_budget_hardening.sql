-- Bound webhook worker claim size to the runtime's sequential processing budget.
-- The worker performs deliveries serially and each outbound request can consume
-- up to 10 seconds. A short lease combined with a large claim batch could let
-- another worker reclaim a still-active batch and race completion/failure writes.

create or replace function public.pay_claim_webhook_deliveries(
  p_worker_id text,
  p_limit integer default 20,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  webhook_id uuid,
  event_id text,
  event_type text,
  payload jsonb,
  endpoint_url text,
  secret_ciphertext text,
  secret_key_version text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 8 or p_worker_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid webhook worker id';
  end if;
  if p_limit < 1 or p_limit > 20 then
    raise exception 'invalid webhook claim limit';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 600 then
    raise exception 'invalid webhook lease';
  end if;

  return query
  with candidates as (
    select d.id
      from public.pay_webhook_deliveries d
     where (
       d.status in ('pending','failed') and coalesce(d.next_attempt_at, now()) <= now()
     )
        or (
          d.status = 'delivering'
          and d.locked_at is not null
          and d.locked_at <= now() - make_interval(secs => p_lease_seconds)
        )
     order by coalesce(d.next_attempt_at, d.created_at), d.created_at, d.id
     for update of d skip locked
     limit p_limit
  ),
  claimed as (
    update public.pay_webhook_deliveries d
       set status = 'delivering',
           locked_at = now(),
           locked_by = p_worker_id
      from candidates c
     where d.id = c.id
    returning d.*
  )
  select c.id,
         c.webhook_id,
         c.event_id,
         c.event_type,
         c.payload,
         w.endpoint_url,
         w.secret_ciphertext,
         w.secret_key_version,
         c.attempt_count
    from claimed c
    join public.pay_webhooks w on w.id = c.webhook_id;
end;
$$;

revoke all on function public.pay_claim_webhook_deliveries(text,integer,integer) from public, anon, authenticated;
grant execute on function public.pay_claim_webhook_deliveries(text,integer,integer) to service_role;

comment on function public.pay_claim_webhook_deliveries(text,integer,integer) is
  'Claims up to 20 due webhook deliveries with a lease of 60-600 seconds; the production worker defaults to 20 deliveries and a 300-second lease.';
