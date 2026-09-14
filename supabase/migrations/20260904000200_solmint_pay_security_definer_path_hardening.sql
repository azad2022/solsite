-- Security-definer hardening for sensitive merchant/wallet RPCs.
-- All object references in these functions are schema-qualified, so the
-- SECURITY DEFINER search_path can be empty without changing behavior.

alter function public.pay_create_merchant(text,text,text)
  set search_path = '';

alter function public.pay_issue_wallet_challenge(uuid,text,text,text,text,timestamptz,timestamptz)
  set search_path = '';

alter function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz)
  set search_path = '';

revoke all on function public.pay_create_merchant(text,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_merchant(text,text,text) to service_role;

revoke all on function public.pay_issue_wallet_challenge(uuid,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pay_issue_wallet_challenge(uuid,text,text,text,text,timestamptz,timestamptz) to service_role;

revoke all on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.pay_consume_wallet_challenge(uuid,text,text,text,timestamptz) to service_role;
