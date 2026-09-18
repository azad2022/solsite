-- Harden remaining Pay SECURITY DEFINER routines against search_path injection.
-- All affected function bodies use schema-qualified public.* references.

alter function public.pay_add_ticket_message(text,uuid,text)
  set search_path = '';

alter function public.pay_create_ticket(text,uuid,text,text,text)
  set search_path = '';

alter function public.pay_is_site_admin()
  set search_path = '';

alter function public.pay_is_site_admin(text)
  set search_path = '';

alter function public.pay_transition_payment(uuid,text,text,text)
  set search_path = '';

alter function public.pay_update_ticket_status(text,uuid,text)
  set search_path = '';

revoke all on function public.pay_add_ticket_message(text,uuid,text) from public, anon, authenticated;
revoke all on function public.pay_create_ticket(text,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.pay_is_site_admin() from public, anon;
revoke all on function public.pay_is_site_admin(text) from public, anon, authenticated;
revoke all on function public.pay_transition_payment(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.pay_update_ticket_status(text,uuid,text) from public, anon, authenticated;

grant execute on function public.pay_add_ticket_message(text,uuid,text) to service_role;
grant execute on function public.pay_create_ticket(text,uuid,text,text,text) to service_role;
grant execute on function public.pay_is_site_admin() to authenticated;
grant execute on function public.pay_is_site_admin(text) to service_role;
grant execute on function public.pay_transition_payment(uuid,text,text,text) to service_role;
grant execute on function public.pay_update_ticket_status(text,uuid,text) to service_role;
