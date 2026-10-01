-- SolMint Pay: shorten public referral codes without changing referral attribution history.
-- Current links use sm_ + 12 lowercase hexadecimal characters (15 characters total).
-- Historical pay_referrals/referral events retain their original snapshots for auditability.

create extension if not exists pgcrypto;

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
    v_code := 'sm_' || encode(gen_random_bytes(6), 'hex');
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

do $$
declare
  v_affiliate record;
  v_code text;
begin
  for v_affiliate in
    select id
      from public.pay_affiliates
     where owner_user_id is not null
       and referral_code !~* '^sm_[0-9a-f]{12}$'
     order by id
  loop
    loop
      v_code := 'sm_' || encode(gen_random_bytes(6), 'hex');
      begin
        update public.pay_affiliates
           set referral_code = v_code,
               updated_at = now()
         where id = v_affiliate.id
           and referral_code !~* '^sm_[0-9a-f]{12}$';
        if found then
          exit;
        end if;
      exception
        when unique_violation then
          null;
      end;
    end loop;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.pay_affiliates'::regclass
       and conname = 'pay_affiliates_short_referral_code_check'
  ) then
    alter table public.pay_affiliates
      add constraint pay_affiliates_short_referral_code_check
      check (owner_user_id is null or referral_code ~ '^sm_[0-9a-f]{12}$');
  end if;
end $$;
