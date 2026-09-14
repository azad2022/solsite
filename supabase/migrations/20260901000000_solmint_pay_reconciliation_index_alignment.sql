-- Align the reconciliation index with the retryable payment states used by the worker.
-- Ambiguous payments are deliberately retryable after a fresh verification pass;
-- they must therefore be included in the bounded worker scan index.

drop index if exists public.pay_payment_intents_reconciliation_idx;

create index if not exists pay_payment_intents_reconciliation_idx
  on public.pay_payment_intents (status, expires_at, created_at)
  where status in ('pending','detected','verifying','underpaid','ambiguous');

comment on index public.pay_payment_intents_reconciliation_idx is
  'Bounded reconciliation scan index for open and retryable Pay payment states.';
