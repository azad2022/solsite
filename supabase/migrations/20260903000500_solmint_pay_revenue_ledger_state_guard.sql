-- Prevent financial recognition before the payment state has reached a
-- legally confirmable verification state. The reconciliation function performs
-- this state check after writing the revenue row; this database guard makes the
-- invariant atomic even if that ordering regresses in application code.

create or replace function public.pay_guard_initial_revenue_recognition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.status <> 'eligible' then
    return new;
  end if;

  select p.status
    into v_status
    from public.pay_payment_intents p
   where p.id = new.payment_id
   for update;

  if v_status is null then
    raise exception 'SOLMINT_PAY_REVENUE_INVARIANT: revenue entry references no payment intent';
  end if;

  if v_status not in ('pending','detected','verifying','underpaid') then
    raise exception 'SOLMINT_PAY_REVENUE_INVARIANT: payment is not in a confirmable state';
  end if;

  return new;
end;
$$;

revoke all on function public.pay_guard_initial_revenue_recognition() from public, anon, authenticated;
grant execute on function public.pay_guard_initial_revenue_recognition() to service_role;

drop trigger if exists pay_revenue_ledger_state_guard on public.pay_revenue_ledger;
create trigger pay_revenue_ledger_state_guard
before insert on public.pay_revenue_ledger
for each row execute function public.pay_guard_initial_revenue_recognition();

comment on function public.pay_guard_initial_revenue_recognition() is 'Prevents initial gateway revenue recognition unless the payment intent is in a confirmable verification state.';
