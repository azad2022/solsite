-- Production webhook delivery queue primitives.
-- Enqueue is derived from immutable payment events; delivery is at-least-once,
-- lease-based, retryable, and never allowed to mutate payment accounting.

create or replace function public.pay_enqueue_webhook_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pay_webhook_deliveries(
    webhook_id,
    event_id,
    event_type,
    payload,
    attempt_count,
    status,
    next_attempt_at
  )
  select
    w.id,
    new.id::text,
    new.event_type,
    jsonb_build_object(
      'id', new.id::text,
      'type', new.event_type,
      'createdAt', new.created_at,
      'data', new.payload
    ),
    0,
    'pending',
    now()
  from public.pay_webhooks w
  where w.merchant_id = (
    select p.merchant_id from public.pay_payment_intents p where p.id = new.payment_id
  )
    and coalesce(w.status, case when w.active then 'active' else 'disabled' end) = 'active'
    and w.active = true
    and (
      cardinality(w.subscribed_events) = 0
      or new.event_type = any(w.subscribed_events)
    )
  on conflict (webhook_id, event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.pay_enqueue_webhook_deliveries() from public, anon, authenticated;

drop trigger if exists pay_payment_event_enqueue_webhooks on public.pay_payment_events;
create trigger pay_payment_event_enqueue_webhooks
after insert on public.pay_payment_events
for each row execute function public.pay_enqueue_webhook_deliveries();

create or replace function public.pay_claim_webhook_deliveries(
  p_worker_id text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
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
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid webhook claim limit';
  end if;
  if p_lease_seconds < 10 or p_lease_seconds > 600 then
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

create or replace function public.pay_complete_webhook_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_response_status integer,
  p_response_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.pay_webhook_deliveries
     set status = 'delivered',
         delivered_at = now(),
         last_attempt_at = now(),
         response_status = p_response_status,
         response_hash = p_response_hash,
         error_code = null,
         locked_at = null,
         locked_by = null
   where id = p_delivery_id
     and status = 'delivering'
     and locked_by = p_worker_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'STALE_DELIVERY_LEASE');
  end if;
  return jsonb_build_object('ok', true, 'status', 'delivered');
end;
$$;

create or replace function public.pay_fail_webhook_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_error_code text,
  p_response_status integer default null,
  p_response_hash text default null,
  p_max_attempts integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer;
  v_status text;
  v_delay_seconds integer;
  v_updated integer;
begin
  if p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'invalid webhook max attempts';
  end if;

  select attempt_count into v_attempt
    from public.pay_webhook_deliveries
   where id = p_delivery_id
     and status = 'delivering'
     and locked_by = p_worker_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'STALE_DELIVERY_LEASE');
  end if;

  v_attempt := v_attempt + 1;
  if v_attempt >= p_max_attempts then
    v_status := 'dead_letter';
    v_delay_seconds := 0;
  else
    v_status := 'failed';
    v_delay_seconds := least(21600, greatest(30, (2 ^ least(v_attempt - 1, 8)) * 30));
  end if;

  update public.pay_webhook_deliveries
     set status = v_status,
         attempt_count = v_attempt,
         next_attempt_at = case when v_status = 'failed' then now() + make_interval(secs => v_delay_seconds) else null end,
         last_attempt_at = now(),
         response_status = p_response_status,
         response_hash = p_response_hash,
         error_code = left(coalesce(p_error_code, 'DELIVERY_FAILED'), 100),
         locked_at = null,
         locked_by = null
   where id = p_delivery_id
     and status = 'delivering'
     and locked_by = p_worker_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'STALE_DELIVERY_LEASE');
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'attemptCount', v_attempt, 'nextAttemptAt', case when v_status = 'failed' then now() + make_interval(secs => v_delay_seconds) else null end);
end;
$$;

revoke all on function public.pay_claim_webhook_deliveries(text,integer,integer) from public, anon, authenticated;
revoke all on function public.pay_complete_webhook_delivery(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.pay_fail_webhook_delivery(uuid,text,text,integer,text,integer) from public, anon, authenticated;
grant execute on function public.pay_claim_webhook_deliveries(text,integer,integer) to service_role;
grant execute on function public.pay_complete_webhook_delivery(uuid,text,integer,text) to service_role;
grant execute on function public.pay_fail_webhook_delivery(uuid,text,text,integer,text,integer) to service_role;

comment on function public.pay_claim_webhook_deliveries(text,integer,integer) is 'Claims due webhook deliveries with SKIP LOCKED and an expiring worker lease.';
comment on function public.pay_fail_webhook_delivery(uuid,text,text,integer,text,integer) is 'Records webhook failure, schedules exponential retry, or moves the delivery to dead_letter.';
