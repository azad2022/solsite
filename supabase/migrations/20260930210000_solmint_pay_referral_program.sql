-- SolMint Pay: referral program, signup attribution, click tracking, referral liability
-- Business policy: one referral level; commission = 50% (5000 bps) of authoritative
-- gateway revenue for payments belonging to a directly referred merchant.
-- All attribution and financial writes remain server/database authoritative.

create extension if not exists pgcrypto;

alter table public.pay_affiliates
  alter column commission_rate_bps set default 5000;

do $$
begin
  if exists (
    select owner_user_id
      from public.pay_affiliates
     where owner_user_id is not null
     group by owner_user_id
    having count(*) > 1
  ) then
    raise exception 'pay_affiliates contains duplicate owners; referral migration requires an explicit reconciliation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_affiliates'::regclass
      and conname = 'pay_affiliates_owner_user_id_key'
  ) then
    alter table public.pay_affiliates
      add constraint pay_affiliates_owner_user_id_key unique (owner_user_id);
  end if;
end $$;

do $$
begin
  if exists (
    select merchant_id
      from public.pay_referrals
     group by merchant_id
    having count(*) > 1
  ) then
    raise exception 'pay_referrals contains multiple affiliates for the same merchant; referral migration requires an explicit reconciliation';
  end if;
end $$;

create table if not exists public.pay_referral_click_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.pay_affiliates(id) on delete restrict,
  referral_code text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint pay_referral_click_code_length_check
    check (char_length(btrim(referral_code)) between 4 and 120)
);

create index if not exists pay_referral_click_events_affiliate_created_idx
  on public.pay_referral_click_events(affiliate_id, created_at desc);

create table if not exists public.pay_referral_user_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.pay_affiliates(id) on delete restrict,
  referred_user_id text not null unique references public.users(id) on delete restrict,
  click_event_id uuid not null unique references public.pay_referral_click_events(id) on delete restrict,
  referral_code text not null,
  attributed_at timestamptz not null default now(),
  constraint pay_referral_user_attribution_code_length_check
    check (char_length(btrim(referral_code)) between 4 and 120)
);

create index if not exists pay_referral_user_attributions_affiliate_attributed_idx
  on public.pay_referral_user_attributions(affiliate_id, attributed_at desc);

create table if not exists public.pay_referral_signup_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null unique references public.pay_referral_user_attributions(id) on delete cascade,
  referrer_application_user_id text not null references public.users(id) on delete restrict,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_referral_signup_email_status_check
    check (status in ('pending','sending','sent','failed')),
  constraint pay_referral_signup_email_attempt_check
    check (attempt_count >= 0)
);

create index if not exists pay_referral_signup_email_due_idx
  on public.pay_referral_signup_email_deliveries(status, next_attempt_at);

alter table public.pay_referral_click_events enable row level security;
alter table public.pay_referral_user_attributions enable row level security;
alter table public.pay_referral_signup_email_deliveries enable row level security;

revoke all on table public.pay_referral_click_events,
  public.pay_referral_user_attributions,
  public.pay_referral_signup_email_deliveries
from public, anon, authenticated;

comment on table public.pay_referral_click_events is
  'Server-only referral click events. Click count is a count of recorded referral-link landings, not a unique-user metric.';
comment on table public.pay_referral_user_attributions is
  'Immutable single-level signup attribution. A referred user can have at most one direct affiliate.';
comment on table public.pay_referral_signup_email_deliveries is
  'Server-only idempotent notification delivery state for successful referral signups.';

alter table public.pay_referrals
  drop constraint if exists pay_referrals_referral_code_key;

alter table public.pay_referrals
  add column if not exists user_attribution_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_referrals'::regclass
      and conname = 'pay_referrals_user_attribution_fk'
  ) then
    alter table public.pay_referrals
      add constraint pay_referrals_user_attribution_fk
      foreign key (user_attribution_id)
      references public.pay_referral_user_attributions(id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists pay_referrals_merchant_id_unique_idx
  on public.pay_referrals(merchant_id);

create index if not exists pay_referrals_affiliate_attributed_idx
  on public.pay_referrals(affiliate_id, attributed_at desc);

create index if not exists pay_referrals_affiliate_referral_code_idx
  on public.pay_referrals(affiliate_id, referral_code);

comment on column public.pay_referrals.referral_code is
  'Snapshot of the affiliate public referral code used for this merchant attribution; multiple referred merchants may share the same affiliate code.';

create index if not exists pay_commissions_referral_created_idx
  on public.pay_commissions(referral_id, created_at desc);

update public.pay_affiliates
   set commission_rate_bps = 5000,
       updated_at = now()
 where commission_rate_bps = 0
   and status in ('pending','active');

create or replace function public.pay_ensure_affiliate(
  p_owner_user_id text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affiliate public.pay_affiliates%rowtype;
  v_code text;
  v_name text := nullif(regexp_replace(coalesce(p_display_name, ''), '[[:space:]]+', ' ', 'g'), '');
begin
  if p_owner_user_id is null or length(btrim(p_owner_user_id)) = 0
     or length(btrim(p_owner_user_id)) > 256 then
    raise exception 'invalid affiliate owner';
  end if;

  if not exists (
    select 1 from public.users
     where id = btrim(p_owner_user_id)
       and is_active = true
  ) then
    raise exception 'affiliate owner is not an active application user';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    v_name := 'SolMint User';
  end if;
  v_name := left(v_name, 120);

  select *
    into v_affiliate
    from public.pay_affiliates
   where owner_user_id = btrim(p_owner_user_id)
   limit 1;

  if found then
    return v_affiliate.id;
  end if;

  loop
    v_code := 'sm_' || encode(gen_random_bytes(12), 'hex');
    begin
      insert into public.pay_affiliates(
        owner_user_id, display_name, referral_code, commission_rate_bps, status
      )
      values (
        btrim(p_owner_user_id), v_name, v_code, 5000, 'active'
      )
      returning * into v_affiliate;

      return v_affiliate.id;
    exception
      when unique_violation then
        select *
          into v_affiliate
          from public.pay_affiliates
         where owner_user_id = btrim(p_owner_user_id)
         limit 1;
        if found then
          return v_affiliate.id;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.pay_ensure_affiliate(text,text) from public, anon, authenticated;
grant execute on function public.pay_ensure_affiliate(text,text) to service_role;

create or replace function public.pay_ensure_affiliate_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active = true then
    perform public.pay_ensure_affiliate(
      new.id,
      coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(new.username), ''), 'SolMint User')
    );
  end if;
  return new;
end;
$$;

revoke all on function public.pay_ensure_affiliate_for_user() from public, anon, authenticated;

drop trigger if exists pay_users_ensure_affiliate on public.users;
create trigger pay_users_ensure_affiliate
after insert or update of is_active on public.users
for each row execute function public.pay_ensure_affiliate_for_user();

do $$
declare
  v_user record;
begin
  for v_user in
    select u.id, coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.username), ''), 'SolMint User') as display_name
      from public.users u
     where u.is_active = true
       and not exists (
         select 1 from public.pay_affiliates a where a.owner_user_id = u.id
       )
  loop
    perform public.pay_ensure_affiliate(v_user.id, v_user.display_name);
  end loop;
end $$;

create or replace function public.pay_record_referral_click(
  p_referral_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(btrim(coalesce(p_referral_code, '')));
  v_affiliate public.pay_affiliates%rowtype;
  v_click_id uuid;
begin
  if char_length(v_code) < 4 or char_length(v_code) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_REFERRAL_CODE');
  end if;

  select *
    into v_affiliate
    from public.pay_affiliates
   where referral_code = v_code
     and status = 'active'
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'REFERRAL_NOT_FOUND');
  end if;

  insert into public.pay_referral_click_events(affiliate_id, referral_code)
  values (v_affiliate.id, v_affiliate.referral_code)
  returning id into v_click_id;

  return jsonb_build_object(
    'ok', true,
    'click_id', v_click_id,
    'referral_code', v_affiliate.referral_code
  );
end;
$$;

revoke all on function public.pay_record_referral_click(text) from public, anon, authenticated;
grant execute on function public.pay_record_referral_click(text) to service_role;

create or replace function public.pay_attribute_referral_from_click(
  p_click_id uuid,
  p_referral_code text,
  p_referred_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_click public.pay_referral_click_events%rowtype;
  v_affiliate public.pay_affiliates%rowtype;
  v_user_created_at timestamptz;
  v_existing public.pay_referral_user_attributions%rowtype;
  v_attribution public.pay_referral_user_attributions%rowtype;
  v_delivery public.pay_referral_signup_email_deliveries%rowtype;
  v_code text := lower(btrim(coalesce(p_referral_code, '')));
begin
  if p_click_id is null
     or p_referred_user_id is null
     or length(btrim(p_referred_user_id)) = 0
     or char_length(v_code) < 4
     or char_length(v_code) > 120 then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'INVALID_INPUT');
  end if;

  select c.*
    into v_click
    from public.pay_referral_click_events c
    where c.id = p_click_id
      and c.referral_code = v_code
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'CLICK_NOT_FOUND');
  end if;

  select a.*
    into v_affiliate
    from public.pay_affiliates a
   where a.id = v_click.affiliate_id
     and a.referral_code = v_code
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'AFFILIATE_NOT_FOUND');
  end if;

  if v_click.consumed_at is not null then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'CLICK_ALREADY_CONSUMED');
  end if;

  if v_affiliate.status <> 'active' then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'AFFILIATE_INACTIVE');
  end if;

  select u.created_at
    into v_user_created_at
    from public.users u
   where u.id = btrim(p_referred_user_id)
   limit 1;

  if v_user_created_at is null then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'USER_NOT_FOUND');
  end if;

  if v_user_created_at < v_click.created_at then
    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'USER_PREEXISTED_CLICK');
  end if;

  if v_affiliate.owner_user_id = btrim(p_referred_user_id) then
    update public.pay_referral_click_events
       set consumed_at = now()
     where id = p_click_id
       and consumed_at is null;

    return jsonb_build_object('ok', false, 'attributed', false, 'reason', 'SELF_REFERRAL');
  end if;

  select *
    into v_existing
    from public.pay_referral_user_attributions
   where referred_user_id = btrim(p_referred_user_id)
   for update;

  if found then
    update public.pay_referral_click_events
       set consumed_at = now()
     where id = p_click_id
       and consumed_at is null;

    return jsonb_build_object(
      'ok', true,
      'attributed', false,
      'reason', 'ALREADY_ATTRIBUTED',
      'attribution_id', v_existing.id,
      'affiliate_id', v_existing.affiliate_id
    );
  end if;

  insert into public.pay_referral_user_attributions(
    affiliate_id, referred_user_id, click_event_id, referral_code
  )
  values (
    v_affiliate.id, btrim(p_referred_user_id), p_click_id, v_affiliate.referral_code
  )
  returning * into v_attribution;

  update public.pay_referral_click_events
     set consumed_at = now()
   where id = p_click_id
     and consumed_at is null;

  insert into public.pay_referral_signup_email_deliveries(
    attribution_id, referrer_application_user_id
  )
  values (
    v_attribution.id, v_affiliate.owner_user_id
  )
  on conflict (attribution_id) do nothing
  returning * into v_delivery;

  if v_delivery.id is null then
    select *
      into v_delivery
      from public.pay_referral_signup_email_deliveries
     where attribution_id = v_attribution.id
     limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attributed', true,
    'attribution_id', v_attribution.id,
    'affiliate_id', v_affiliate.id,
    'referrer_application_user_id', v_affiliate.owner_user_id,
    'referred_user_id', v_attribution.referred_user_id,
    'referral_code', v_attribution.referral_code,
    'delivery_id', v_delivery.id
  );
exception
  when unique_violation then
    select *
      into v_existing
      from public.pay_referral_user_attributions
     where referred_user_id = btrim(p_referred_user_id)
     limit 1;

    if found then
      update public.pay_referral_click_events
         set consumed_at = now()
       where id = p_click_id
         and consumed_at is null;

      return jsonb_build_object(
        'ok', true,
        'attributed', false,
        'reason', 'ALREADY_ATTRIBUTED',
        'attribution_id', v_existing.id,
        'affiliate_id', v_existing.affiliate_id
      );
    end if;

    raise;
end;
$$;

revoke all on function public.pay_attribute_referral_from_click(uuid,text,text) from public, anon, authenticated;
grant execute on function public.pay_attribute_referral_from_click(uuid,text,text) to service_role;

create or replace function public.pay_attach_referred_merchant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attribution public.pay_referral_user_attributions%rowtype;
  v_affiliate_id uuid;
begin
  select ua.*
    into v_attribution
    from public.pay_referral_user_attributions ua
   where ua.referred_user_id = new.owner_user_id
   limit 1;

  if not found then
    return new;
  end if;

  v_affiliate_id := v_attribution.affiliate_id;

  insert into public.pay_referrals(
    affiliate_id, merchant_id, referral_code, attributed_at, active, user_attribution_id
  )
  values (
    v_affiliate_id, new.id, v_attribution.referral_code, v_attribution.attributed_at, true, v_attribution.id
  )
  on conflict (merchant_id) do nothing;

  return new;
end;
$$;

revoke all on function public.pay_attach_referred_merchant() from public, anon, authenticated;

drop trigger if exists pay_merchants_attach_referral on public.pay_merchants;
create trigger pay_merchants_attach_referral
after insert on public.pay_merchants
for each row execute function public.pay_attach_referred_merchant();

create or replace function public.pay_recognize_referral_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral_id uuid;
  v_commission_bps integer;
  v_commission numeric;
begin
  new.referral_commission_atomic := 0;
  new.net_gateway_revenue_atomic := new.gross_gateway_fee_atomic;

  select r.id, a.commission_rate_bps
    into v_referral_id, v_commission_bps
    from public.pay_payment_intents p
    join public.pay_referrals r on r.merchant_id = p.merchant_id and r.active = true
    join public.pay_affiliates a on a.id = r.affiliate_id and a.status = 'active'
   where p.id = new.payment_id
   limit 1;

  if v_referral_id is null or v_commission_bps is null then
    return new;
  end if;

  v_commission := floor((new.gross_gateway_fee_atomic * v_commission_bps) / 10000);

  new.referral_commission_atomic := v_commission;
  new.net_gateway_revenue_atomic := new.gross_gateway_fee_atomic - v_commission;

  insert into public.pay_commissions(
    referral_id,
    payment_id,
    gross_gateway_fee_atomic,
    commission_bps,
    commission_atomic,
    status
  )
  values (
    v_referral_id,
    new.payment_id,
    new.gross_gateway_fee_atomic,
    v_commission_bps,
    v_commission,
    'pending'
  )
  on conflict (referral_id, payment_id) do nothing;

  return new;
end;
$$;

revoke all on function public.pay_recognize_referral_commission() from public, anon, authenticated;

drop trigger if exists pay_revenue_ledger_referral_commission on public.pay_revenue_ledger;
create trigger pay_revenue_ledger_referral_commission
before insert on public.pay_revenue_ledger
for each row execute function public.pay_recognize_referral_commission();

create or replace function public.pay_claim_referral_signup_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'pay-referral'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pay_referral_signup_email_deliveries%rowtype;
begin
  if p_delivery_id is null
     or p_worker_id is null
     or length(trim(p_worker_id)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  end if;

  select *
    into v_row
    from public.pay_referral_signup_email_deliveries
   where id = p_delivery_id
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

  update public.pay_referral_signup_email_deliveries
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

create or replace function public.pay_complete_referral_signup_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'pay-referral'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pay_referral_signup_email_deliveries
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

create or replace function public.pay_fail_referral_signup_email_delivery(
  p_delivery_id uuid,
  p_worker_id text default 'pay-referral',
  p_error_code text default 'REFERRAL_SIGNUP_EMAIL_DELIVERY_FAILED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pay_referral_signup_email_deliveries
     set status = 'failed',
         locked_at = null,
         locked_by = null,
         last_error_code = left(
           coalesce(nullif(trim(p_error_code), ''), 'REFERRAL_SIGNUP_EMAIL_DELIVERY_FAILED'),
           120
         ),
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

revoke all on function public.pay_claim_referral_signup_email_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.pay_complete_referral_signup_email_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.pay_fail_referral_signup_email_delivery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.pay_claim_referral_signup_email_delivery(uuid,text) to service_role;
grant execute on function public.pay_complete_referral_signup_email_delivery(uuid,text) to service_role;
grant execute on function public.pay_fail_referral_signup_email_delivery(uuid,text,text) to service_role;

create or replace function public.pay_get_referral_dashboard(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id text;
  v_affiliate public.pay_affiliates%rowtype;
  v_stats jsonb;
  v_earnings jsonb;
  v_referrals jsonb;
  v_commissions jsonb;
begin
  if current_setting('role', true) <> 'authenticated' then
    return jsonb_build_object('ok', false, 'reason', 'UNAUTHORIZED');
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_LIMIT');
  end if;

  v_user_id := public.pay_request_user_id();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'UNAUTHORIZED');
  end if;

  select *
    into v_affiliate
    from public.pay_affiliates
   where owner_user_id = v_user_id
     and status in ('pending','active')
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'AFFILIATE_NOT_FOUND');
  end if;

  select jsonb_build_object(
    'clicks', (
      select count(*)::text
        from public.pay_referral_click_events c
       where c.affiliate_id = v_affiliate.id
    ),
    'directSignups', (
      select count(*)::text
        from public.pay_referral_user_attributions ua
       where ua.affiliate_id = v_affiliate.id
    ),
    'referredMerchants', (
      select count(*)::text
        from public.pay_referrals r
       where r.affiliate_id = v_affiliate.id
    ),
    'activeReferredMerchants', (
      select count(*)::text
        from public.pay_referrals r
       where r.affiliate_id = v_affiliate.id
         and r.active = true
    )
  ) into v_stats;

  with rows as (
    select
      p.asset,
      coalesce(
        p.token_decimals,
        case when p.asset = 'SOL' then 9 else 6 end
      )::integer as token_decimals,
      l.gross_gateway_fee_atomic,
      l.referral_commission_atomic,
      l.status as ledger_status,
      c.status as commission_status
      from public.pay_commissions c
      join public.pay_referrals r on r.id = c.referral_id
      join public.pay_payment_intents p on p.id = c.payment_id
      join public.pay_revenue_ledger l on l.payment_id = c.payment_id
     where r.affiliate_id = v_affiliate.id
  ),
  grouped as (
    select
      asset,
      max(token_decimals) as token_decimals,
      sum(case when ledger_status <> 'void' and commission_status <> 'void'
               then gross_gateway_fee_atomic else 0 end) as gross_gateway_fee_atomic,
      sum(case when ledger_status <> 'void' and commission_status <> 'void'
               then referral_commission_atomic else 0 end) as commission_atomic,
      sum(case when ledger_status <> 'void' and commission_status = 'pending'
               then referral_commission_atomic else 0 end) as pending_commission_atomic,
      sum(case when ledger_status <> 'void' and commission_status = 'approved'
               then referral_commission_atomic else 0 end) as approved_commission_atomic,
      sum(case when ledger_status <> 'void' and commission_status = 'paid'
               then referral_commission_atomic else 0 end) as paid_commission_atomic,
      sum(case when ledger_status = 'void' or commission_status = 'void'
               then referral_commission_atomic else 0 end) as reversed_commission_atomic
      from rows
     group by asset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'asset', asset,
        'token_decimals', token_decimals,
        'gross_gateway_fee_atomic', gross_gateway_fee_atomic::text,
        'commission_atomic', commission_atomic::text,
        'pending_commission_atomic', pending_commission_atomic::text,
        'approved_commission_atomic', approved_commission_atomic::text,
        'paid_commission_atomic', paid_commission_atomic::text,
        'reversed_commission_atomic', reversed_commission_atomic::text
      )
      order by asset
    ),
    '[]'::jsonb
  )
  into v_earnings
  from grouped;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'affiliate_id', r.affiliate_id,
        'merchant_id', r.merchant_id,
        'referral_code', r.referral_code,
        'attributed_at', r.attributed_at,
        'active', r.active,
        'user_attribution_id', r.user_attribution_id
      )
      order by r.attributed_at desc
    ),
    '[]'::jsonb
  )
  into v_referrals
  from (
    select *
      from public.pay_referrals r
     where r.affiliate_id = v_affiliate.id
     order by r.attributed_at desc
     limit p_limit
  ) r;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'referral_id', c.referral_id,
        'payment_id', c.payment_id,
        'asset', p.asset,
        'token_decimals', coalesce(
          p.token_decimals,
          case when p.asset = 'SOL' then 9 else 6 end
        ),
        'gross_gateway_fee_atomic', c.gross_gateway_fee_atomic::text,
        'commission_bps', c.commission_bps,
        'commission_atomic', c.commission_atomic::text,
        'status', c.status,
        'created_at', c.created_at,
        'approved_at', c.approved_at,
        'paid_at', c.paid_at
      )
      order by c.created_at desc
    ),
    '[]'::jsonb
  )
  into v_commissions
  from (
    select c.*
      from public.pay_commissions c
      join public.pay_referrals r on r.id = c.referral_id
     where r.affiliate_id = v_affiliate.id
     order by c.created_at desc
     limit p_limit
  ) c
  join public.pay_payment_intents p on p.id = c.payment_id;

  return jsonb_build_object(
    'ok', true,
    'affiliate', jsonb_build_object(
      'id', v_affiliate.id,
      'display_name', v_affiliate.display_name,
      'referral_code', v_affiliate.referral_code,
      'commission_rate_bps', v_affiliate.commission_rate_bps,
      'status', v_affiliate.status,
      'created_at', v_affiliate.created_at,
      'updated_at', v_affiliate.updated_at
    ),
    'stats', v_stats,
    'earnings_by_asset', v_earnings,
    'referrals', v_referrals,
    'commissions', v_commissions
  );
end;
$$;

revoke all on function public.pay_get_referral_dashboard(integer) from public, anon, authenticated;
grant execute on function public.pay_get_referral_dashboard(integer) to authenticated;

comment on function public.pay_get_referral_dashboard(integer) is
  'Owner-scoped referral dashboard. Uses server-authenticated pay_request_user_id and performs no client-side financial calculation.';
