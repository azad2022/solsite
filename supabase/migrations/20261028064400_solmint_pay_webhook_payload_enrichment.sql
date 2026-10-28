-- Enrich the existing merchant webhook envelope with an allowlisted payment snapshot.
-- Keep the trigger contract, delivery routing/signing snapshots, subscription matching,
-- idempotency key, SECURITY DEFINER boundary, and empty search_path unchanged.
-- Atomic values are serialized as text to preserve the exact integer amount.

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
    endpoint_url_snapshot,
    secret_ciphertext_snapshot,
    secret_key_version_snapshot,
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
      'data', jsonb_build_object(
        'paymentId', p.id::text,
        'status', new.to_status,
        'previousStatus', new.from_status,
        'amountAtomic', p.amount_atomic::text,
        'customerTotalAtomic', p.customer_total_atomic::text,
        'merchantNetAtomic', p.merchant_net_atomic::text,
        'asset', p.asset,
        'network', p.network,
        'externalOrderId', p.external_order_id,
        'paymentLinkId', p.payment_link_id::text,
        'paymentLinkSlug', case
          when jsonb_typeof(p.metadata -> 'paymentLinkSlug') = 'string'
            then p.metadata ->> 'paymentLinkSlug'
          else null
        end,
        'reason', new.payload -> 'reason'
      )
    ),
    w.endpoint_url,
    w.secret_ciphertext,
    w.secret_key_version,
    0,
    'pending',
    now()
  from public.pay_webhooks w
  join public.pay_payment_intents p
    on p.merchant_id = w.merchant_id
  where p.id = new.payment_id
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
grant execute on function public.pay_enqueue_webhook_deliveries() to service_role;
