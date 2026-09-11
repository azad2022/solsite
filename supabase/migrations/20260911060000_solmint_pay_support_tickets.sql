create extension if not exists pgcrypto;

create table if not exists public.pay_tickets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  created_by_user_id text not null references public.users(id),
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null,
  constraint pay_tickets_subject_len check (char_length(trim(subject)) between 3 and 160),
  constraint pay_tickets_status_check check (status in ('open','pending_customer','pending_admin','resolved','closed')),
  constraint pay_tickets_priority_check check (priority in ('normal','high','urgent'))
);

create table if not exists public.pay_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.pay_tickets(id) on delete cascade,
  author_user_id text not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint pay_ticket_messages_body_len check (char_length(trim(body)) between 1 and 10000)
);

create index if not exists pay_tickets_merchant_updated_idx on public.pay_tickets(merchant_id, updated_at desc);
create index if not exists pay_tickets_status_updated_idx on public.pay_tickets(status, updated_at desc);
create index if not exists pay_ticket_messages_ticket_created_idx on public.pay_ticket_messages(ticket_id, created_at asc);

create or replace function public.pay_is_site_admin(p_user_id text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select exists (
    select 1 from public.users u
    where u.id = p_user_id and u.is_active = true and u.role = 'admin'
  );
$$;

create or replace function public.pay_create_ticket(
  p_user_id text, p_merchant_id uuid, p_subject text, p_body text, p_priority text default 'normal'
)
returns public.pay_tickets
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_ticket public.pay_tickets; v_subject text := trim(coalesce(p_subject,'')); v_body text := trim(coalesce(p_body,'')); v_priority text := lower(trim(coalesce(p_priority,'normal')));
begin
  if not exists (select 1 from public.pay_merchant_members m where m.merchant_id=p_merchant_id and m.user_id=p_user_id and m.status='active') then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  if char_length(v_subject) < 3 or char_length(v_subject) > 160 then raise exception using errcode='22023', message='INVALID_SUBJECT'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then raise exception using errcode='22023', message='INVALID_MESSAGE'; end if;
  if v_priority not in ('normal','high','urgent') then raise exception using errcode='22023', message='INVALID_PRIORITY'; end if;
  insert into public.pay_tickets (merchant_id,created_by_user_id,subject,status,priority) values (p_merchant_id,p_user_id,v_subject,'open',v_priority) returning * into v_ticket;
  insert into public.pay_ticket_messages(ticket_id,author_user_id,body) values (v_ticket.id,p_user_id,v_body);
  return v_ticket;
end; $$;

create or replace function public.pay_add_ticket_message(p_user_id text,p_ticket_id uuid,p_body text)
returns public.pay_ticket_messages
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_body text := trim(coalesce(p_body,'')); v_ticket public.pay_tickets; v_message public.pay_ticket_messages; v_admin boolean;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then raise exception using errcode='22023', message='INVALID_MESSAGE'; end if;
  select * into v_ticket from public.pay_tickets where id=p_ticket_id for update;
  if v_ticket.id is null then raise exception using errcode='P0002', message='TICKET_NOT_FOUND'; end if;
  v_admin := public.pay_is_site_admin(p_user_id);
  if not v_admin and not exists (select 1 from public.pay_merchant_members m where m.merchant_id=v_ticket.merchant_id and m.user_id=p_user_id and m.status='active') then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  insert into public.pay_ticket_messages(ticket_id,author_user_id,body) values (p_ticket_id,p_user_id,v_body) returning * into v_message;
  update public.pay_tickets set status=case when v_admin then 'pending_customer' else 'pending_admin' end, updated_at=now(), closed_at=case when status in ('resolved','closed') then null else closed_at end where id=p_ticket_id;
  return v_message;
end; $$;

create or replace function public.pay_update_ticket_status(p_user_id text,p_ticket_id uuid,p_status text)
returns public.pay_tickets
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_ticket public.pay_tickets; v_status text := lower(trim(coalesce(p_status,'')));
begin
  if not public.pay_is_site_admin(p_user_id) then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  if v_status not in ('open','pending_customer','pending_admin','resolved','closed') then raise exception using errcode='22023', message='INVALID_STATUS'; end if;
  update public.pay_tickets set status=v_status, updated_at=now(), closed_at=case when v_status in ('resolved','closed') then coalesce(closed_at,now()) else null end where id=p_ticket_id returning * into v_ticket;
  if v_ticket.id is null then raise exception using errcode='P0002', message='TICKET_NOT_FOUND'; end if;
  return v_ticket;
end; $$;

alter table public.pay_tickets enable row level security;
alter table public.pay_ticket_messages enable row level security;

revoke all on table public.pay_tickets from anon, authenticated;
revoke all on table public.pay_ticket_messages from anon, authenticated;
revoke all on function public.pay_is_site_admin(text) from public, anon, authenticated;
revoke all on function public.pay_create_ticket(text,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.pay_add_ticket_message(text,uuid,text) from public, anon, authenticated;
revoke all on function public.pay_update_ticket_status(text,uuid,text) from public, anon, authenticated;
grant execute on function public.pay_is_site_admin(text) to service_role;
grant execute on function public.pay_create_ticket(text,uuid,text,text,text) to service_role;
grant execute on function public.pay_add_ticket_message(text,uuid,text) to service_role;
grant execute on function public.pay_update_ticket_status(text,uuid,text) to service_role;

drop policy if exists pay_tickets_select on public.pay_tickets;
create policy pay_tickets_select on public.pay_tickets for select to authenticated using (public.pay_is_site_admin(public.pay_request_user_id()) or public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_ticket_messages_select on public.pay_ticket_messages;
create policy pay_ticket_messages_select on public.pay_ticket_messages for select to authenticated using (public.pay_is_site_admin(public.pay_request_user_id()) or exists (select 1 from public.pay_tickets t where t.id=ticket_id and public.pay_has_merchant_access(t.merchant_id)));
