-- SolMint Auth: idempotent Google welcome email delivery.
-- This is an informational notification only and must never affect authentication state.
-- The server-side delivery row provides a retry and duplicate-suppression boundary.

create table if not exists public.auth_welcome_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references better_auth."user"(id) on delete cascade,
  provider_id text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_id),
  constraint auth_welcome_email_provider_check
    check (provider_id in ('google')),
  constraint auth_welcome_email_status_check
    check (status in ('pending','sending','sent','failed')),
  constraint auth_welcome_email_attempt_check
    check (attempt_count >= 0)
);

alter table public.auth_welcome_email_deliveries enable row level security;

create index if not exists auth_welcome_email_due_idx
  on public.auth_welcome_email_deliveries(status, next_attempt_at);

create or replace function public.solmint_claim_auth_welcome_email_delivery(
  p_user_id text,
  p_provider_id text,
  p_worker_id text default 'auth-welcome'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.auth_welcome_email_deliveries%rowtype;
  v_provider text := lower(trim(coalesce(p_provider_id, '')));
begin
  if p_user_id is null
     or length(trim(p_user_id)) < 8
     or v_provider <> 'google'
     or p_worker_id is null
     or length(trim(p_worker_id)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  end if;

  insert into public.auth_welcome_email_deliveries(user_id, provider_id)
  values (p_user_id, v_provider)
  on conflict (user_id, provider_id) do nothing;

  select *
    into v_row
    from public.auth_welcome_email_deliveries
   where user_id = p_user_id
     and provider_id = v_provider
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'DELIVERY_NOT_FOUND');
  end if;

  if v_row.status = 'sent' then
    return jsonb_build_object(
      'ok', true,
      'should_send', false,
      'status', 'sent',
      'delivery_id', v_row.id
    );
  end if;

  if v_row.status = 'sending'
     and v_row.locked_at is not null
     and v_row.locked_at > now() - interval '10 minutes' then
    return jsonb_build_object(
      'ok', true,
      'should_send', false,
      'status', 'sending',
      'delivery_id', v_row.id
    );
  end if;

  if v_row.next_attempt_at > now() then
    return jsonb_build_object(
      'ok', true,
      'should_send', false,
      'status', v_row.status,
      'delivery_id', v_row.id
    );
  end if;

  update public.auth_welcome_email_deliveries
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

create or replace function public.solmint_complete_auth_welcome_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'auth-welcome'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auth_welcome_email_deliveries
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

create or replace function public.solmint_fail_auth_welcome_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'auth-welcome',
  p_error_code text default 'EMAIL_DELIVERY_FAILED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auth_welcome_email_deliveries
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

revoke all on table public.auth_welcome_email_deliveries from public, anon, authenticated;
grant select on table public.auth_welcome_email_deliveries to service_role;

revoke all on function public.solmint_claim_auth_welcome_email_delivery(text,text,text) from public, anon, authenticated;
revoke all on function public.solmint_complete_auth_welcome_email_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.solmint_fail_auth_welcome_email_delivery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.solmint_claim_auth_welcome_email_delivery(text,text,text) to service_role;
grant execute on function public.solmint_complete_auth_welcome_email_delivery(uuid,text) to service_role;
grant execute on function public.solmint_fail_auth_welcome_email_delivery(uuid,text,text) to service_role;

comment on table public.auth_welcome_email_deliveries is
  'Server-only idempotent welcome email delivery state for newly created Google authentication accounts.';
