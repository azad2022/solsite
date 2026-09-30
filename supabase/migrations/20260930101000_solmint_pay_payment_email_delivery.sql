-- SolMint Pay: idempotent merchant payment email delivery.
-- Email notification is not financial truth and must never alter payment state.
-- The delivery row provides a server-side deduplication/retry boundary.

create table if not exists public.pay_payment_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pay_payment_intents(id) on delete cascade,
  event_type text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, event_type),
  constraint pay_payment_email_event_type_check
    check (event_type in ('payment.outcome.success','payment.outcome.failure')),
  constraint pay_payment_email_status_check
    check (status in ('pending','sending','sent','failed')),
  constraint pay_payment_email_attempt_check
    check (attempt_count >= 0)
);

create index if not exists pay_payment_email_due_idx
  on public.pay_payment_email_deliveries(status, next_attempt_at);

create or replace function public.pay_claim_payment_email_delivery(
  p_payment_id uuid,
  p_event_type text,
  p_worker_id text default 'pay-verify'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pay_payment_email_deliveries%rowtype;
begin
  if p_payment_id is null
     or p_event_type not in ('payment.outcome.success','payment.outcome.failure')
     or p_worker_id is null
     or length(trim(p_worker_id)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  end if;

  insert into public.pay_payment_email_deliveries(payment_id, event_type)
  values (p_payment_id, p_event_type)
  on conflict (payment_id, event_type) do nothing;

  select * into v_row
    from public.pay_payment_email_deliveries
   where payment_id = p_payment_id
     and event_type = p_event_type
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'DELIVERY_NOT_FOUND');
  end if;

  if v_row.status = 'sent' then
    return jsonb_build_object('ok', true, 'should_send', false, 'status', 'sent', 'delivery_id', v_row.id);
  end if;

  if v_row.status = 'sending'
     and v_row.locked_at is not null
     and v_row.locked_at > now() - interval '10 minutes' then
    return jsonb_build_object('ok', true, 'should_send', false, 'status', 'sending', 'delivery_id', v_row.id);
  end if;

  if v_row.next_attempt_at > now() then
    return jsonb_build_object('ok', true, 'should_send', false, 'status', v_row.status, 'delivery_id', v_row.id);
  end if;

  update public.pay_payment_email_deliveries
     set status = 'sending',
         attempt_count = attempt_count + 1,
         locked_at = now(),
         locked_by = left(p_worker_id, 120),
         updated_at = now()
   where id = v_row.id
   returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'should_send', true,
    'status', v_row.status,
    'delivery_id', v_row.id,
    'attempt_count', v_row.attempt_count
  );
end;
$$;

create or replace function public.pay_complete_payment_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'pay-verify'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pay_payment_email_deliveries
     set status = 'sent',
         sent_at = now(),
         locked_at = null,
         locked_by = null,
         last_error_code = null,
         updated_at = now()
   where id = p_delivery_id
     and status = 'sending'
     and (locked_by = p_worker_id or locked_by is null);

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'DELIVERY_NOT_CLAIMED');
  end if;

  return jsonb_build_object('ok', true, 'status', 'sent');
end;
$$;

create or replace function public.pay_fail_payment_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'pay-verify',
  p_error_code text default 'EMAIL_DELIVERY_FAILED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pay_payment_email_deliveries
     set status = 'failed',
         locked_at = null,
         locked_by = null,
         last_error_code = left(coalesce(nullif(trim(p_error_code), ''), 'EMAIL_DELIVERY_FAILED'), 120),
         next_attempt_at = now() + interval '1 minute',
         updated_at = now()
   where id = p_delivery_id
     and status = 'sending'
     and (locked_by = p_worker_id or locked_by is null);

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'DELIVERY_NOT_CLAIMED');
  end if;

  return jsonb_build_object('ok', true, 'status', 'failed');
end;
$$;

revoke all on table public.pay_payment_email_deliveries from public, anon, authenticated;
grant select on table public.pay_payment_email_deliveries to service_role;

revoke all on function public.pay_claim_payment_email_delivery(uuid,text,text) from public, anon, authenticated;
revoke all on function public.pay_complete_payment_email_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.pay_fail_payment_email_delivery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.pay_claim_payment_email_delivery(uuid,text,text) to service_role;
grant execute on function public.pay_complete_payment_email_delivery(uuid,text) to service_role;
grant execute on function public.pay_fail_payment_email_delivery(uuid,text,text) to service_role;

drop trigger if exists pay_payment_email_deliveries_set_updated_at on public.pay_payment_email_deliveries;

comment on table public.pay_payment_email_deliveries is
  'Server-only idempotent notification delivery state for merchant payment outcome emails.';
