-- Report revenue ledger read boundary.
-- Reports read recognized revenue only through the authenticated merchant boundary.
-- No mutation privileges are granted.

alter table public.pay_revenue_ledger enable row level security;

revoke all on table public.pay_revenue_ledger from anon;
grant select on table public.pay_revenue_ledger to authenticated, service_role;

drop policy if exists "pay_revenue_ledger_authenticated_read" on public.pay_revenue_ledger;

create policy "pay_revenue_ledger_authenticated_read"
on public.pay_revenue_ledger
for select
to authenticated
using (
  exists (
    select 1
    from public.pay_payment_intents p
    where p.id = pay_revenue_ledger.payment_id
      and public.pay_has_merchant_access(
        p.merchant_id,
        array['owner','admin','finance','developer','viewer']::text[]
      )
  )
);

comment on policy "pay_revenue_ledger_authenticated_read" on public.pay_revenue_ledger is
  'Authenticated Pay members may read revenue ledger rows only when the referenced payment belongs to a merchant they can access.';
