-- Only externally documented event types may leave the system through merchant webhooks.
create or replace function public.pay_enqueue_webhook_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type not in (
    'payment.created',
    'payment.detected',
    'payment.confirmed',
    'payment.completed',
    'payment.expired',
    'payment.failed',
    'payment.refunded',
    'invoice.paid'
  ) then
    return new;
  end if;

  insert into public.pay_webhook_deliveries(
    webhook_id, event_id, event_type, payload, attempt_count, status, next_attempt_at
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
    and (cardinality(w.subscribed_events) = 0 or new.event_type = any(w.subscribed_events))
  on conflict (webhook_id, event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.pay_enqueue_webhook_deliveries() from public, anon, authenticated;
grant execute on function public.pay_enqueue_webhook_deliveries() to service_role;
