-- Freeze webhook delivery routing and signing material at enqueue time.
-- A queued payment event must not change destination or HMAC secret merely
-- because the merchant edits or rotates its webhook subscription later.

alter table public.pay_webhook_deliveries
  add column if not exists endpoint_url_snapshot text,
  add column if not exists secret_ciphertext_snapshot text,
  add column if not exists secret_key_version_snapshot text;

update public.pay_webhook_deliveries d
   set endpoint_url_snapshot = w.endpoint_url,
       secret_ciphertext_snapshot = w.secret_ciphertext,
       secret_key_version_snapshot = w.secret_key_version
  from public.pay_webhooks w
 where w.id = d.webhook_id
   and (
     d.endpoint_url_snapshot is null
     or (d.secret_ciphertext_snapshot is null and w.secret_ciphertext is not null)
     or (d.secret_key_version_snapshot is null and w.secret_key_version is not null)
   );

alter table public.pay_webhook_deliveries
  alter column endpoint_url_snapshot set not null;

create or replace function public.pay_enqueue_webhook_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pay_webhook_deliveries(
    webhook_id, event_id, event_type, payload,
    endpoint_url_snapshot, secret_ciphertext_snapshot, secret_key_version_snapshot,
    attempt_count, status, next_attempt_at
  )
  select
    w.id, new.id::text, new.event_type,
    jsonb_build_object(
      'id', new.id::text,
      'type', new.event_type,
      'createdAt', new.created_at,
      'data', new.payload
    ),
    w.endpoint_url, w.secret_ciphertext, w.secret_key_version,
    0, 'pending', now()
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
       set status = 'delivering', locked_at = now(), locked_by = p_worker_id
      from candidates c
     where d.id = c.id
    returning d.*
  )
  select c.id, c.webhook_id, c.event_id, c.event_type, c.payload,
         c.endpoint_url_snapshot, c.secret_ciphertext_snapshot,
         c.secret_key_version_snapshot, c.attempt_count
    from claimed c;
end;
$$;

revoke all on function public.pay_enqueue_webhook_deliveries() from public, anon, authenticated;
revoke all on function public.pay_claim_webhook_deliveries(text,integer,integer) from public, anon, authenticated;
grant execute on function public.pay_claim_webhook_deliveries(text,integer,integer) to service_role;

comment on column public.pay_webhook_deliveries.endpoint_url_snapshot is 'Immutable webhook destination captured when the event is enqueued.';
comment on column public.pay_webhook_deliveries.secret_ciphertext_snapshot is 'Encrypted webhook HMAC secret captured when the event is enqueued; deployment master key remains outside the database.';
comment on column public.pay_webhook_deliveries.secret_key_version_snapshot is 'Webhook signing-secret version captured when the event is enqueued.';
