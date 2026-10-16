begin;

alter table public.pay_tickets
  add column if not exists category text not null default 'other',
  add column if not exists payment_intent_id uuid;

do $ticket_migration_guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_tickets'::regclass
      and conname = 'pay_tickets_category_check'
  ) then
    alter table public.pay_tickets
      add constraint pay_tickets_category_check
      check (category in (
        'payments','wallet','invoices','payment_links','bulk_pay',
        'api_webhooks','merchant_account','referrals','security','other'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_payment_intents'::regclass
      and conname = 'pay_payment_intents_id_merchant_unique'
  ) then
    alter table public.pay_payment_intents
      add constraint pay_payment_intents_id_merchant_unique unique (id, merchant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_tickets'::regclass
      and conname = 'pay_tickets_payment_intent_merchant_fk'
  ) then
    alter table public.pay_tickets
      add constraint pay_tickets_payment_intent_merchant_fk
      foreign key (payment_intent_id, merchant_id)
      references public.pay_payment_intents(id, merchant_id)
      on delete restrict;
  end if;
end;
$ticket_migration_guard$;

-- Cover ticket foreign-key lookups and the optional Payment Intent association.
create index if not exists pay_tickets_created_by_user_id_idx
  on public.pay_tickets(created_by_user_id);

create index if not exists pay_ticket_messages_author_user_id_idx
  on public.pay_ticket_messages(author_user_id);

create index if not exists pay_tickets_payment_intent_merchant_idx
  on public.pay_tickets(payment_intent_id, merchant_id)
  where payment_intent_id is not null;

create or replace function public.pay_create_ticket(
  p_user_id text,
  p_merchant_id uuid,
  p_subject text,
  p_body text,
  p_priority text,
  p_category text,
  p_payment_intent_id uuid
)
returns public.pay_tickets
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.pay_tickets;
  v_subject text := trim(coalesce(p_subject,''));
  v_body text := trim(coalesce(p_body,''));
  v_priority text := lower(trim(coalesce(p_priority,'normal')));
  v_category text := lower(trim(coalesce(p_category,'other')));
begin
  if p_user_id is null or trim(p_user_id) = '' or p_merchant_id is null then
    raise exception using errcode='22023', message='INVALID_TICKET_OWNER';
  end if;

  if not exists (
    select 1 from public.pay_merchant_members m
    where m.merchant_id = p_merchant_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception using errcode='42501', message='FORBIDDEN';
  end if;

  if char_length(v_subject) < 3 or char_length(v_subject) > 160 then
    raise exception using errcode='22023', message='INVALID_SUBJECT';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception using errcode='22023', message='INVALID_MESSAGE';
  end if;
  if v_priority not in ('normal','high','urgent') then
    raise exception using errcode='22023', message='INVALID_PRIORITY';
  end if;
  if v_category not in (
    'payments','wallet','invoices','payment_links','bulk_pay',
    'api_webhooks','merchant_account','referrals','security','other'
  ) then
    raise exception using errcode='22023', message='INVALID_CATEGORY';
  end if;

  if p_payment_intent_id is not null and not exists (
    select 1 from public.pay_payment_intents i
    where i.id = p_payment_intent_id
      and i.merchant_id = p_merchant_id
  ) then
    raise exception using errcode='P0002', message='PAYMENT_INTENT_NOT_FOUND';
  end if;

  insert into public.pay_tickets (
    merchant_id, created_by_user_id, subject, status, priority,
    category, payment_intent_id
  )
  values (
    p_merchant_id, p_user_id, v_subject, 'open', v_priority,
    v_category, p_payment_intent_id
  )
  returning * into v_ticket;

  insert into public.pay_ticket_messages(ticket_id, author_user_id, body)
  values (v_ticket.id, p_user_id, v_body);

  return v_ticket;
end;
$function$;

-- Keep the historical five-argument server contract working for older internal
-- callers while routing it through the same validation and integrity checks.
create or replace function public.pay_create_ticket(
  p_user_id text,
  p_merchant_id uuid,
  p_subject text,
  p_body text,
  p_priority text default 'normal'
)
returns public.pay_tickets
language sql
security definer
set search_path = ''
as $function$
  select public.pay_create_ticket(
    p_user_id, p_merchant_id, p_subject, p_body,
    p_priority, 'other', null::uuid
  );
$function$;

revoke all on function public.pay_create_ticket(text,uuid,text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.pay_create_ticket(text,uuid,text,text,text,text,uuid)
  to service_role;

revoke all on function public.pay_create_ticket(text,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.pay_create_ticket(text,uuid,text,text,text)
  to service_role;

commit;
