-- Database invariants that mirror the verifier's non-negotiable assumptions.
-- This migration is intentionally NOT applied to production yet.

alter table public.pay_payment_intents
  add constraint pay_payment_destinations_distinct_check
  check (recipient <> fee_recipient);

alter table public.pay_payment_intents
  add constraint pay_payment_reference_length_check
  check (char_length(reference) between 32 and 44);

alter table public.pay_payment_transactions
  add constraint pay_payment_tx_reference_boolean_check
  check (reference_matched in (true,false));

comment on constraint pay_payment_destinations_distinct_check on public.pay_payment_intents is 'Merchant settlement and gateway fee destinations must never be identical.';
comment on constraint pay_payment_reference_length_check on public.pay_payment_intents is 'SolMint Pay references are encoded 32-byte public-key values represented as Base58.';
