-- Preserve empty search_path for all ticket SECURITY DEFINER mutation RPCs.
-- This hardens the production functions without replacing their bodies or grants.
ALTER FUNCTION public.pay_create_ticket(text, uuid, text, text, text) SET search_path TO '';
ALTER FUNCTION public.pay_add_ticket_message(text, uuid, text) SET search_path TO '';
ALTER FUNCTION public.pay_update_ticket_status(text, uuid, text) SET search_path TO '';
ALTER FUNCTION public.pay_soft_delete_ticket(text, uuid) SET search_path TO '';
ALTER FUNCTION public.pay_block_ticket_user(text, uuid, text) SET search_path TO '';
ALTER FUNCTION public.pay_unblock_ticket_user(text, uuid) SET search_path TO '';
ALTER FUNCTION public.pay_unblock_ticket_user_by_id(text, text) SET search_path TO '';
