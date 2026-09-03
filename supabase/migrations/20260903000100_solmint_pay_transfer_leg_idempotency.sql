-- Transfer-leg idempotency hardening.
-- Reconciliation may retry the same authoritative transaction. Transfer legs are
-- audit data and must not multiply across retries or concurrent workers.

create unique index if not exists pay_payment_transfers_tx_role_instruction_uidx
  on public.pay_payment_transfers (
    payment_transaction_id,
    transfer_role,
    coalesce(instruction_index, -1)
  );

create or replace function public.pay_skip_duplicate_payment_transfer()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
      from public.pay_payment_transfers
     where payment_transaction_id = new.payment_transaction_id
       and transfer_role = new.transfer_role
       and coalesce(instruction_index, -1) = coalesce(new.instruction_index, -1)
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists pay_payment_transfers_idempotency on public.pay_payment_transfers;
create trigger pay_payment_transfers_idempotency
before insert on public.pay_payment_transfers
for each row execute function public.pay_skip_duplicate_payment_transfer();

comment on index public.pay_payment_transfers_tx_role_instruction_uidx is
  'Prevents duplicate transfer-leg audit records when the same authoritative transaction is reconciled repeatedly.';
