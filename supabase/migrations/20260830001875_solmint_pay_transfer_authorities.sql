-- SolMint Pay reconciliation schema prerequisite.
-- Must run before 20260830001900 because the atomic reconciliation RPC
-- persists instruction authority metadata for each transfer leg.

alter table public.pay_payment_transfers
  add column if not exists source_authority text,
  add column if not exists destination_authority text;

comment on column public.pay_payment_transfers.source_authority is 'Instruction authority/delegate that authorized the observed transfer.';
comment on column public.pay_payment_transfers.destination_authority is 'Owner wallet authority of the destination token account; null for native SOL transfers.';
