-- Webhook delivery idempotency is scoped to each webhook subscription.
-- A single immutable payment event must be deliverable to multiple merchant webhooks,
-- while duplicate enqueue attempts for the same webhook/event pair remain idempotent.

alter table public.pay_webhook_deliveries
  drop constraint if exists pay_webhook_deliveries_event_id_key;

alter table public.pay_webhook_deliveries
  add constraint pay_webhook_deliveries_webhook_event_key
  unique (webhook_id, event_id);

comment on constraint pay_webhook_deliveries_webhook_event_key on public.pay_webhook_deliveries
  is 'Prevents duplicate delivery rows per webhook subscription and immutable event while allowing the same event to reach multiple webhooks.';
