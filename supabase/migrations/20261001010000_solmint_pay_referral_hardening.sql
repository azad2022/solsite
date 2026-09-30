-- SolMint Pay: referral link hardening.
-- Goals:
--   1. Route public referral links through Cloudflare Pages Functions.
--   2. Shorten newly issued referral codes without breaking legacy links.
--   3. Keep attribution canonical on the affiliate's current code.
--   4. Preserve referral click attribution across a browser session longer than one tab.
--
-- Existing long codes are preserved in pay_referral_code_aliases so previously
-- shared links continue to resolve after the short-code rollout.

create table if not exists public.pay_referral_code_aliases (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null
    references public.pay_affiliates(id)
    on delete cascade,
  legacy_referral_code text not null unique,
  created_at timestamptz not null default now(),
  constraint pay_referral_alias_code_length_check
    check (char_length(btrim(legacy_referral_code)) between 4 and 120)
);

create index if not exists pay_referral_code_aliases_affiliate_idx
  on public.pay_referral_code_aliases(affiliate_id);

alter table public.pay_referral_code_aliases enable row level security;

revoke all on table public.pay_referral_code_aliases from public, anon, authenticated;

comment on table public.pay_referral_code_aliases is
  'Private compatibility aliases for legacy SolMint referral codes; public referral URLs use pay_affiliates.referral_code.';

-- Preserve every currently issued public code before rotating it to the shorter
-- format. The operation is idempotent: existing aliases are not duplicated.
insert into public.pay_referral_code_aliases(affiliate_id, legacy_referral_code)
select a.id, a.referral_code
  from public.pay_affiliates a
 where char_length(a.referral_code) <> 19
on conflict (legacy_referral_code) do nothing;

do $$
declare
  v_affiliate record;
  v_code text;
begin
  for v_affiliate in
    select id
      from public.pay_affiliates
     where char_length(referral_code) <> 19
  loop
    loop
      -- 64 bits of random entropy + the branded "sm_" prefix.
      v_code := 'sm_' || encode(gen_random_bytes(8), 'hex');
      begin
        update public.pay_affiliates
           set referral_code = v_code,
               updated_at = now()
         where id = v_affiliate.id;

        exit;
      exception
        when unique_violation then
          -- Extremely unlikely, but retry on the database uniqueness boundary.
          null;
      end;
    end loop;
  end loop;
end $$;

alter table public.pay_affiliates
  drop constraint if exists pay_affiliates_referral_code_shape_check;

alter table public.pay_affiliates
  add constraint pay_affiliates_referral_code_shape_check
  check (referral_code ~ '^sm_[0-9a-f]{16}$');

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
    v_code := 'sm_' || encode(gen_random_bytes(8), 'hex');
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

  -- Accept both the current short public code and any preserved legacy code,
  -- but always canonicalize the stored click to the affiliate's current code.
  select a.*
    into v_affiliate
    from public.pay_affiliates a
   where a.status = 'active'
     and (
       a.referral_code = v_code
       or exists (
         select 1
           from public.pay_referral_code_aliases alias
          where alias.affiliate_id = a.id
            and alias.legacy_referral_code = v_code
       )
     )
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
     and (
       a.referral_code = v_code
       or exists (
         select 1
           from public.pay_referral_code_aliases alias
          where alias.affiliate_id = a.id
            and alias.legacy_referral_code = v_code
       )
     )
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

comment on column public.pay_affiliates.referral_code is
  'Current short public referral code (sm_ + 64 bits of random hex). Legacy codes remain in pay_referral_code_aliases.';
