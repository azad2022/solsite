-- SolMint Pay: hotfix referral short-code generation under an empty search_path.
-- pgcrypto exposes gen_random_bytes(integer) in the extensions schema in production.
-- This keeps affiliate creation working while preserving the short-code contract.

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
    v_code := 'sm_' || encode(extensions.gen_random_bytes(6), 'hex');
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
