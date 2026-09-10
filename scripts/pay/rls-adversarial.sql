-- SolMint Pay RLS adversarial validation.
-- This script is intentionally ephemeral: all fixtures are rolled back.
-- Run only against a controlled database connection with administrative test access.

begin;

insert into public.pay_merchants(id, owner_user_id, business_name, slug, status)
values
  ('00000000-0000-4000-8000-0000000000a1','usr-418a5419-4836-467f-bc27-385b65eef9df','RLS Test A','rls-test-a','active'),
  ('00000000-0000-4000-8000-0000000000b1','usr-a0e5ca72-97f5-45cc-b671-251a5d664db3','RLS Test B','rls-test-b','active');

insert into public.pay_merchant_members(merchant_id,user_id,role,status)
values
  ('00000000-0000-4000-8000-0000000000a1','usr-418a5419-4836-467f-bc27-385b65eef9df','owner','active'),
  ('00000000-0000-4000-8000-0000000000b1','usr-a0e5ca72-97f5-45cc-b671-251a5d664db3','owner','active'),
  ('00000000-0000-4000-8000-0000000000a1','usr-e68eeff0-d0f7-4b4c-a168-1c18c8d05c80','viewer','active');

insert into public.pay_payment_intents(
  id, merchant_id, amount_atomic, asset, recipient, reference, fee_bps,
  fee_payer, fee_atomic, status, expires_at, customer_total_atomic,
  merchant_net_atomic, fee_recipient, network, merchant_settlement_atomic
)
values
  ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000a1',1000000,'SOL',
   '11111111111111111111111111111111','111111111111111111111111111111111111111111',100,'merchant',10000,
   'created',now()+interval '15 minutes',1000000,990000,'22222222222222222222222222222222','solana',990000),
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000b1',2000000,'SOL',
   '33333333333333333333333333333333','222222222222222222222222222222222222222222',100,'merchant',20000,
   'created',now()+interval '15 minutes',2000000,1980000,'44444444444444444444444444444444','solana',1980000);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'solmint_user_id','usr-418a5419-4836-467f-bc27-385b65eef9df'
)::text, true);

-- Owner A: own tenant only, no cross-merchant visibility, no direct write grants.
do $$
begin
  if (select array_agg(slug order by slug) from public.pay_merchants) <> array['rls-test-a'] then
    raise exception 'RLS_FAIL owner merchant isolation';
  end if;
  if (select array_agg(id::text order by id) from public.pay_payment_intents) <> array['00000000-0000-4000-8000-0000000000c1'] then
    raise exception 'RLS_FAIL owner payment isolation';
  end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000b1'::uuid) then
    raise exception 'RLS_FAIL cross-merchant access';
  end if;
  if not public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['owner']::text[]) then
    raise exception 'RLS_FAIL owner role access';
  end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['finance']::text[]) then
    raise exception 'RLS_FAIL unauthorized finance role';
  end if;
  if has_table_privilege('authenticated','public.pay_payment_intents','insert') then
    raise exception 'RLS_FAIL authenticated insert grant';
  end if;
  if has_table_privilege('authenticated','public.pay_payment_intents','update') then
    raise exception 'RLS_FAIL authenticated update grant';
  end if;
  if has_table_privilege('authenticated','public.pay_api_keys','select') then
    raise exception 'RLS_FAIL authenticated api-key visibility';
  end if;
end $$;

-- Viewer C: own merchant visibility, viewer role allowed, finance role denied.
select set_config('request.jwt.claims', json_build_object(
  'solmint_user_id','usr-e68eeff0-d0f7-4b4c-a168-1c18c8d05c80'
)::text, true);
do $$
begin
  if (select array_agg(slug order by slug) from public.pay_merchants) <> array['rls-test-a'] then
    raise exception 'RLS_FAIL viewer merchant isolation';
  end if;
  if not public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid) then
    raise exception 'RLS_FAIL viewer tenant access';
  end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['finance']::text[]) then
    raise exception 'RLS_FAIL viewer finance access';
  end if;
end $$;

-- Invalid/nonexistent application user must not gain merchant access.
select set_config('request.jwt.claims', json_build_object(
  'solmint_user_id','usr-does-not-exist'
)::text, true);
do $$
begin
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid) then
    raise exception 'RLS_FAIL unknown user access';
  end if;
end $$;

rollback;
