-- SolMint Pay report read contract.
-- Security model: SECURITY INVOKER preserves the caller's existing Pay RLS boundary.
-- Financial amounts are returned as decimal strings; no floating-point conversion is performed.

create or replace function public.pay_read_report(
  p_merchant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  with payments as (
    select
      id,
      status,
      amount_atomic,
      fee_atomic,
      customer_wallet_address,
      created_at
    from public.pay_payment_intents
    where merchant_id = p_merchant_id
      and created_at >= p_from
      and created_at < p_to
  ),
  status_counts as (
    select coalesce(jsonb_object_agg(status, count), '{}'::jsonb) as value
    from (
      select status, count(*)::bigint as count
      from payments
      group by status
    ) grouped
  ),
  summary as (
    select
      count(*)::bigint as payment_intent_count,
      count(*) filter (where status = 'completed')::bigint as completed_payment_count,
      count(*) filter (where status in ('created','pending','detected','verifying','confirmed'))::bigint as pending_payment_count,
      count(*) filter (where status in ('expired','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','ambiguous','failed','refunded'))::bigint as exception_payment_count,
      count(distinct customer_wallet_address) filter (where customer_wallet_address is not null and btrim(customer_wallet_address) <> '')::bigint as customer_count,
      coalesce(sum(amount_atomic) filter (where status = 'completed'), 0)::text as completed_payment_amount_atomic,
      coalesce(sum(fee_atomic) filter (where status = 'completed'), 0)::text as completed_gateway_fee_snapshot_atomic
    from payments
  ),
  revenue as (
    select
      coalesce(sum(r.gross_gateway_fee_atomic) filter (where r.status <> 'voided'), 0)::text as gross_gateway_fee_atomic,
      coalesce(sum(r.referral_commission_atomic) filter (where r.status <> 'voided'), 0)::text as referral_commission_atomic,
      coalesce(sum(r.net_gateway_revenue_atomic) filter (where r.status <> 'voided'), 0)::text as net_gateway_revenue_atomic
    from public.pay_revenue_ledger r
    join payments p on p.id = r.payment_id
  ),
  daily as (
    select jsonb_agg(
      jsonb_build_object(
        'date', day,
        'paymentIntentCount', payment_intent_count,
        'completedPaymentCount', completed_payment_count,
        'completedPaymentAmountAtomic', completed_payment_amount_atomic
      )
      order by day
    ) as value
    from (
      select
        (p.created_at at time zone 'UTC')::date::text as day,
        count(*)::bigint as payment_intent_count,
        count(*) filter (where p.status = 'completed')::bigint as completed_payment_count,
        coalesce(sum(p.amount_atomic) filter (where p.status = 'completed'), 0)::text as completed_payment_amount_atomic
      from payments p
      group by (p.created_at at time zone 'UTC')::date
    ) grouped
  )
  select jsonb_build_object(
    'periodStart', p_from,
    'periodEnd', p_to,
    'timezone', 'UTC',
    'paymentIntentCount', s.payment_intent_count,
    'completedPaymentCount', s.completed_payment_count,
    'pendingPaymentCount', s.pending_payment_count,
    'exceptionPaymentCount', s.exception_payment_count,
    'customerCount', s.customer_count,
    'completedPaymentAmountAtomic', s.completed_payment_amount_atomic,
    'completedGatewayFeeSnapshotAtomic', s.completed_gateway_fee_snapshot_atomic,
    'grossGatewayFeeAtomic', r.gross_gateway_fee_atomic,
    'referralCommissionAtomic', r.referral_commission_atomic,
    'netGatewayRevenueAtomic', r.net_gateway_revenue_atomic,
    'completedRateBps',
      case
        when s.payment_intent_count = 0 then 0
        else (s.completed_payment_count * 10000 / s.payment_intent_count)::bigint
      end,
    'statusCounts', sc.value,
    'daily', coalesce(d.value, '[]'::jsonb)
  )
  from summary s
  cross join status_counts sc
  cross join revenue r
  cross join daily d;
$$;

comment on function public.pay_read_report(uuid, timestamptz, timestamptz) is
  'Read-only merchant-scoped Pay report summary. Payment activity follows pay_payment_intents; recognized revenue follows pay_revenue_ledger rows visible to the invoking role. Atomic amounts are returned as decimal strings.';

revoke execute on function public.pay_read_report(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.pay_read_report(uuid, timestamptz, timestamptz) to authenticated, service_role;
