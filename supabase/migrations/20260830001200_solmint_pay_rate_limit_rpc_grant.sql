-- Complete the server-only rate-limit RPC privilege boundary.
-- Earlier hardening revoked EXECUTE from PUBLIC, anon, and authenticated roles;
-- this migration explicitly grants execution only to the Supabase service role.

grant execute on function public.pay_check_and_increment_rate_limit(text, text, integer, integer, timestamptz) to service_role;

comment on function public.pay_check_and_increment_rate_limit(text, text, integer, integer, timestamptz) is 'Atomic server-only rate-limit increment. Only the Supabase service_role may execute it.';
