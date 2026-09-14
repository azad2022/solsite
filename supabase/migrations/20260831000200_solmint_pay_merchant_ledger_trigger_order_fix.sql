-- The merchant principal ledger depends on the verified merchant settlement leg.
-- The previous trigger fired on payment_transaction insertion, before transfer
-- legs were inserted by the atomic reconciliation function. Move the trigger to
-- transfer insertion so the parent transaction and settlement leg both exist.

create or replace function public.pay_insert_merchant_principal_entry()
returns trigger
language plpgsql
as $$
declare
  v_payment public.pay_payment_intents%rowtype;
  v_transaction public.pay_payment_transactions%rowtype;
begin
  if new.transfer_role <> 'merchant_settlement' then
    return new;
  end if;

  select * into v_transaction
    from public.pay_payment_transactions
   where id = new.payment_transaction_id;

  if not found or v_transaction.is_authoritative is distinct from true then
    return new;
  end if;

  select * into v_payment
    from public.pay_payment_intents
   where id = v_transaction.payment_id;

  if not found then
    raise exception 'SOLMINT_PAY_LEDGER_INVARIANT: payment transaction references no payment';
  end if;

  insert into public.pay_merchant_ledger(
    merchant_id, payment_id, payment_transaction_id, asset, entry_type,
    direction, amount_atomic, blockchain_signature
  ) values (
    v_payment.merchant_id, v_payment.id, v_transaction.id, v_payment.asset,
    'payment_principal', 'credit', new.amount_atomic, v_transaction.signature
  )
  on conflict (payment_id, entry_type, direction) do nothing;

  return new;
end;
$$;

-- Remove the ordering-sensitive trigger from the transaction row.
drop trigger if exists pay_payment_transaction_merchant_ledger on public.pay_payment_transactions;

-- The transfer leg is inserted after the authoritative transaction inside the
-- atomic reconciliation function, so this trigger observes the complete pair.
drop trigger if exists pay_payment_transfer_merchant_ledger on public.pay_payment_transfers;
create trigger pay_payment_transfer_merchant_ledger
after insert on public.pay_payment_transfers
for each row execute function public.pay_insert_merchant_principal_entry();

comment on function public.pay_insert_merchant_principal_entry() is 'Creates the append-only merchant principal mirror only after an authoritative merchant settlement leg exists.';
