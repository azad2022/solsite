-- SolMint Pay: expose read-only Ticket tables to authenticated PostgREST sessions.
-- RLS remains the authorization boundary; INSERT/UPDATE/DELETE remain server-mediated.

grant select on table public.pay_tickets, public.pay_ticket_messages to authenticated;
