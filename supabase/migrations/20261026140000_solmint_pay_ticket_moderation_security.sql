-- SolMint Pay ticket moderation and defense-in-depth.
-- Deletion hides a ticket from normal reads while retaining its conversation for audit.
-- User blocks apply to Pay support only; they do not disable the user's whole SolMint account.

alter table public.pay_tickets
  add column if not exists deleted_at timestamptz null;

alter table public.pay_tickets
  add column if not exists deleted_by_user_id text null references public.users(id);

create table if not exists public.pay_ticket_user_blocks (
  user_id text primary key references public.users(id) on delete cascade,
  blocked_by_user_id text not null references public.users(id),
  reason text not null,
  blocked_at timestamptz not null default now(),
  constraint pay_ticket_user_blocks_reason_len
    check (char_length(trim(reason)) between 3 and 500)
);

create index if not exists pay_tickets_deleted_updated_idx
  on public.pay_tickets(deleted_at, updated_at desc);

alter table public.pay_ticket_user_blocks enable row level security;
revoke all on table public.pay_ticket_user_blocks from public, anon, authenticated;
grant all on table public.pay_ticket_user_blocks to service_role;

-- Hide soft-deleted tickets and their messages from all normal authenticated reads.
drop policy if exists pay_tickets_select on public.pay_tickets;
create policy pay_tickets_select on public.pay_tickets
for select to authenticated
using (
  deleted_at is null
  and (public.pay_is_site_admin() or public.pay_has_merchant_access(merchant_id))
);

drop policy if exists pay_ticket_messages_select on public.pay_ticket_messages;
create policy pay_ticket_messages_select on public.pay_ticket_messages
for select to authenticated
using (
  exists (
    select 1
    from public.pay_tickets t
    where t.id = ticket_id
      and t.deleted_at is null
      and (public.pay_is_site_admin() or public.pay_has_merchant_access(t.merchant_id))
  )
);

create or replace function public.pay_create_ticket(
  p_user_id text,
  p_merchant_id uuid,
  p_subject text,
  p_body text,
  p_priority text default 'normal'
)
returns public.pay_tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.pay_tickets;
  v_subject text := trim(coalesce(p_subject, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
begin
  if exists (select 1 from public.pay_ticket_user_blocks b where b.user_id = p_user_id) then
    raise exception using errcode = '42501', message = 'TICKET_USER_BLOCKED';
  end if;

  if not exists (
    select 1 from public.pay_merchant_members m
    where m.merchant_id = p_merchant_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if char_length(v_subject) < 3 or char_length(v_subject) > 160 then
    raise exception using errcode = '22023', message = 'INVALID_SUBJECT';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE';
  end if;
  if v_priority not in ('normal', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'INVALID_PRIORITY';
  end if;

  insert into public.pay_tickets (merchant_id, created_by_user_id, subject, status, priority)
  values (p_merchant_id, p_user_id, v_subject, 'open', v_priority)
  returning * into v_ticket;

  insert into public.pay_ticket_messages (ticket_id, author_user_id, body)
  values (v_ticket.id, p_user_id, v_body);

  return v_ticket;
end;
$$;

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
  v_body text := trim(coalesce(p_body, ''));
  v_ticket public.pay_tickets;
  v_message public.pay_ticket_messages;
  v_admin boolean;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE';
  end if;

  select * into v_ticket
  from public.pay_tickets
  where id = p_ticket_id and deleted_at is null
  for update;

  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.status = 'closed' then
    raise exception using errcode = 'P0001', message = 'TICKET_CLOSED';
  end if;

  v_admin := public.pay_is_site_admin(p_user_id);

  if not v_admin and exists (
    select 1 from public.pay_ticket_user_blocks b where b.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'TICKET_USER_BLOCKED';
  end if;

  if not v_admin and not exists (
    select 1 from public.pay_merchant_members m
    where m.merchant_id = v_ticket.merchant_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.pay_ticket_messages (ticket_id, author_user_id, body)
  values (p_ticket_id, p_user_id, v_body)
  returning * into v_message;

  update public.pay_tickets
  set
    status = case when v_admin then 'pending_customer' else 'pending_admin' end,
    updated_at = now(),
    closed_at = case when status in ('resolved', 'closed') then null else closed_at end
  where id = p_ticket_id;

  return v_message;
end;
$$;

create or replace function public.pay_update_ticket_status(
  p_user_id text,
  p_ticket_id uuid,
  p_status text
)
returns public.pay_tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.pay_tickets;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.pay_is_site_admin(p_user_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if v_status not in ('open', 'pending_customer', 'pending_admin', 'resolved', 'closed') then
    raise exception using errcode = '22023', message = 'INVALID_STATUS';
  end if;

  update public.pay_tickets
  set
    status = v_status,
    updated_at = now(),
    closed_at = case when v_status in ('resolved', 'closed') then coalesce(closed_at, now()) else null end
  where id = p_ticket_id and deleted_at is null
  returning * into v_ticket;

  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'TICKET_NOT_FOUND';
  end if;

  return v_ticket;
end;
$$;

create or replace function public.pay_soft_delete_ticket(
  p_admin_user_id text,
  p_ticket_id uuid
)
returns public.pay_tickets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.pay_tickets;
begin
  if not public.pay_is_site_admin(p_admin_user_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.pay_tickets
  set
    deleted_at = now(),
    deleted_by_user_id = p_admin_user_id,
    status = 'closed',
    closed_at = coalesce(closed_at, now()),
    updated_at = now()
  where id = p_ticket_id and deleted_at is null
  returning * into v_ticket;

  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'TICKET_NOT_FOUND';
  end if;

  insert into public.pay_audit_logs (
    merchant_id, actor_user_id, event_type, entity_type, entity_id, metadata
  )
  values (
    v_ticket.merchant_id, p_admin_user_id, 'ticket.deleted', 'pay_ticket',
    v_ticket.id::text, jsonb_build_object('deletion_mode', 'soft')
  );

  return v_ticket;
end;
$$;

create or replace function public.pay_block_ticket_user(
  p_admin_user_id text,
  p_ticket_id uuid,
  p_reason text
)
returns public.pay_ticket_user_blocks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.pay_tickets;
  v_block public.pay_ticket_user_blocks;
  v_reason text := trim(coalesce(p_reason, ''));
  v_target_role text;
begin
  if not public.pay_is_site_admin(p_admin_user_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_BLOCK_REASON';
  end if;

  select * into v_ticket
  from public.pay_tickets
  where id = p_ticket_id and deleted_at is null
  for update;

  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'TICKET_NOT_FOUND';
  end if;

  select u.role into v_target_role
  from public.users u
  where u.id = v_ticket.created_by_user_id;

  if v_ticket.created_by_user_id = p_admin_user_id or v_target_role = 'admin' then
    raise exception using errcode = '42501', message = 'ADMIN_USER_CANNOT_BE_BLOCKED';
  end if;

  insert into public.pay_ticket_user_blocks (user_id, blocked_by_user_id, reason, blocked_at)
  values (v_ticket.created_by_user_id, p_admin_user_id, v_reason, now())
  on conflict (user_id) do update
    set blocked_by_user_id = excluded.blocked_by_user_id,
        reason = excluded.reason,
        blocked_at = excluded.blocked_at
  returning * into v_block;

  insert into public.pay_audit_logs (
    merchant_id, actor_user_id, event_type, entity_type, entity_id, metadata
  )
  values (
    v_ticket.merchant_id, p_admin_user_id, 'ticket.user_blocked',
    'pay_ticket_user', v_ticket.created_by_user_id,
    jsonb_build_object('ticket_id', v_ticket.id::text, 'reason', v_reason)
  );

  return v_block;
end;
$$;

create or replace function public.pay_unblock_ticket_user(
  p_admin_user_id text,
  p_ticket_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.pay_tickets;
  v_target_role text;
  v_deleted_count integer;
begin
  if not public.pay_is_site_admin(p_admin_user_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select * into v_ticket
  from public.pay_tickets
  where id = p_ticket_id and deleted_at is null
  for update;

  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'TICKET_NOT_FOUND';
  end if;

  select u.role into v_target_role
  from public.users u
  where u.id = v_ticket.created_by_user_id;

  if v_ticket.created_by_user_id = p_admin_user_id or v_target_role = 'admin' then
    raise exception using errcode = '42501', message = 'ADMIN_USER_CANNOT_BE_UNBLOCKED';
  end if;

  delete from public.pay_ticket_user_blocks
  where user_id = v_ticket.created_by_user_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count > 0 then
    insert into public.pay_audit_logs (
      merchant_id, actor_user_id, event_type, entity_type, entity_id, metadata
    )
    values (
      v_ticket.merchant_id, p_admin_user_id, 'ticket.user_unblocked',
      'pay_ticket_user', v_ticket.created_by_user_id,
      jsonb_build_object('ticket_id', v_ticket.id::text)
    );
  end if;

  return v_deleted_count > 0;
end;
$$;

create or replace function public.pay_unblock_ticket_user_by_id(
  p_admin_user_id text,
  p_target_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target_role text;
  v_deleted_count integer;
begin
  if not public.pay_is_site_admin(p_admin_user_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_target_user_id is null or char_length(p_target_user_id) < 1 or char_length(p_target_user_id) > 256 then
    raise exception using errcode = '22023', message = 'INVALID_USER_ID';
  end if;

  select u.role into v_target_role
  from public.users u
  where u.id = p_target_user_id;

  if v_target_role is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;
  if p_target_user_id = p_admin_user_id or v_target_role = 'admin' then
    raise exception using errcode = '42501', message = 'ADMIN_USER_CANNOT_BE_UNBLOCKED';
  end if;

  delete from public.pay_ticket_user_blocks
  where user_id = p_target_user_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count > 0 then
    insert into public.pay_audit_logs (
      merchant_id, actor_user_id, event_type, entity_type, entity_id, metadata
    )
    values (
      null, p_admin_user_id, 'ticket.user_unblocked',
      'pay_ticket_user', p_target_user_id,
      jsonb_build_object('source', 'blocked_users_list')
    );
  end if;

  return v_deleted_count > 0;
end;
$$;

revoke all on function public.pay_create_ticket(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.pay_add_ticket_message(text, uuid, text) from public, anon, authenticated;
revoke all on function public.pay_update_ticket_status(text, uuid, text) from public, anon, authenticated;
revoke all on function public.pay_soft_delete_ticket(text, uuid) from public, anon, authenticated;
revoke all on function public.pay_block_ticket_user(text, uuid, text) from public, anon, authenticated;
revoke all on function public.pay_unblock_ticket_user(text, uuid) from public, anon, authenticated;
revoke all on function public.pay_unblock_ticket_user_by_id(text, text) from public, anon, authenticated;

grant execute on function public.pay_create_ticket(text, uuid, text, text, text) to service_role;
grant execute on function public.pay_add_ticket_message(text, uuid, text) to service_role;
grant execute on function public.pay_update_ticket_status(text, uuid, text) to service_role;
grant execute on function public.pay_soft_delete_ticket(text, uuid) to service_role;
grant execute on function public.pay_block_ticket_user(text, uuid, text) to service_role;
grant execute on function public.pay_unblock_ticket_user(text, uuid) to service_role;
grant execute on function public.pay_unblock_ticket_user_by_id(text, text) to service_role;
