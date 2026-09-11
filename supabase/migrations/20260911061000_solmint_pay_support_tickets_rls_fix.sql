create or replace function public.pay_is_site_admin()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select public.pay_is_site_admin(public.pay_request_user_id());
$$;

revoke all on function public.pay_is_site_admin() from public, anon;
grant execute on function public.pay_is_site_admin() to authenticated;

drop policy if exists pay_tickets_select on public.pay_tickets;
create policy pay_tickets_select on public.pay_tickets for select to authenticated using (
  public.pay_is_site_admin() or public.pay_has_merchant_access(merchant_id)
);

drop policy if exists pay_ticket_messages_select on public.pay_ticket_messages;
create policy pay_ticket_messages_select on public.pay_ticket_messages for select to authenticated using (
  public.pay_is_site_admin() or exists (
    select 1 from public.pay_tickets t where t.id=ticket_id and public.pay_has_merchant_access(t.merchant_id)
  )
);
