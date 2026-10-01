-- SolMint Pay: a closed support ticket cannot be mutated by adding a message.
-- Reopening remains an explicit admin status operation.

create or replace function public.pay_add_ticket_message(
  p_user_id text,
  p_ticket_id uuid,
  p_body text
)
returns public.pay_ticket_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_body text := trim(coalesce(p_body,''));
  v_ticket public.pay_tickets;
  v_message public.pay_ticket_messages;
  v_admin boolean;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception using errcode='22023', message='INVALID_MESSAGE';
  end if;

  select * into v_ticket
  from public.pay_tickets
  where id=p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception using errcode='P0002', message='TICKET_NOT_FOUND';
  end if;

  if v_ticket.status = 'closed' then
    raise exception using errcode='P0001', message='TICKET_CLOSED';
  end if;

  v_admin := public.pay_is_site_admin(p_user_id);

  if not v_admin and not exists (
    select 1
    from public.pay_merchant_members m
    where m.merchant_id=v_ticket.merchant_id
      and m.user_id=p_user_id
      and m.status='active'
  ) then
    raise exception using errcode='42501', message='FORBIDDEN';
  end if;

  insert into public.pay_ticket_messages(ticket_id,author_user_id,body)
  values (p_ticket_id,p_user_id,v_body)
  returning * into v_message;

  update public.pay_tickets
  set
    status=case when v_admin then 'pending_customer' else 'pending_admin' end,
    updated_at=now(),
    closed_at=case when status in ('resolved','closed') then null else closed_at end
  where id=p_ticket_id;

  return v_message;
end;
$$;

revoke all on function public.pay_add_ticket_message(text,uuid,text) from public, anon, authenticated;
grant execute on function public.pay_add_ticket_message(text,uuid,text) to service_role;
