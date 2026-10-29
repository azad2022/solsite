-- Keep merchant-session Payment Link mutations unavailable to the database service role.
-- Supabase environments may assign EXECUTE to service_role through default privileges;
-- revoking PUBLIC and anon alone does not remove that explicit role grant.
REVOKE EXECUTE ON FUNCTION public.pay_create_payment_link(
  uuid,text,text,text,numeric,text,text,text,timestamptz,text,text,text,integer,jsonb
) FROM service_role;

REVOKE EXECUTE ON FUNCTION public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text,text,integer,jsonb
) FROM service_role;
