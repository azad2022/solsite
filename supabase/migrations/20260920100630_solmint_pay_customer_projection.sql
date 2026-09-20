-- SolMint Pay customer read projection.
-- Customer identity is the persisted non-empty customer wallet address on Payment Intents.
-- The view is security-invoker so underlying pay_payment_intents RLS remains authoritative.

create or replace view public.pay_customer_projection
with (security_invoker = true)
as
select
  merchant_id,
  customer_wallet_address,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at,
  count(*)::bigint as payment_intent_count,
  count(*) filter (where status = 'completed')::bigint as completed_payment_count
from public.pay_payment_intents
where customer_wallet_address is not null
  and btrim(customer_wallet_address) <> ''
group by merchant_id, customer_wallet_address;

comment on view public.pay_customer_projection is
  'Read-only merchant-scoped customer projection derived from authoritative Pay payment intents. Customer identity is the persisted non-empty customer wallet address.';

revoke all on table public.pay_customer_projection from public, anon, authenticated;
grant select on table public.pay_customer_projection to authenticated, service_role;
