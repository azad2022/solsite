-- SolMint Pay accounting/event integrity controls.
-- These tables are append-only by design. Production authorization/RLS will be
-- layered on top after the existing SolMint auth-to-Supabase identity mapping
-- is finalized.

create or replace function public.pay_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SOLMINT_PAY_APPEND_ONLY: % cannot be mutated', tg_table_name;
end;
$$;

-- Financial recognition and payment event history must never be rewritten.
drop trigger if exists pay_revenue_ledger_no_update on public.pay_revenue_ledger;
create trigger pay_revenue_ledger_no_update
before update or delete on public.pay_revenue_ledger
for each row execute function public.pay_reject_mutation();

drop trigger if exists pay_payment_events_no_update on public.pay_payment_events;
create trigger pay_payment_events_no_update
before update or delete on public.pay_payment_events
for each row execute function public.pay_reject_mutation();

-- Gas ledger entries are also immutable. A later correction is represented by
-- an explicit reversal/adjustment entry, never by editing history.
drop trigger if exists pay_gas_ledger_no_update on public.pay_gas_ledger;
create trigger pay_gas_ledger_no_update
before update or delete on public.pay_gas_ledger
for each row execute function public.pay_reject_mutation();

comment on function public.pay_reject_mutation() is 'Prevents destructive edits to SolMint Pay financial/event ledgers; corrections require compensating entries.';
