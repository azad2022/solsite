-- Keep sensitive Pay mutation routines out of the PostgREST execution surface.
-- The live project was hardened with the same statements on 2026-09-06;
-- this migration records that state so the repository migration chain does not drift.

alter function public.pay_reject_mutation() set search_path = public;
alter function public.pay_reject_merchant_ledger_mutation() set search_path = public;
alter function public.pay_insert_merchant_principal_entry() set search_path = public;
alter function public.pay_skip_duplicate_payment_transfer() set search_path = public;

revoke all on function public.pay_reject_mutation() from public, anon, authenticated;
revoke all on function public.pay_reject_merchant_ledger_mutation() from public, anon, authenticated;
revoke all on function public.pay_insert_merchant_principal_entry() from public, anon, authenticated;
revoke all on function public.pay_skip_duplicate_payment_transfer() from public, anon, authenticated;

grant execute on function public.pay_reject_mutation() to service_role;
grant execute on function public.pay_reject_merchant_ledger_mutation() to service_role;
grant execute on function public.pay_insert_merchant_principal_entry() to service_role;
grant execute on function public.pay_skip_duplicate_payment_transfer() to service_role;
